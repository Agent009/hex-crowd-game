import { beforeEach, describe, expect, it } from 'vitest';
import { isSupabaseConfigured } from '../lib/supabase';
import { authService } from './AuthService';
import {
  appendRealtimeDiagnostic,
  canSendLocalGameAction,
  createRealtimeDiagnostic,
  createRealtimeDiagnosticRequest,
  createSessionAuthorityRequest,
  emitRealtimeDiagnosticEvent,
  createPersistedStateHash,
  getGameActionAuditPlayerId,
  measureJsonPayloadBytes,
  normaliseRealtimeError,
  REALTIME_DIAGNOSTIC_EVENT,
  realtimeService,
  shouldBroadcastStateSync,
  shouldRecordStateSyncPayloadWarning,
  shouldWarnStateSyncPayloadSize,
} from './RealtimeService';
import { clearAuth } from '../store/authSlice';
import { clearSession, setLocalPlayer, setSession } from '../store/sessionSlice';
import { store } from '../store/store';

const itWhenSupabaseMissing = isSupabaseConfigured ? it.skip : it;

describe('runtime service fallbacks', () => {
  beforeEach(() => {
    store.dispatch(clearAuth());
    store.dispatch(clearSession());
    realtimeService.clearDiagnostics();
  });

  itWhenSupabaseMissing('returns a clear auth error when Supabase is not configured', async () => {
    const result = await authService.signIn('player@example.com', 'password');

    expect(result).toEqual({
      success: false,
      error: 'Supabase is not configured',
    });
    expect(store.getState().auth.error).toBe('Supabase is not configured');
    expect(store.getState().auth.isLoading).toBe(false);
  });

  itWhenSupabaseMissing('returns a clear realtime error when Supabase is not configured', async () => {
    const result = await realtimeService.createSession('Ava');

    expect(result).toBeNull();
    expect(store.getState().session.error).toBe('Supabase is not configured');
    expect(store.getState().session.connectionStatus).toBe('error');
  });

  it('derives player IDs for audited host-routed actions', () => {
    expect(getGameActionAuditPlayerId({
      type: 'move',
      playerId: 'player_a',
      target: { q: 0, r: 0, s: 0 },
    })).toBe('player_a');

    expect(getGameActionAuditPlayerId({
      type: 'proposeTrade',
      payload: {
        fromPlayerId: 'sender',
        toPlayerId: 'receiver',
        offeredResources: { wood: 1 },
        requestedResources: { stone: 1 },
      },
    })).toBe('sender');

    expect(getGameActionAuditPlayerId({
      type: 'initiateCombat',
      attackerId: 'attacker',
      defenderId: 'defender',
    })).toBe('attacker');

    expect(getGameActionAuditPlayerId({
      type: 'forceNextPhase',
      playerId: 'player_host',
    })).toBe('player_host');
  });

  it('hashes both game and world state for persistence deduplication', () => {
    const state = store.getState();
    const originalHash = createPersistedStateHash(state.game, state.world);
    const gameChangedHash = createPersistedStateHash(
      { ...state.game, roundNumber: state.game.roundNumber + 1 },
      state.world
    );
    const worldChangedHash = createPersistedStateHash(
      state.game,
      { ...state.world, activeTiles: [...state.world.activeTiles, '0,0,0'] }
    );

    expect(gameChangedHash).not.toBe(originalHash);
    expect(worldChangedHash).not.toBe(originalHash);
  });

  it('deduplicates exact-match state sync broadcasts by state hash', () => {
    const state = store.getState();
    const stateHash = createPersistedStateHash(state.game, state.world);
    const nextHash = createPersistedStateHash(
      { ...state.game, roundNumber: state.game.roundNumber + 1 },
      state.world
    );

    expect(shouldBroadcastStateSync(stateHash, null)).toBe(true);
    expect(shouldBroadcastStateSync(stateHash, stateHash)).toBe(false);
    expect(shouldBroadcastStateSync(nextHash, stateHash)).toBe(true);
  });

  it('checks local action ownership before client broadcast', () => {
    expect(canSendLocalGameAction({
      type: 'move',
      playerId: 'player_a',
      target: { q: 0, r: 0, s: 0 },
    }, 'player_a')).toBe(true);

    expect(canSendLocalGameAction({
      type: 'move',
      playerId: 'player_b',
      target: { q: 0, r: 0, s: 0 },
    }, 'player_a')).toBe(false);

    expect(canSendLocalGameAction({
      type: 'forceNextPhase',
      playerId: 'host_a',
    }, 'host_a')).toBe(true);

    expect(canSendLocalGameAction({
      type: 'forceNextPhase',
      playerId: 'host_b',
    }, 'host_a')).toBe(false);
  });

  it('measures JSON payload bytes and flags state sync payload budget warnings', () => {
    const payload = { message: 'hello', count: 3 };
    const payloadBytes = measureJsonPayloadBytes(payload);

    expect(payloadBytes).toBe(new TextEncoder().encode(JSON.stringify(payload)).length);
    expect(shouldWarnStateSyncPayloadSize(payloadBytes, payloadBytes)).toBe(false);
    expect(shouldWarnStateSyncPayloadSize(payloadBytes + 1, payloadBytes)).toBe(true);
    expect(shouldRecordStateSyncPayloadWarning(payloadBytes + 1, payloadBytes, null, 30000, 1000)).toBe(true);
    expect(shouldRecordStateSyncPayloadWarning(payloadBytes + 1, payloadBytes, 1000, 30000, 2500)).toBe(false);
    expect(shouldRecordStateSyncPayloadWarning(payloadBytes + 1, payloadBytes, 1000, 30000, 31000)).toBe(true);
    expect(shouldRecordStateSyncPayloadWarning(payloadBytes, payloadBytes, null, 30000, 1000)).toBe(false);
  });

  it('records a diagnostic when a client action has no realtime channel', () => {
    realtimeService.sendAction({
      type: 'move',
      playerId: 'player_a',
      target: { q: 0, r: 0, s: 0 },
    });

    expect(realtimeService.getDiagnostics()).toHaveLength(1);
    expect(realtimeService.getDiagnostics()[0]).toMatchObject({
      code: 'missing_channel',
      severity: 'warning',
      actionType: 'move',
      playerId: 'player_a',
      sessionId: null,
    });
  });

  it('refuses to send a local action for another player before broadcasting', () => {
    store.dispatch(setSession({
      sessionId: 'session_a',
      sessionCode: 'ABC234',
      hostPlayerId: 'player_host',
      isHost: false,
    }));
    store.dispatch(setLocalPlayer({
      playerId: 'player_a',
      playerName: 'Ava',
    }));

    realtimeService.sendAction({
      type: 'move',
      playerId: 'player_b',
      target: { q: 0, r: 0, s: 0 },
    });

    expect(realtimeService.getDiagnostics()).toHaveLength(1);
    expect(realtimeService.getDiagnostics()[0]).toMatchObject({
      code: 'invalid_action',
      severity: 'warning',
      message: 'Refused to send a local action for another player',
      sessionId: null,
      actionType: 'move',
      playerId: 'player_b',
      details: {
        localPlayerId: 'player_a',
        reason: 'action_player_mismatch',
      },
    });
  });

  it('bounds realtime diagnostics to the newest entries', () => {
    const diagnostics = Array.from({ length: 4 }, (_, index) => createRealtimeDiagnostic({
      id: `diag_${index}`,
      timestamp: `2026-06-09T00:00:0${index}.000Z`,
      code: 'missing_channel',
      severity: 'warning',
      message: `Diagnostic ${index}`,
      sessionId: null,
    }));

    expect(appendRealtimeDiagnostic(diagnostics.slice(0, 3), diagnostics[3], 2)).toEqual([
      diagnostics[2],
      diagnostics[3],
    ]);
  });

  it('normalises thrown errors and primitive realtime failures for diagnostics', () => {
    const error = new Error('network down');
    expect(normaliseRealtimeError(error)).toMatchObject({
      name: 'Error',
      message: 'network down',
    });
    expect(normaliseRealtimeError('timed out')).toEqual({ message: 'timed out' });
  });

  it('builds optional realtime diagnostic export requests', () => {
    const diagnostic = createRealtimeDiagnostic({
      id: 'diag_export',
      timestamp: '2026-06-09T00:00:00.000Z',
      code: 'invalid_action',
      severity: 'warning',
      message: 'Rejected invalid host action',
      sessionId: 'session_a',
      actionType: 'move',
      playerId: 'player_a',
      roundNumber: 2,
      phase: 'interaction',
      details: { reason: 'Move target is not adjacent' },
    });

    expect(createRealtimeDiagnosticRequest(diagnostic)).toBeNull();

    const request = createRealtimeDiagnosticRequest(diagnostic, 'https://observability.example/events');

    expect(request?.url).toBe('https://observability.example/events');
    expect(request?.init).toMatchObject({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      keepalive: true,
    });
    expect(JSON.parse(String(request?.init.body))).toEqual({
      source: 'hex-crowd-game',
      diagnostic,
    });
  });

  it('builds optional session authority gateway requests', () => {
    const request = {
      type: 'createSession' as const,
      sessionCode: 'ABC234',
      hostPlayerId: 'player_host',
      maxPlayers: 30,
      gameConfig: {},
    };

    expect(createSessionAuthorityRequest(request)).toBeNull();

    const authorityRequest = createSessionAuthorityRequest(
      request,
      'https://project.functions.supabase.co/session-authority'
    );

    expect(authorityRequest?.url).toBe('https://project.functions.supabase.co/session-authority');
    expect(authorityRequest?.init).toMatchObject({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(String(authorityRequest?.init.body))).toEqual({
      source: 'hex-crowd-game',
      request,
    });
  });

  it('emits realtime diagnostics as browser events when an event target is available', () => {
    const diagnostic = createRealtimeDiagnostic({
      id: 'diag_event',
      timestamp: '2026-06-09T00:00:00.000Z',
      code: 'missing_channel',
      severity: 'warning',
      message: 'No channel',
      sessionId: null,
    });

    const events: Event[] = [];
    const eventTarget = {
      dispatchEvent: (event: Event) => {
        events.push(event);
        return true;
      },
    };

    expect(emitRealtimeDiagnosticEvent(diagnostic, eventTarget)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(REALTIME_DIAGNOSTIC_EVENT);
    expect((events[0] as CustomEvent<unknown>).detail).toBe(diagnostic);
  });
});

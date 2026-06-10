import { describe, expect, it } from 'vitest';
import {
  applyHostGameAction,
  applyHostMigrationPayload,
  applyPresenceJoinPayload,
  applyPresenceLeavePayload,
  applyStateSyncPayload,
  checkHostActionRateLimit,
  createStateSyncEnvelope,
  findReconnectablePlayer,
  getHostActionRateLimitKey,
  getActiveSessionSummary,
  getJoinSessionError,
  resolvePersistedStateSnapshot,
  resolveReconnectSession,
  selectNextHostId,
  shouldFinalizePlayerDisconnect,
  shouldApplyStateSyncSequence,
  validateHostGameAction,
  validateStateSyncPayload,
  type GameAction,
  type HostActionRateLimitBucket,
  type HostActionRateLimitResult,
  type ReconnectSessionSnapshot,
} from './RealtimeService';
import { store } from '../store/store';
import gameReducer, {
  joinGame,
  startGame,
  togglePlayerReady,
} from '../store/gameSlice';
import type { GameState } from '../store/gameSlice';
import type { WorldState } from '../store/types';
import type { HexTile } from '../utils/hexGrid';

const testTiles: WorldState['tiles'] = {
  '0,0,0': {
    coords: { q: 0, r: 0, s: 0 },
    terrain: 'plains',
    explored: true,
    visible: true,
    fogLevel: 2,
    players: [],
  },
  '1,-1,0': {
    coords: { q: 1, r: -1, s: 0 },
    terrain: 'forest',
    explored: true,
    visible: true,
    fogLevel: 2,
    players: [],
  },
} satisfies Record<string, HexTile>;

const createPlayingGameState = (): GameState => {
  let state = gameReducer(undefined, joinGame({ playerName: 'Ava', playerId: 'player_a' }));
  state = gameReducer(state, joinGame({ playerName: 'Ben', playerId: 'player_b' }));
  state.players
    .filter(player => !player.isReady)
    .forEach(player => {
      state = gameReducer(state, togglePlayerReady({ playerId: player.id }));
    });
  state = gameReducer(state, startGame());

  const next = structuredClone(state) as GameState;
  next.gameMode = 'playing';
  next.currentPhase = 'interaction';
  next.players[0].position = { q: 0, r: 0, s: 0 };
  next.players[1].position = { q: 1, r: -1, s: 0 };
  next.playerStats.player_a.actionPoints = 10;
  next.playerStats.player_a.resources = {
    cloth: 10,
    wood: 10,
    stone: 10,
    water: 10,
    shard: 10,
    gems: 10,
  };
  next.playerStats.player_b.actionPoints = 10;
  next.playerStats.player_b.resources = {
    cloth: 10,
    wood: 10,
    stone: 10,
    water: 10,
    shard: 10,
    gems: 10,
  };

  testTiles['0,0,0'].players = [next.players[0]];
  testTiles['1,-1,0'].players = [next.players[1]];

  return next;
};

const createStartableLobbyState = (): GameState => {
  let state = gameReducer(undefined, joinGame({ playerName: 'Ava', playerId: 'player_a' }));
  state = gameReducer(state, joinGame({ playerName: 'Ben', playerId: 'player_b' }));
  state.players
    .filter(player => !player.isReady)
    .forEach(player => {
      state = gameReducer(state, togglePlayerReady({ playerId: player.id }));
    });
  return state;
};

const createHostContext = (
  isHost = true,
  gameState: GameState = store.getState().game,
  worldState: Pick<WorldState, 'tiles' | 'activeTiles'> = {
    tiles: store.getState().world.tiles,
    activeTiles: store.getState().world.activeTiles,
  }
) => {
  const dispatched: unknown[] = [];
  const audited: GameAction[] = [];
  const rejected: Array<{ action: GameAction; reason: string }> = [];
  const rateLimited: Array<{ action: GameAction; limit: Extract<HostActionRateLimitResult, { allowed: false }> }> = [];
  const effects = {
    broadcasts: 0,
    playerCountUpdates: 0,
    hostLoopStarts: 0,
    hostLoopStops: 0,
  };

  return {
    dispatched,
    audited,
    rejected,
    rateLimited,
    effects,
    context: {
      isHost,
      hostPlayerId: 'player_a',
      gameState,
      tiles: worldState.tiles,
      activeTiles: worldState.activeTiles,
      dispatch: (action: unknown) => {
        dispatched.push(action);
      },
      broadcastStateSync: () => {
        effects.broadcasts += 1;
      },
      updateSessionPlayerCount: () => {
        effects.playerCountUpdates += 1;
      },
      startHostLoop: () => {
        effects.hostLoopStarts += 1;
      },
      stopHostLoop: () => {
        effects.hostLoopStops += 1;
      },
      queueTurnActionAudit: (action: GameAction) => {
        audited.push(action);
      },
      rateLimitAction: undefined as ((action: GameAction) => HostActionRateLimitResult) | undefined,
      recordRejectedAction: (action: GameAction, reason: string) => {
        rejected.push({ action, reason });
      },
      recordRateLimitedAction: (
        action: GameAction,
        limit: Extract<HostActionRateLimitResult, { allowed: false }>
      ) => {
        rateLimited.push({ action, limit });
      },
    },
  };
};

const getActionType = (action: unknown) => {
  if (typeof action === 'object' && action !== null && 'type' in action) {
    return action.type;
  }
  return null;
};

describe('host realtime action processing', () => {
  it('ignores remote actions when the local client is not host', () => {
    const harness = createHostContext(false);
    const handled = applyHostGameAction({
      type: 'ready',
      playerId: 'player_a',
    }, harness.context);

    expect(handled).toBe(false);
    expect(harness.dispatched).toEqual([]);
    expect(harness.audited).toEqual([]);
    expect(harness.effects).toEqual({
      broadcasts: 0,
      playerCountUpdates: 0,
      hostLoopStarts: 0,
      hostLoopStops: 0,
    });
  });

  it('applies join actions host-side and updates sync, count, and audit effects', () => {
    const harness = createHostContext();
    const action: GameAction = {
      type: 'join',
      playerName: 'Ava',
      playerId: 'player_a',
    };

    const handled = applyHostGameAction(action, harness.context);

    expect(handled).toBe(true);
    expect(getActionType(harness.dispatched[0])).toBe('game/joinGame');
    expect(harness.dispatched[0]).toMatchObject({
      payload: { playerName: 'Ava', playerId: 'player_a' },
    });
    expect(harness.effects.broadcasts).toBe(1);
    expect(harness.effects.playerCountUpdates).toBe(1);
    expect(harness.audited).toEqual([action]);
  });

  it('routes movement through the host with authoritative world tiles', () => {
    const gameState = createPlayingGameState();
    const harness = createHostContext(true, gameState, {
      tiles: testTiles,
      activeTiles: ['0,0,0', '1,-1,0'],
    });
    const action: GameAction = {
      type: 'move',
      playerId: 'player_a',
      target: { q: 1, r: -1, s: 0 },
    };

    applyHostGameAction(action, harness.context);

    expect(getActionType(harness.dispatched[0])).toBe('game/movePlayer');
    expect(harness.dispatched[0]).toMatchObject({
      payload: {
        playerId: 'player_a',
        target: { q: 1, r: -1, s: 0 },
      },
    });
    expect(harness.effects.broadcasts).toBe(1);
    expect(harness.audited).toEqual([action]);
  });

  it('starts and stops host loops for game lifecycle actions', () => {
    const harness = createHostContext(true, createStartableLobbyState());

    applyHostGameAction({ type: 'start', playerId: 'player_a' }, harness.context);
    harness.context.gameState = {
      ...harness.context.gameState,
      gameMode: 'playing',
    };
    applyHostGameAction({ type: 'endGame', playerId: 'player_a' }, harness.context);

    expect(harness.dispatched.map(getActionType)).toEqual([
      'game/startGame',
      'game/endGame',
    ]);
    expect(harness.effects.broadcasts).toBe(2);
    expect(harness.effects.hostLoopStarts).toBe(1);
    expect(harness.effects.hostLoopStops).toBe(1);
    expect(harness.audited.map(action => action.type)).toEqual(['start', 'endGame']);
  });

  it('rejects host-control actions from non-host actors', () => {
    const harness = createHostContext(true, createStartableLobbyState());

    const handled = applyHostGameAction({
      type: 'start',
      playerId: 'player_b',
    }, harness.context);

    expect(handled).toBe(false);
    expect(harness.dispatched).toEqual([]);
    expect(harness.effects.broadcasts).toBe(0);
    expect(harness.audited).toEqual([]);
    expect(harness.rejected).toHaveLength(1);
    expect(harness.rejected[0].reason).toBe('Only the host can perform this action');
  });

  it('rate-limits host-routed actions before dispatch, sync, or audit effects', () => {
    const buckets = new Map<string, HostActionRateLimitBucket>();
    const gameState = createPlayingGameState();
    const harness = createHostContext(true, gameState, {
      tiles: testTiles,
      activeTiles: ['0,0,0', '1,-1,0'],
    });
    const action: GameAction = {
      type: 'move',
      playerId: 'player_a',
      target: { q: 1, r: -1, s: 0 },
    };
    harness.context.rateLimitAction = limitedAction => checkHostActionRateLimit(
      buckets,
      limitedAction,
      1000,
      1,
      5000
    );

    expect(applyHostGameAction(action, harness.context)).toBe(true);
    expect(applyHostGameAction(action, harness.context)).toBe(false);

    expect(harness.dispatched.map(getActionType)).toEqual(['game/movePlayer']);
    expect(harness.effects.broadcasts).toBe(1);
    expect(harness.audited).toEqual([action]);
    expect(harness.rateLimited).toHaveLength(1);
    expect(harness.rateLimited[0].limit).toMatchObject({
      key: 'player:player_a',
      scope: 'actor',
      count: 1,
      maxActions: 1,
      windowMs: 5000,
      retryAfterMs: 5000,
    });
  });

  it('rate-limits session-wide action floods even when actor IDs differ', () => {
    const buckets = new Map<string, HostActionRateLimitBucket>();
    const harness = createHostContext();
    harness.context.rateLimitAction = limitedAction => checkHostActionRateLimit(
      buckets,
      limitedAction,
      1000,
      10,
      5000,
      2
    );

    expect(applyHostGameAction({
      type: 'join',
      playerName: 'Ava',
      playerId: 'player_a',
    }, harness.context)).toBe(true);
    expect(applyHostGameAction({
      type: 'join',
      playerName: 'Ben',
      playerId: 'player_b',
    }, harness.context)).toBe(true);
    expect(applyHostGameAction({
      type: 'join',
      playerName: 'Cara',
      playerId: 'player_c',
    }, harness.context)).toBe(false);

    expect(harness.dispatched.map(getActionType)).toEqual([
      'game/joinGame',
      'game/joinGame',
    ]);
    expect(harness.audited.map(action => action.type)).toEqual(['join', 'join']);
    expect(harness.rateLimited).toHaveLength(1);
    expect(harness.rateLimited[0].limit).toMatchObject({
      key: 'session:all',
      scope: 'session',
      count: 2,
      maxActions: 2,
      windowMs: 5000,
      retryAfterMs: 5000,
    });
  });

  it('tracks host action rate limits by actor and resets after the window', () => {
    const buckets = new Map<string, HostActionRateLimitBucket>();
    const action: GameAction = {
      type: 'ready',
      playerId: 'player_a',
    };

    expect(getHostActionRateLimitKey(action)).toBe('player:player_a');
    expect(checkHostActionRateLimit(buckets, action, 1000, 2, 5000)).toMatchObject({
      allowed: true,
      key: 'player:player_a',
      scope: 'actor',
      count: 1,
    });
    expect(checkHostActionRateLimit(buckets, action, 1200, 2, 5000)).toMatchObject({
      allowed: true,
      count: 2,
    });
    expect(checkHostActionRateLimit(buckets, action, 1300, 2, 5000)).toMatchObject({
      allowed: false,
      retryAfterMs: 4700,
    });
    expect(checkHostActionRateLimit(buckets, action, 6000, 2, 5000)).toMatchObject({
      allowed: true,
      count: 1,
    });
  });

  it('rejects invalid host actions before dispatch, sync, or audit effects', () => {
    const gameState = createPlayingGameState();
    gameState.playerStats.player_a.actionPoints = 0;
    const harness = createHostContext(true, gameState, {
      tiles: testTiles,
      activeTiles: ['0,0,0', '1,-1,0'],
    });

    const handled = applyHostGameAction({
      type: 'move',
      playerId: 'player_a',
      target: { q: 1, r: -1, s: 0 },
    }, harness.context);

    expect(handled).toBe(false);
    expect(harness.dispatched).toEqual([]);
    expect(harness.effects.broadcasts).toBe(0);
    expect(harness.audited).toEqual([]);
    expect(harness.rejected).toHaveLength(1);
    expect(harness.rejected[0].reason).toBe('Player has no action points');
  });

  it('rejects negative trade resources before they can mint resources on accept', () => {
    const gameState = createPlayingGameState();
    gameState.currentPhase = 'bartering';

    const result = validateHostGameAction({
      type: 'proposeTrade',
      payload: {
        fromPlayerId: 'player_a',
        toPlayerId: 'player_b',
        offeredResources: { wood: -10 },
        requestedResources: { stone: 1 },
      },
    }, gameState, {
      tiles: testTiles,
      activeTiles: ['0,0,0', '1,-1,0'],
    });

    expect(result).toEqual({
      valid: false,
      reason: 'Trade resources must be non-negative integers',
    });
  });

  it('resolves reconnect players by durable id before falling back to name', () => {
    const gameState = {
      ...store.getState().game,
      players: [
        { ...store.getState().game.players[0], id: 'player_a', name: 'Ava' },
        { ...store.getState().game.players[0], id: 'player_b', name: 'Ben' },
      ],
    };

    expect(findReconnectablePlayer(gameState, 'player_b', 'Ava')?.id).toBe('player_b');
    expect(findReconnectablePlayer(gameState, 'missing', 'Ben')?.id).toBe('player_b');
    expect(findReconnectablePlayer(gameState, 'missing', 'Cara')).toBeNull();
  });

  it('applies state sync payloads only to non-host clients', () => {
    const clientDispatches: unknown[] = [];
    const hostDispatches: unknown[] = [];
    const payload = {
      gameState: store.getState().game,
      worldState: store.getState().world,
    };

    expect(applyStateSyncPayload(payload, false, action => clientDispatches.push(action))).toBe(true);
    expect(applyStateSyncPayload(payload, true, action => hostDispatches.push(action))).toBe(false);

    expect(clientDispatches.map(getActionType)).toEqual([
      'game/syncGameState',
      'world/syncWorldState',
    ]);
    expect(hostDispatches).toEqual([]);
  });

  it('builds sequenced state sync envelopes with deterministic state hashes', () => {
    const state = store.getState();
    const envelope = createStateSyncEnvelope(
      state.game,
      state.world,
      7,
      'session_a',
      '2026-06-09T12:00:00.000Z'
    );

    expect(envelope).toMatchObject({
      gameState: state.game,
      worldState: state.world,
      sessionId: 'session_a',
      sequence: 7,
      sentAt: '2026-06-09T12:00:00.000Z',
    });
    expect(envelope.stateHash).toBe(JSON.stringify({
      gameState: state.game,
      worldState: state.world,
    }));
  });

  it('applies sequenced state sync payloads only when they are newer', () => {
    const dispatches: unknown[] = [];
    const appliedSequences: number[] = [];
    const rejectedReasons: string[] = [];
    const state = store.getState();
    const freshPayload = createStateSyncEnvelope(state.game, state.world, 4, 'session_a');
    const stalePayload = createStateSyncEnvelope(state.game, state.world, 3, 'session_a');

    expect(applyStateSyncPayload(
      freshPayload,
      false,
      action => dispatches.push(action),
      reason => rejectedReasons.push(reason),
      3,
      sequence => appliedSequences.push(sequence),
      'session_a'
    )).toBe(true);

    expect(applyStateSyncPayload(
      stalePayload,
      false,
      action => dispatches.push(action),
      reason => rejectedReasons.push(reason),
      4,
      sequence => appliedSequences.push(sequence),
      'session_a'
    )).toBe(false);

    expect(dispatches.map(getActionType)).toEqual([
      'game/syncGameState',
      'world/syncWorldState',
    ]);
    expect(appliedSequences).toEqual([4]);
    expect(rejectedReasons).toEqual(['State sync sequence 3 is not newer than 4']);
  });

  it('rejects sequenced state sync envelopes from another session', () => {
    const dispatches: unknown[] = [];
    const rejectedReasons: string[] = [];
    const state = store.getState();
    const payload = createStateSyncEnvelope(state.game, state.world, 1, 'session_b');

    expect(applyStateSyncPayload(
      payload,
      false,
      action => dispatches.push(action),
      reason => rejectedReasons.push(reason),
      null,
      undefined,
      'session_a'
    )).toBe(false);

    expect(dispatches).toEqual([]);
    expect(rejectedReasons).toEqual(['State sync session session_b does not match session_a']);
  });

  it('rejects malformed sequenced state sync envelopes before dispatching', () => {
    const dispatches: unknown[] = [];
    const rejectedReasons: string[] = [];
    const state = store.getState();

    expect(applyStateSyncPayload(
      {
        gameState: state.game,
        worldState: state.world,
        sequence: 1,
        sentAt: '2026-06-09T12:00:00.000Z',
        stateHash: 'hash-without-session',
      },
      false,
      action => dispatches.push(action),
      reason => rejectedReasons.push(reason)
    )).toBe(false);

    expect(dispatches).toEqual([]);
    expect(rejectedReasons).toEqual(['State sync envelope is malformed']);
  });

  it('keeps legacy unsequenced state sync payloads compatible', () => {
    const dispatches: unknown[] = [];
    const payload = {
      gameState: store.getState().game,
      worldState: store.getState().world,
    };

    expect(applyStateSyncPayload(
      payload,
      false,
      action => dispatches.push(action),
      undefined,
      99
    )).toBe(true);

    expect(dispatches.map(getActionType)).toEqual([
      'game/syncGameState',
      'world/syncWorldState',
    ]);
  });

  it('checks state sync sequence monotonicity', () => {
    expect(shouldApplyStateSyncSequence(1, null)).toBe(true);
    expect(shouldApplyStateSyncSequence(5, 4)).toBe(true);
    expect(shouldApplyStateSyncSequence(4, 4)).toBe(false);
    expect(shouldApplyStateSyncSequence(3, 4)).toBe(false);
  });

  it('rejects malformed state sync payloads before dispatching to clients', () => {
    const dispatches: unknown[] = [];
    const rejectedReasons: string[] = [];
    const payload = {
      gameState: {
        ...store.getState().game,
        currentPhase: 'impossible_phase',
      },
      worldState: store.getState().world,
    };

    expect(applyStateSyncPayload(
      payload,
      false,
      action => dispatches.push(action),
      reason => rejectedReasons.push(reason)
    )).toBe(false);

    expect(dispatches).toEqual([]);
    expect(rejectedReasons).toEqual(['Game state phase is invalid']);
  });

  it('validates state sync world tile references', () => {
    const payload = {
      gameState: store.getState().game,
      worldState: {
        ...store.getState().world,
        activeTiles: ['missing-tile'],
      },
    };

    expect(validateStateSyncPayload(payload)).toEqual({
      valid: false,
      reason: 'World state active tile missing-tile does not exist',
    });
  });

  it('applies host migration and starts the host loop only after local promotion', () => {
    const dispatches: unknown[] = [];
    let starts = 0;

    const promoted = applyHostMigrationPayload(
      { sessionId: 'session_a', newHostId: 'player_a' },
      action => dispatches.push(action),
      () => {
        starts += 1;
      },
      () => true,
      'session_a'
    );

    const notPromoted = applyHostMigrationPayload(
      { sessionId: 'session_a', newHostId: 'player_b' },
      action => dispatches.push(action),
      () => {
        starts += 1;
      },
      () => false,
      'session_a'
    );

    expect(promoted).toBe(true);
    expect(notPromoted).toBe(false);
    expect(starts).toBe(1);
    expect(dispatches.map(getActionType)).toEqual([
      'session/promoteToHost',
      'session/promoteToHost',
    ]);
  });

  it('rejects host migration broadcasts from another session', () => {
    const dispatches: unknown[] = [];
    const rejectedReasons: string[] = [];

    expect(applyHostMigrationPayload(
      { sessionId: 'session_b', newHostId: 'player_a' },
      action => dispatches.push(action),
      () => undefined,
      () => true,
      'session_a',
      reason => rejectedReasons.push(reason)
    )).toBe(false);

    expect(dispatches).toEqual([]);
    expect(rejectedReasons).toEqual(['Host migration session session_b does not match session_a']);
  });

  it('applies presence joins and leaves through the channel lifecycle adapters', () => {
    const dispatches: unknown[] = [];
    const disconnected: string[] = [];
    const cancelled: string[] = [];

    const joined = applyPresenceJoinPayload([
      { playerId: 'player_b', playerName: 'Ben' },
      { playerId: 'player_c', playerName: 'Cara' },
    ], action => dispatches.push(action), playerId => cancelled.push(playerId));

    const left = applyPresenceLeavePayload([
      { playerId: 'player_b', playerName: 'Ben' },
    ], action => dispatches.push(action), playerId => disconnected.push(playerId));

    expect(joined).toBe(2);
    expect(left).toBe(1);
    expect(dispatches.map(getActionType)).toEqual([
      'session/addConnectedPlayer',
      'session/addConnectedPlayer',
      'session/removeConnectedPlayer',
    ]);
    expect(cancelled).toEqual(['player_b', 'player_c']);
    expect(disconnected).toEqual(['player_b']);
  });

  it('can defer presence leave finalization until a disconnect timeout fires', () => {
    const dispatches: unknown[] = [];
    const disconnected: string[] = [];
    const scheduled: Array<{ playerId: string; finalize: () => void }> = [];

    const left = applyPresenceLeavePayload([
      { playerId: 'player_b', playerName: 'Ben' },
    ], action => dispatches.push(action), playerId => disconnected.push(playerId), (playerId, finalize) => {
      scheduled.push({ playerId, finalize });
    });

    expect(left).toBe(1);
    expect(dispatches.map(getActionType)).toEqual(['session/removeConnectedPlayer']);
    expect(disconnected).toEqual([]);
    expect(scheduled.map(entry => entry.playerId)).toEqual(['player_b']);

    scheduled[0].finalize();

    expect(disconnected).toEqual(['player_b']);
  });

  it('only finalizes player disconnects while the player remains absent', () => {
    expect(shouldFinalizePlayerDisconnect('player_b', ['player_a', 'player_c'])).toBe(true);
    expect(shouldFinalizePlayerDisconnect('player_b', ['player_a', 'player_b'])).toBe(false);
  });

  it('selects deterministic host migration candidates', () => {
    expect(selectNextHostId(['player_c', 'player_a', 'player_b'], 'player_c')).toBe('player_a');
    expect(selectNextHostId(['player_c'], 'player_c')).toBeNull();
  });

  it('validates join-session snapshots before channel join', () => {
    const baseSession = {
      id: 'session_id',
      host_player_id: 'host_id',
      game_mode: 'lobby',
      player_count: 1,
      max_players: 30,
    };

    expect(getJoinSessionError(baseSession)).toBeNull();
    expect(getJoinSessionError(null)).toBe('Session not found');
    expect(getJoinSessionError(baseSession, true)).toBe('Session not found');
    expect(getJoinSessionError({
      ...baseSession,
      game_mode: 'ended',
    })).toBe('Game has ended');
    expect(getJoinSessionError({
      ...baseSession,
      player_count: 30,
      max_players: 30,
    })).toBe('Session is full');
  });

  it('summarises active sessions without exposing stored state payloads', () => {
    const state = store.getState();

    expect(getActiveSessionSummary({
      game_mode: 'playing',
      player_count: 12,
      game_state: state.game,
      world_state: state.world,
    })).toEqual({
      gameMode: 'playing',
      playerCount: 12,
      hasState: true,
      stateStatus: 'valid',
    });

    expect(getActiveSessionSummary({
      game_mode: 'lobby',
      player_count: 2,
      game_state: null,
      world_state: null,
    })).toEqual({
      gameMode: 'lobby',
      playerCount: 2,
      hasState: false,
      stateStatus: 'none',
    });

    expect(getActiveSessionSummary({
      game_mode: 'playing',
      player_count: 2,
      game_state: {
        ...state.game,
        currentPhase: 'corrupt_phase',
      } as GameState,
      world_state: state.world,
    })).toEqual({
      gameMode: 'playing',
      playerCount: 2,
      hasState: true,
      stateStatus: 'invalid',
      stateError: 'Saved game state is invalid: Game state phase is invalid',
    });
  });

  it('resolves persisted reconnect snapshots into restorable state', () => {
    const baseGameState = createPlayingGameState();
    const snapshot: ReconnectSessionSnapshot = {
      id: 'session_id',
      host_player_id: 'host_id',
      game_mode: 'playing',
      game_state: baseGameState,
      world_state: store.getState().world,
    };

    const resolved = resolveReconnectSession(snapshot, 'player_a', 'Wrong Name');

    expect(resolved.error).toBeNull();
    expect(resolved.player?.id).toBe('player_a');
    expect(resolved.gameState).toBe(baseGameState);
    expect(resolved.worldState).toBe(store.getState().world);
  });

  it('validates persisted state snapshots before restore', () => {
    const state = store.getState();

    expect(resolvePersistedStateSnapshot(state.game, state.world)).toEqual({
      error: null,
      gameState: state.game,
      worldState: state.world,
    });

    expect(resolvePersistedStateSnapshot(null, state.world)).toEqual({
      error: 'No saved game state',
    });

    expect(resolvePersistedStateSnapshot(
      {
        ...state.game,
        currentPhase: 'corrupt_phase',
      } as GameState,
      state.world
    )).toEqual({
      error: 'Saved game state is invalid: Game state phase is invalid',
    });
  });

  it('rejects invalid reconnect snapshots with user-facing reasons', () => {
    const gameState = store.getState().game;
    const worldState = store.getState().world;
    const baseSnapshot: ReconnectSessionSnapshot = {
      id: 'session_id',
      host_player_id: 'host_id',
      game_mode: 'playing',
      game_state: gameState,
      world_state: worldState,
    };

    expect(resolveReconnectSession(null, 'player_a', 'Ava').error).toBe('Session not found');
    expect(resolveReconnectSession(baseSnapshot, 'player_a', 'Ava', true).error).toBe('Session not found');
    expect(resolveReconnectSession({
      ...baseSnapshot,
      game_mode: 'ended',
    }, 'player_a', 'Ava').error).toBe('Game has ended');
    expect(resolveReconnectSession({
      ...baseSnapshot,
      game_state: null,
    }, 'player_a', 'Ava').error).toBe('No saved game state');
    expect(resolveReconnectSession({
      ...baseSnapshot,
      game_state: {
        ...gameState,
        currentPhase: 'corrupt_phase',
      } as GameState,
    }, 'player_a', 'Ava').error).toBe('Saved game state is invalid: Game state phase is invalid');
    expect(resolveReconnectSession(baseSnapshot, 'missing', 'Unknown').error).toBe('Player not found in session');
  });
});

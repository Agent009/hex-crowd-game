import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { areAdjacent, coordsToKey, cubeDistance } from '../utils/hexGrid';
import { isCraftable } from '../utils/utils';
import {
  isTestMode,
  maxPlayers,
  requiredPlayersPerTeam,
  requiredTeams,
  terrainData,
} from '../data/gameData';
import { itemDatabase } from '../data/harvestData';
import {
  heroClasses,
  HERO_RECRUIT_AP_COST,
  HERO_RECRUIT_RESOURCE_COST,
  MAX_HEROES_PER_PLAYER,
} from '../data/heroesData';
import { skillsData } from '../data/skillsData';
import { spellsData } from '../data/spellsData';
import { armyUnitCount, MAX_ARMY_SIZE, unitsData } from '../data/unitsData';
import { COMBAT_AP_COST } from '../game/combat';
import { store } from '../store/store';
import {
  setSession,
  setLocalPlayer,
  setConnectionStatus,
  addConnectedPlayer,
  removeConnectedPlayer,
  promoteToHost,
  setSessionError,
  clearSession,
} from '../store/sessionSlice';
import {
  joinGame,
  leaveGame,
  togglePlayerReady,
  startGame,
  movePlayer,
  harvestFromTile,
  craftItem,
  activateItemEffect,
  proposeTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  recruitHero,
  restHero,
  learnSkill,
  castSpell,
  recruitUnit,
  initiateCombat,
  syncGameState,
  updatePhaseTimer,
  forceNextPhase,
  endGame,
  phaseOrder,
} from '../store/gameSlice';
import { syncWorldState } from '../store/worldSlice';
import { applyTerraformItem, applyLeechItem } from '../store/itemThunks';
import type { GameState } from '../store/gameSlice';
import type { WorldState } from '../store/types';

export type GameAction =
  | { type: 'join'; playerName: string; playerId: string }
  | { type: 'leave'; playerId: string }
  | { type: 'ready'; playerId: string }
  | { type: 'start'; playerId: string }
  | { type: 'move'; playerId: string; target: { q: number; r: number; s: number } }
  | { type: 'harvest'; payload: Parameters<typeof harvestFromTile>[0] }
  | { type: 'craft'; playerId: string; itemId: string }
  | { type: 'useItem'; playerId: string; itemId: string }
  | { type: 'proposeTrade'; payload: Parameters<typeof proposeTrade>[0] }
  | { type: 'acceptTrade'; payload: Parameters<typeof acceptTrade>[0] }
  | { type: 'rejectTrade'; payload: Parameters<typeof rejectTrade>[0] }
  | { type: 'cancelTrade'; payload: Parameters<typeof cancelTrade>[0] }
  | { type: 'recruitHero'; playerId: string; classId: string }
  | { type: 'restHero'; playerId: string }
  | { type: 'learnSkill'; playerId: string; skillId: string }
  | { type: 'castSpell'; payload: Parameters<typeof castSpell>[0] }
  | { type: 'recruitUnit'; playerId: string; unitId: string }
  | { type: 'initiateCombat'; attackerId: string; defenderId: string }
  | { type: 'forceNextPhase'; playerId: string }
  | { type: 'endGame'; playerId: string };

export type RealtimeDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface RealtimeDiagnostic {
  id: string;
  code:
    | 'missing_channel'
    | 'broadcast_failed'
    | 'state_sync_failed'
    | 'state_sync_payload_large'
    | 'invalid_state_sync'
    | 'invalid_action'
    | 'action_rate_limited'
    | 'persistence_save_failed'
    | 'turn_audit_failed'
    | 'player_count_update_failed'
    | 'player_disconnect_timeout'
    | 'disconnect_update_failed';
  severity: RealtimeDiagnosticSeverity;
  message: string;
  timestamp: string;
  sessionId: string | null;
  actionType?: GameAction['type'];
  playerId?: string | null;
  roundNumber?: number;
  phase?: GameState['currentPhase'];
  details?: Record<string, unknown>;
}

type RealtimeDiagnosticInput = Omit<RealtimeDiagnostic, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};

type SessionAuthorityRequest =
  | {
      type: 'createSession';
      sessionCode: string;
      hostPlayerId: string;
      maxPlayers: number;
      gameConfig: Record<string, unknown>;
    }
  | {
      type: 'claimHost';
      sessionId: string;
      hostPlayerId: string;
    }
  | {
      type: 'saveState';
      sessionId: string;
      hostPlayerId: string;
      hostToken: string;
      gameState: GameState;
      worldState: WorldState;
    }
  | {
      type: 'recordAction';
      sessionId: string;
      hostPlayerId: string;
      hostToken: string;
      roundNumber: number;
      phase: GameState['currentPhase'];
      actionType: GameAction['type'];
      playerId: string | null;
      actionData: GameAction;
    }
  | {
      type: 'updatePlayerCount';
      sessionId: string;
      hostPlayerId: string;
      hostToken: string;
      playerCount: number;
    }
  | {
      type: 'markEnded';
      sessionId: string;
      hostPlayerId: string;
      hostToken: string;
    };

type SessionAuthorityResponse =
  | { ok: true; sessionId: string; hostToken: string }
  | { ok: true };

export const createRealtimeDiagnostic = (
  input: RealtimeDiagnosticInput
): RealtimeDiagnostic => ({
  ...input,
  id: input.id ?? `rt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  timestamp: input.timestamp ?? new Date().toISOString(),
});

export const appendRealtimeDiagnostic = (
  diagnostics: readonly RealtimeDiagnostic[],
  diagnostic: RealtimeDiagnostic,
  maxEntries = 50
): RealtimeDiagnostic[] => {
  const next = [...diagnostics, diagnostic];
  return next.slice(Math.max(next.length - maxEntries, 0));
};

export const normaliseRealtimeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return error as Record<string, unknown>;
  }

  return { message: String(error) };
};

export const REALTIME_DIAGNOSTIC_EVENT = 'hex:realtime-diagnostic';

export const createRealtimeDiagnosticRequest = (
  diagnostic: RealtimeDiagnostic,
  endpoint?: string
): { url: string; init: RequestInit } | null => {
  if (!endpoint?.trim()) return null;

  return {
    url: endpoint,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'hex-crowd-game',
        diagnostic,
      }),
      keepalive: true,
    },
  };
};

export const emitRealtimeDiagnosticEvent = (
  diagnostic: RealtimeDiagnostic,
  eventTarget: Pick<EventTarget, 'dispatchEvent'> | null = typeof window === 'undefined' ? null : window
): boolean => {
  if (!eventTarget || typeof CustomEvent === 'undefined') return false;

  eventTarget.dispatchEvent(new CustomEvent(REALTIME_DIAGNOSTIC_EVENT, {
    detail: diagnostic,
  }));
  return true;
};

const getRealtimeDiagnosticsEndpoint = (): string | undefined =>
  import.meta.env.VITE_REALTIME_DIAGNOSTICS_ENDPOINT as string | undefined;

const getSessionAuthorityEndpoint = (): string | undefined =>
  import.meta.env.VITE_SESSION_AUTHORITY_ENDPOINT as string | undefined;

const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const PLAYER_DISCONNECT_GRACE_MS = parsePositiveInteger(
  import.meta.env.VITE_PLAYER_DISCONNECT_GRACE_MS,
  10000
);

export const STATE_SYNC_WARN_BYTES = parsePositiveInteger(
  import.meta.env.VITE_STATE_SYNC_WARN_BYTES,
  200000
);

export const STATE_SYNC_WARN_MIN_INTERVAL_MS = parsePositiveInteger(
  import.meta.env.VITE_STATE_SYNC_WARN_MIN_INTERVAL_MS,
  30000
);

export const HOST_ACTION_RATE_LIMIT_MAX_ACTIONS = parsePositiveInteger(
  import.meta.env.VITE_HOST_ACTION_RATE_LIMIT_MAX_ACTIONS,
  20
);

export const HOST_ACTION_RATE_LIMIT_SESSION_MAX_ACTIONS = parsePositiveInteger(
  import.meta.env.VITE_HOST_ACTION_RATE_LIMIT_SESSION_MAX_ACTIONS,
  60
);

export const HOST_ACTION_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
  import.meta.env.VITE_HOST_ACTION_RATE_LIMIT_WINDOW_MS,
  1000
);

const postRealtimeDiagnostic = async (
  diagnostic: RealtimeDiagnostic,
  fetchImpl: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch
): Promise<boolean> => {
  const request = createRealtimeDiagnosticRequest(diagnostic, getRealtimeDiagnosticsEndpoint());
  if (!request || !fetchImpl) return false;

  await fetchImpl(request.url, request.init);
  return true;
};

export const createSessionAuthorityRequest = (
  request: SessionAuthorityRequest,
  endpoint?: string
): { url: string; init: RequestInit } | null => {
  if (!endpoint?.trim()) return null;

  return {
    url: endpoint,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'hex-crowd-game',
        request,
      }),
    },
  };
};

const postSessionAuthorityRequest = async <T extends SessionAuthorityResponse>(
  request: SessionAuthorityRequest,
  fetchImpl: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch
): Promise<T | null> => {
  const authorityRequest = createSessionAuthorityRequest(request, getSessionAuthorityEndpoint());
  if (!authorityRequest || !fetchImpl) return null;

  const response = await fetchImpl(authorityRequest.url, authorityRequest.init);
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || `Session authority request failed with status ${response.status}`);
  }

  return await response.json() as T;
};

export const getGameActionAuditPlayerId = (action: GameAction): string | null => {
  switch (action.type) {
    case 'join':
    case 'leave':
    case 'ready':
    case 'move':
    case 'craft':
    case 'useItem':
    case 'recruitHero':
    case 'restHero':
    case 'learnSkill':
    case 'recruitUnit':
      return action.playerId;
    case 'harvest':
      return action.payload.playerId;
    case 'proposeTrade':
      return action.payload.fromPlayerId;
    case 'acceptTrade':
      return action.payload.acceptingPlayerId;
    case 'rejectTrade':
      return action.payload.rejectingPlayerId;
    case 'cancelTrade':
      return action.payload.cancellingPlayerId;
    case 'castSpell':
      return action.payload.playerId;
    case 'initiateCombat':
      return action.attackerId;
    case 'start':
    case 'forceNextPhase':
    case 'endGame':
      return action.playerId;
  }
};

export const canSendLocalGameAction = (
  action: GameAction,
  localPlayerId: string | null | undefined
): boolean => {
  const actionPlayerId = getGameActionAuditPlayerId(action);
  return !actionPlayerId || !localPlayerId || actionPlayerId === localPlayerId;
};

export const createPersistedStateHash = (
  gameState: GameState,
  worldState: WorldState
): string => JSON.stringify({ gameState, worldState });

export const shouldBroadcastStateSync = (
  nextStateHash: string,
  lastBroadcastStateHash: string | null
): boolean => nextStateHash !== lastBroadcastStateHash;

export const measureJsonPayloadBytes = (payload: unknown): number => (
  new TextEncoder().encode(JSON.stringify(payload)).length
);

export const shouldWarnStateSyncPayloadSize = (
  payloadBytes: number,
  warnBytes: number
): boolean => payloadBytes > warnBytes;

export const shouldRecordStateSyncPayloadWarning = (
  payloadBytes: number,
  warnBytes: number,
  lastWarningAtMs: number | null,
  minIntervalMs: number,
  nowMs: number
): boolean => (
  shouldWarnStateSyncPayloadSize(payloadBytes, warnBytes)
  && (lastWarningAtMs === null || nowMs - lastWarningAtMs >= minIntervalMs)
);

export type HostActionRateLimitBucket = {
  windowStartedAtMs: number;
  count: number;
};

export type HostActionRateLimitResult =
  | { allowed: true; key: string; scope: 'actor' | 'session'; count: number; maxActions: number; windowMs: number }
  | {
      allowed: false;
      key: string;
      scope: 'actor' | 'session';
      count: number;
      maxActions: number;
      windowMs: number;
      retryAfterMs: number;
    };

export const HOST_ACTION_RATE_LIMIT_SESSION_KEY = 'session:all';

export const getHostActionRateLimitKey = (action: GameAction): string => {
  const playerId = getGameActionAuditPlayerId(action);
  return playerId ? `player:${playerId}` : `session:${action.type}`;
};

const checkRateLimitBucket = (
  buckets: Map<string, HostActionRateLimitBucket>,
  key: string,
  scope: 'actor' | 'session',
  nowMs: number,
  maxActions: number,
  windowMs: number
): HostActionRateLimitResult => {
  const existing = buckets.get(key);

  if (!existing || nowMs - existing.windowStartedAtMs >= windowMs) {
    buckets.set(key, { windowStartedAtMs: nowMs, count: 1 });
    return { allowed: true, key, scope, count: 1, maxActions, windowMs };
  }

  if (existing.count >= maxActions) {
    return {
      allowed: false,
      key,
      scope,
      count: existing.count,
      maxActions,
      windowMs,
      retryAfterMs: Math.max(existing.windowStartedAtMs + windowMs - nowMs, 0),
    };
  }

  existing.count += 1;
  return { allowed: true, key, scope, count: existing.count, maxActions, windowMs };
};

export const checkHostActionRateLimit = (
  buckets: Map<string, HostActionRateLimitBucket>,
  action: GameAction,
  nowMs: number,
  maxActions: number = HOST_ACTION_RATE_LIMIT_MAX_ACTIONS,
  windowMs: number = HOST_ACTION_RATE_LIMIT_WINDOW_MS,
  sessionMaxActions: number = HOST_ACTION_RATE_LIMIT_SESSION_MAX_ACTIONS
): HostActionRateLimitResult => {
  const sessionLimit = checkRateLimitBucket(
    buckets,
    HOST_ACTION_RATE_LIMIT_SESSION_KEY,
    'session',
    nowMs,
    sessionMaxActions,
    windowMs
  );
  if (!sessionLimit.allowed) return sessionLimit;

  return checkRateLimitBucket(
    buckets,
    getHostActionRateLimitKey(action),
    'actor',
    nowMs,
    maxActions,
    windowMs
  );
};

export const findReconnectablePlayer = (
  gameState: GameState,
  playerId: string,
  playerName: string
) => (
  gameState.players.find(p => p.id === playerId)
  ?? gameState.players.find(p => p.name === playerName)
  ?? null
);

export type HostActionValidation =
  | { valid: true }
  | { valid: false; reason: string };

const validAction: HostActionValidation = { valid: true };
const invalidAction = (reason: string): HostActionValidation => ({ valid: false, reason });

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasValidCubeCoords = (coords: unknown): coords is { q: number; r: number; s: number } => {
  if (!isRecord(coords)) return false;
  const { q, r, s } = coords;
  return typeof q === 'number'
    && typeof r === 'number'
    && typeof s === 'number'
    && Number.isInteger(q)
    && Number.isInteger(r)
    && Number.isInteger(s)
    && q + r + s === 0;
};

const isValidGameMode = (mode: unknown): mode is GameState['gameMode'] => (
  mode === 'lobby' || mode === 'playing' || mode === 'ended'
);

const isValidGamePhase = (phase: unknown): phase is GameState['currentPhase'] => (
  typeof phase === 'string' && phaseOrder.includes(phase as GameState['currentPhase'])
);

const isValidTerrain = (terrain: unknown): boolean => (
  typeof terrain === 'string' && terrain in terrainData
);

const hasValidResourceMap = (resources: Record<string, number>): boolean => (
  Object.values(resources).every(amount => Number.isInteger(amount) && amount >= 0)
);

const hasAnyPositiveResource = (resources: Record<string, number>): boolean => (
  Object.values(resources).some(amount => amount > 0)
);

const hasResources = (
  available: Record<string, number>,
  required: Record<string, number>
): boolean => (
  Object.entries(required).every(([resourceId, amount]) => (available[resourceId] || 0) >= amount)
);

const findHeroByOwnerId = (gameState: GameState, playerId: string) =>
  gameState.heroes.find(hero => hero.ownerId === playerId);

export const validateHostGameAction = (
  action: GameAction,
  gameState: GameState,
  worldState: Pick<WorldState, 'tiles' | 'activeTiles'>,
  options: { hostPlayerId?: string | null } = {}
): HostActionValidation => {
  const player = (playerId: string) => gameState.players.find(p => p.id === playerId) ?? null;
  const stats = (playerId: string) => gameState.playerStats[playerId] ?? null;
  const validateHostControlAction = (playerId: string) => {
    if (!options.hostPlayerId) return invalidAction('Host identity is unavailable');
    return playerId === options.hostPlayerId
      ? validAction
      : invalidAction('Only the host can perform this action');
  };

  switch (action.type) {
    case 'join':
      if (gameState.gameMode !== 'lobby') return invalidAction('Players can only join lobby sessions');
      if (!action.playerId || !action.playerName.trim()) return invalidAction('Join action requires player id and name');
      if (gameState.players.some(existing => existing.id === action.playerId)) return invalidAction('Player already joined');
      if (gameState.players.length >= maxPlayers) return invalidAction('Session is full');
      return validAction;

    case 'leave':
      return player(action.playerId) ? validAction : invalidAction('Player is not in this session');

    case 'ready':
      if (gameState.gameMode !== 'lobby') return invalidAction('Ready state can only change in lobby');
      return player(action.playerId) ? validAction : invalidAction('Player is not in this session');

    case 'start': {
      const hostValidation = validateHostControlAction(action.playerId);
      if (!hostValidation.valid) return hostValidation;
      if (gameState.gameMode !== 'lobby') return invalidAction('Game has already started');
      const teamsWithPlayers = gameState.teams.filter(team => team.playerIds.length >= requiredPlayersPerTeam);
      const allPlayersReady = gameState.players.length > 0 && gameState.players.every(p => p.isReady);
      const canStart = isTestMode
        ? gameState.players.length >= 2 && allPlayersReady
        : teamsWithPlayers.length >= requiredTeams && allPlayersReady;

      return canStart ? validAction : invalidAction('Game start requirements are not met');
    }

    case 'move': {
      const movingPlayer = player(action.playerId);
      const movingStats = stats(action.playerId);
      if (!movingPlayer || !movingStats) return invalidAction('Moving player is not in this session');
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Players can only move during interaction phase');
      }
      if (!hasValidCubeCoords(action.target)) return invalidAction('Move target is not a valid hex coordinate');
      if (!areAdjacent(movingPlayer.position, action.target)) return invalidAction('Move target is not adjacent');
      if (!worldState.tiles[coordsToKey(action.target)]) return invalidAction('Move target tile does not exist');
      return movingStats.actionPoints >= 1 ? validAction : invalidAction('Player has no action points');
    }

    case 'harvest': {
      const harvestingPlayer = player(action.payload.playerId);
      const harvestingStats = stats(action.payload.playerId);
      if (!hasValidCubeCoords(action.payload.tileCoords)) return invalidAction('Harvest target is not a valid hex coordinate');
      const tileKey = coordsToKey(action.payload.tileCoords);
      const tile = worldState.tiles[tileKey];
      if (!harvestingPlayer || !harvestingStats || !tile) return invalidAction('Harvest target is invalid');
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Players can only harvest during interaction phase');
      }
      if (!tile.players?.some(tilePlayer => tilePlayer.id === action.payload.playerId)) {
        return invalidAction('Player is not on the harvested tile');
      }
      if (!worldState.activeTiles.includes(tileKey)) return invalidAction('Tile is not active');
      if (action.payload.isItem) {
        if (!action.payload.itemId) return invalidAction('Item harvest requires an item id');
        if ((gameState.globalItemQuantities[action.payload.itemId] ?? 0) <= 0) {
          return invalidAction('Item supply is exhausted');
        }
      } else if (!action.payload.resourceId) {
        return invalidAction('Resource harvest requires a resource id');
      }

      const apCost = action.payload.isItem ? 3 : 1;
      return harvestingStats.actionPoints >= apCost
        ? validAction
        : invalidAction('Player does not have enough action points to harvest');
    }

    case 'craft': {
      const craftingPlayer = player(action.playerId);
      const craftingStats = stats(action.playerId);
      const itemTemplate = itemDatabase.find(item => item.id === action.itemId);
      if (!craftingPlayer || !craftingStats) return invalidAction('Crafting player is not in this session');
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Players can only craft during interaction phase');
      }
      if (!itemTemplate || !isCraftable(itemTemplate)) return invalidAction('Item is not craftable');
      if ((gameState.globalItemQuantities[action.itemId] ?? 0) <= 0) return invalidAction('Item supply is exhausted');
      return hasResources(craftingStats.resources, itemTemplate.craftingRequirements)
        ? validAction
        : invalidAction('Player does not have the required crafting resources');
    }

    case 'useItem': {
      const usingPlayer = player(action.playerId);
      const usingStats = stats(action.playerId);
      if (!usingPlayer || !usingStats) return invalidAction('Item user is not in this session');
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Players can only use items during interaction phase');
      }
      const usableItem = usingStats.items.find(item => item.id === action.itemId && item.availableUses > 0);
      return usableItem ? validAction : invalidAction('Player does not have a usable copy of this item');
    }

    case 'proposeTrade': {
      const { fromPlayerId, toPlayerId, offeredResources, requestedResources } = action.payload;
      const fromPlayer = player(fromPlayerId);
      const toPlayer = player(toPlayerId);
      const fromStats = stats(fromPlayerId);
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'bartering') {
        return invalidAction('Trades can only be proposed during bartering phase');
      }
      if (!fromPlayer || !toPlayer || !fromStats || fromPlayerId === toPlayerId) {
        return invalidAction('Trade participants are invalid');
      }
      if (!hasValidResourceMap(offeredResources) || !hasValidResourceMap(requestedResources)) {
        return invalidAction('Trade resources must be non-negative integers');
      }
      if (!hasAnyPositiveResource(offeredResources) && !hasAnyPositiveResource(requestedResources)) {
        return invalidAction('Trade must include at least one resource');
      }
      return hasResources(fromStats.resources, offeredResources)
        ? validAction
        : invalidAction('Offering player does not have the offered resources');
    }

    case 'acceptTrade': {
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'bartering') {
        return invalidAction('Trades can only be accepted during bartering phase');
      }
      const proposal = gameState.tradeProposals.find(trade => trade.id === action.payload.tradeId);
      if (!proposal || proposal.status !== 'pending') return invalidAction('Trade proposal is not pending');
      if (proposal.toPlayerId !== action.payload.acceptingPlayerId) return invalidAction('Only the recipient can accept this trade');
      if (!hasValidResourceMap(proposal.offeredResources) || !hasValidResourceMap(proposal.requestedResources)) {
        return invalidAction('Trade proposal contains invalid resource amounts');
      }
      const fromStats = stats(proposal.fromPlayerId);
      const toStats = stats(proposal.toPlayerId);
      if (!fromStats || !toStats) return invalidAction('Trade participant stats are missing');
      if (!hasResources(fromStats.resources, proposal.offeredResources)) return invalidAction('Offering player resources changed');
      return hasResources(toStats.resources, proposal.requestedResources)
        ? validAction
        : invalidAction('Accepting player lacks requested resources');
    }

    case 'rejectTrade':
    case 'cancelTrade': {
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'bartering') {
        return invalidAction('Trades can only be changed during bartering phase');
      }
      const proposal = gameState.tradeProposals.find(trade => trade.id === action.payload.tradeId);
      if (!proposal || proposal.status !== 'pending') return invalidAction('Trade proposal is not pending');
      if (action.type === 'rejectTrade' && proposal.toPlayerId !== action.payload.rejectingPlayerId) {
        return invalidAction('Only the recipient can reject this trade');
      }
      if (action.type === 'cancelTrade' && proposal.fromPlayerId !== action.payload.cancellingPlayerId) {
        return invalidAction('Only the proposer can cancel this trade');
      }
      return validAction;
    }

    case 'recruitHero': {
      const recruitingPlayer = player(action.playerId);
      const recruitingStats = stats(action.playerId);
      if (!recruitingPlayer || !recruitingStats) return invalidAction('Recruiting player is not in this session');
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Heroes can only be recruited during interaction phase');
      }
      if (!heroClasses[action.classId]) return invalidAction('Hero class is unknown');
      if (gameState.heroes.filter(hero => hero.ownerId === action.playerId).length >= MAX_HEROES_PER_PLAYER) {
        return invalidAction('Player already has the maximum number of heroes');
      }
      if (recruitingStats.actionPoints < HERO_RECRUIT_AP_COST) return invalidAction('Player lacks hero recruitment AP');
      return hasResources(recruitingStats.resources, HERO_RECRUIT_RESOURCE_COST)
        ? validAction
        : invalidAction('Player lacks hero recruitment resources');
    }

    case 'restHero': {
      const restingPlayer = player(action.playerId);
      const restingStats = stats(action.playerId);
      if (!restingPlayer || !restingStats || !findHeroByOwnerId(gameState, action.playerId)) {
        return invalidAction('Resting player or hero is missing');
      }
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Heroes can only rest during interaction phase');
      }
      return restingStats.actionPoints >= 1 ? validAction : invalidAction('Player has no AP to spend resting');
    }

    case 'learnSkill': {
      const learningPlayer = player(action.playerId);
      const hero = findHeroByOwnerId(gameState, action.playerId);
      const skill = skillsData[action.skillId];
      if (!learningPlayer || !hero || !skill) return invalidAction('Skill learner, hero, or skill is invalid');
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Hero skills can only be learned during interaction phase');
      }
      if (hero.skillPoints < 1) return invalidAction('Hero has no skill points');
      const existing = hero.skills.find(heroSkill => heroSkill.skillId === action.skillId);
      return !existing || existing.rank < skill.maxRank
        ? validAction
        : invalidAction('Skill is already at maximum rank');
    }

    case 'castSpell': {
      const castingPlayer = player(action.payload.playerId);
      const hero = findHeroByOwnerId(gameState, action.payload.playerId);
      const spell = spellsData[action.payload.spellId];
      if (!castingPlayer || !stats(action.payload.playerId) || !hero || !spell) {
        return invalidAction('Spell caster, hero, or spell is invalid');
      }
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Spells can only be cast during interaction phase');
      }
      if (!hero.knownSpells.includes(action.payload.spellId)) return invalidAction('Hero does not know this spell');
      if (hero.mana < spell.manaCost) return invalidAction('Hero lacks mana');
      if (spell.target === 'enemy') {
        if (!action.payload.targetPlayerId) return invalidAction('Enemy spell requires a target');
        const target = player(action.payload.targetPlayerId);
        if (!target || !stats(action.payload.targetPlayerId)) return invalidAction('Spell target is invalid');
        if (target.teamId === castingPlayer.teamId) return invalidAction('Enemy spell cannot target an ally');
        if (cubeDistance(castingPlayer.position, target.position) > spell.range) return invalidAction('Spell target is out of range');
      }
      return validAction;
    }

    case 'recruitUnit': {
      const recruitingPlayer = player(action.playerId);
      const recruitingStats = stats(action.playerId);
      const hero = findHeroByOwnerId(gameState, action.playerId);
      const unit = unitsData[action.unitId];
      if (!recruitingPlayer || !recruitingStats || !hero || !unit) {
        return invalidAction('Unit recruiter, hero, or unit is invalid');
      }
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Units can only be recruited during interaction phase');
      }
      if (recruitingStats.actionPoints < unit.apCost) return invalidAction('Player lacks unit recruitment AP');
      if (armyUnitCount(hero.army) >= MAX_ARMY_SIZE) return invalidAction('Hero army is full');
      return hasResources(recruitingStats.resources, unit.cost)
        ? validAction
        : invalidAction('Player lacks unit recruitment resources');
    }

    case 'initiateCombat': {
      const attacker = player(action.attackerId);
      const defender = player(action.defenderId);
      const attackerStats = stats(action.attackerId);
      const defenderStats = stats(action.defenderId);
      if (gameState.gameMode !== 'playing' || gameState.currentPhase !== 'interaction') {
        return invalidAction('Combat can only start during interaction phase');
      }
      if (!attacker || !defender || !attackerStats || !defenderStats || action.attackerId === action.defenderId) {
        return invalidAction('Combat participants are invalid');
      }
      if (attacker.teamId === defender.teamId) return invalidAction('Combat target is an ally');
      if (cubeDistance(attacker.position, defender.position) > 1) return invalidAction('Combat target is not adjacent');
      return attackerStats.actionPoints >= COMBAT_AP_COST
        ? validAction
        : invalidAction('Attacker lacks combat AP');
    }

    case 'forceNextPhase': {
      const hostValidation = validateHostControlAction(action.playerId);
      if (!hostValidation.valid) return hostValidation;
      return gameState.gameMode === 'playing' ? validAction : invalidAction('Phase can only be advanced while playing');
    }

    case 'endGame': {
      const hostValidation = validateHostControlAction(action.playerId);
      if (!hostValidation.valid) return hostValidation;
      return gameState.gameMode !== 'ended' ? validAction : invalidAction('Game has already ended');
    }
  }
};

interface HostGameActionContext {
  isHost: boolean;
  hostPlayerId: string | null;
  gameState: GameState;
  tiles: WorldState['tiles'];
  activeTiles: WorldState['activeTiles'];
  dispatch: (action: unknown) => unknown;
  broadcastStateSync: () => void;
  updateSessionPlayerCount: () => void;
  startHostLoop: () => void;
  stopHostLoop: () => void;
  queueTurnActionAudit: (action: GameAction) => void;
  rateLimitAction?: (action: GameAction) => HostActionRateLimitResult;
  recordRejectedAction?: (action: GameAction, reason: string, details?: Record<string, unknown>) => void;
  recordRateLimitedAction?: (action: GameAction, limit: Extract<HostActionRateLimitResult, { allowed: false }>) => void;
}

export const applyHostGameAction = (
  action: GameAction,
  context: HostGameActionContext
): boolean => {
  if (!context.isHost) return false;

  const rateLimit = context.rateLimitAction?.(action);
  if (rateLimit && !rateLimit.allowed) {
    context.recordRateLimitedAction?.(action, rateLimit);
    return false;
  }

  const validation = validateHostGameAction(action, context.gameState, {
    tiles: context.tiles,
    activeTiles: context.activeTiles,
  }, {
    hostPlayerId: context.hostPlayerId,
  });
  if (!validation.valid) {
    context.recordRejectedAction?.(action, validation.reason);
    return false;
  }

  switch (action.type) {
    case 'join':
      context.dispatch(joinGame({ playerName: action.playerName, playerId: action.playerId }));
      context.broadcastStateSync();
      context.updateSessionPlayerCount();
      break;

    case 'leave':
      context.dispatch(leaveGame({ playerId: action.playerId }));
      context.broadcastStateSync();
      context.updateSessionPlayerCount();
      break;

    case 'ready':
      context.dispatch(togglePlayerReady({ playerId: action.playerId }));
      context.broadcastStateSync();
      break;

    case 'start':
      context.dispatch(startGame());
      context.broadcastStateSync();
      context.startHostLoop();
      break;

    case 'move':
      context.dispatch(movePlayer({
        playerId: action.playerId,
        target: action.target,
        tiles: context.tiles,
      }));
      context.broadcastStateSync();
      break;

    case 'harvest':
      context.dispatch(harvestFromTile(action.payload));
      context.broadcastStateSync();
      break;

    case 'craft':
      context.dispatch(craftItem({ playerId: action.playerId, itemId: action.itemId }));
      context.broadcastStateSync();
      break;

    case 'useItem':
      if (action.itemId === 'terraform') {
        context.dispatch(applyTerraformItem(action.playerId));
      } else if (action.itemId === 'leech') {
        context.dispatch(applyLeechItem(action.playerId));
      } else {
        context.dispatch(activateItemEffect({ playerId: action.playerId, itemId: action.itemId }));
      }
      context.broadcastStateSync();
      break;

    case 'proposeTrade':
      context.dispatch(proposeTrade(action.payload));
      context.broadcastStateSync();
      break;

    case 'acceptTrade':
      context.dispatch(acceptTrade(action.payload));
      context.broadcastStateSync();
      break;

    case 'rejectTrade':
      context.dispatch(rejectTrade(action.payload));
      context.broadcastStateSync();
      break;

    case 'cancelTrade':
      context.dispatch(cancelTrade(action.payload));
      context.broadcastStateSync();
      break;

    case 'recruitHero':
      context.dispatch(recruitHero({ playerId: action.playerId, classId: action.classId }));
      context.broadcastStateSync();
      break;

    case 'restHero':
      context.dispatch(restHero({ playerId: action.playerId }));
      context.broadcastStateSync();
      break;

    case 'learnSkill':
      context.dispatch(learnSkill({ playerId: action.playerId, skillId: action.skillId }));
      context.broadcastStateSync();
      break;

    case 'castSpell':
      context.dispatch(castSpell(action.payload));
      context.broadcastStateSync();
      break;

    case 'recruitUnit':
      context.dispatch(recruitUnit({ playerId: action.playerId, unitId: action.unitId }));
      context.broadcastStateSync();
      break;

    case 'initiateCombat':
      context.dispatch(initiateCombat({
        attackerId: action.attackerId,
        defenderId: action.defenderId,
        tiles: context.tiles,
      }));
      context.broadcastStateSync();
      break;

    case 'forceNextPhase':
      context.dispatch(forceNextPhase());
      context.broadcastStateSync();
      break;

    case 'endGame':
      context.dispatch(endGame());
      context.broadcastStateSync();
      context.stopHostLoop();
      break;
  }

  context.queueTurnActionAudit(action);
  return true;
};

export interface PresenceState {
  playerId: string;
  playerName: string;
}

type DispatchLike = (action: unknown) => unknown;
type SchedulePlayerDisconnect = (playerId: string, finalizeDisconnect: () => void) => void;

export type StateSyncPayload = {
  gameState: GameState;
  worldState: WorldState;
};

export type StateSyncEnvelope = StateSyncPayload & {
  sessionId: string;
  sequence: number;
  sentAt: string;
  stateHash: string;
};

const isStateSyncEnvelope = (payload: unknown): payload is StateSyncEnvelope => (
  isRecord(payload)
  && typeof payload.sessionId === 'string'
  && Number.isInteger(payload.sequence)
  && typeof payload.sentAt === 'string'
  && typeof payload.stateHash === 'string'
);

const hasStateSyncEnvelopeFields = (payload: unknown): boolean => (
  isRecord(payload)
  && (
    'sessionId' in payload
    || 'sequence' in payload
    || 'sentAt' in payload
    || 'stateHash' in payload
  )
);

const extractStateSyncPayload = (payload: unknown): StateSyncPayload | null => {
  if (!isRecord(payload)) return null;
  if (!isRecord(payload.gameState) || !isRecord(payload.worldState)) return null;
  return payload as StateSyncPayload;
};

export const createStateSyncEnvelope = (
  gameState: GameState,
  worldState: WorldState,
  sequence: number,
  sessionId: string,
  sentAt = new Date().toISOString()
): StateSyncEnvelope => ({
  gameState,
  worldState,
  sessionId,
  sequence,
  sentAt,
  stateHash: createPersistedStateHash(gameState, worldState),
});

export const shouldApplyStateSyncSequence = (
  incomingSequence: number,
  lastAppliedSequence: number | null
): boolean => lastAppliedSequence === null || incomingSequence > lastAppliedSequence;

export const validateStateSyncPayload = (payload: unknown): HostActionValidation => {
  if (!isRecord(payload)) return invalidAction('State sync payload must be an object');

  if (hasStateSyncEnvelopeFields(payload) && !isStateSyncEnvelope(payload)) {
    return invalidAction('State sync envelope is malformed');
  }

  if (isStateSyncEnvelope(payload)) {
    if (payload.sessionId.trim() === '') return invalidAction('State sync session is invalid');
    if (payload.sequence < 1) return invalidAction('State sync sequence is invalid');
    if (Number.isNaN(Date.parse(payload.sentAt))) return invalidAction('State sync timestamp is invalid');
  }

  const syncPayload = extractStateSyncPayload(payload);
  if (!syncPayload) return invalidAction('State sync payload is missing state');

  const { gameState, worldState } = syncPayload;
  if (!isRecord(gameState)) return invalidAction('State sync payload is missing game state');
  if (!isRecord(worldState)) return invalidAction('State sync payload is missing world state');

  if (!isValidGameMode(gameState.gameMode)) return invalidAction('Game state mode is invalid');
  if (!isValidGamePhase(gameState.currentPhase)) return invalidAction('Game state phase is invalid');
  if (!Number.isInteger(gameState.roundNumber) || gameState.roundNumber < 1) {
    return invalidAction('Game state round number is invalid');
  }

  if (!Array.isArray(gameState.players)) return invalidAction('Game state players must be an array');
  if (gameState.players.length > maxPlayers) return invalidAction('Game state exceeds maximum player count');

  const playerIds = new Set<string>();
  for (const player of gameState.players) {
    if (!isRecord(player)) return invalidAction('Game state contains an invalid player');
    if (typeof player.id !== 'string' || player.id.trim() === '') {
      return invalidAction('Game state contains a player without an id');
    }
    if (playerIds.has(player.id)) return invalidAction('Game state contains duplicate player ids');
    playerIds.add(player.id);
    if (typeof player.name !== 'string' || !hasValidCubeCoords(player.position)) {
      return invalidAction('Game state contains malformed player data');
    }
  }

  if (!Array.isArray(gameState.teams)) return invalidAction('Game state teams must be an array');
  for (const team of gameState.teams) {
    if (!isRecord(team)) return invalidAction('Game state contains an invalid team');
    if (typeof team.id !== 'string' || typeof team.name !== 'string' || !Array.isArray(team.playerIds)) {
      return invalidAction('Game state contains malformed team data');
    }
    if (!team.playerIds.every(playerId => typeof playerId === 'string')) {
      return invalidAction('Game state team player ids must be strings');
    }
  }

  if (!isRecord(gameState.playerStats)) return invalidAction('Game state player stats must be an object');
  for (const playerId of playerIds) {
    const stats = gameState.playerStats[playerId];
    if (!isRecord(stats)) return invalidAction('Game state is missing player stats');
    if (
      typeof stats.hp !== 'number'
      || !Number.isFinite(stats.hp)
      || typeof stats.actionPoints !== 'number'
      || !Number.isFinite(stats.actionPoints)
      || !isRecord(stats.resources)
      || !Array.isArray(stats.items)
      || !Array.isArray(stats.statusEffects)
    ) {
      return invalidAction('Game state contains malformed player stats');
    }
  }

  if (!Array.isArray(gameState.heroes)) return invalidAction('Game state heroes must be an array');
  for (const hero of gameState.heroes) {
    if (!isRecord(hero)) return invalidAction('Game state contains an invalid hero');
    if (
      typeof hero.id !== 'string'
      || typeof hero.ownerId !== 'string'
      || !playerIds.has(hero.ownerId)
      || typeof hero.classId !== 'string'
      || !Array.isArray(hero.army)
    ) {
      return invalidAction('Game state contains malformed hero data');
    }
  }

  if (!isRecord(worldState.tiles)) return invalidAction('World state tiles must be an object');
  if (!Array.isArray(worldState.activeTiles)) return invalidAction('World state active tiles must be an array');
  if (!Number.isInteger(worldState.worldSize) || worldState.worldSize < 0) {
    return invalidAction('World state size is invalid');
  }
  if (worldState.selectedTile !== null && worldState.selectedTile !== undefined && !hasValidCubeCoords(worldState.selectedTile)) {
    return invalidAction('World state selected tile is invalid');
  }

  for (const [tileKey, tile] of Object.entries(worldState.tiles)) {
    if (!isRecord(tile)) return invalidAction(`World tile ${tileKey} is invalid`);
    if (!hasValidCubeCoords(tile.coords)) return invalidAction(`World tile ${tileKey} has invalid coordinates`);
    if (coordsToKey(tile.coords) !== tileKey) return invalidAction(`World tile ${tileKey} coordinate key does not match`);
    if (!isValidTerrain(tile.terrain)) return invalidAction(`World tile ${tileKey} terrain is invalid`);
    if (
      typeof tile.explored !== 'boolean'
      || typeof tile.visible !== 'boolean'
      || typeof tile.fogLevel !== 'number'
      || !Number.isFinite(tile.fogLevel)
    ) {
      return invalidAction(`World tile ${tileKey} visibility data is invalid`);
    }
    if (tile.players !== undefined) {
      if (!Array.isArray(tile.players)) return invalidAction(`World tile ${tileKey} players must be an array`);
      for (const tilePlayer of tile.players) {
        if (!isRecord(tilePlayer) || typeof tilePlayer.id !== 'string' || !hasValidCubeCoords(tilePlayer.position)) {
          return invalidAction(`World tile ${tileKey} contains malformed player data`);
        }
      }
    }
  }

  for (const tileKey of worldState.activeTiles) {
    if (typeof tileKey !== 'string') return invalidAction('World state active tile keys must be strings');
    if (!worldState.tiles[tileKey]) return invalidAction(`World state active tile ${tileKey} does not exist`);
  }

  return validAction;
};

export const applyStateSyncPayload = (
  payload: unknown,
  isHost: boolean,
  dispatch: DispatchLike,
  onInvalidPayload?: (reason: string) => void,
  lastAppliedSequence: number | null = null,
  onSequenceApplied?: (sequence: number) => void,
  expectedSessionId?: string | null
): boolean => {
  if (isHost) return false;

  const validation = validateStateSyncPayload(payload);
  if (!validation.valid) {
    onInvalidPayload?.(validation.reason);
    return false;
  }

  if (
    expectedSessionId
    && isStateSyncEnvelope(payload)
    && payload.sessionId !== expectedSessionId
  ) {
    onInvalidPayload?.(`State sync session ${payload.sessionId} does not match ${expectedSessionId}`);
    return false;
  }

  if (isStateSyncEnvelope(payload) && !shouldApplyStateSyncSequence(payload.sequence, lastAppliedSequence)) {
    onInvalidPayload?.(`State sync sequence ${payload.sequence} is not newer than ${lastAppliedSequence}`);
    return false;
  }

  const syncPayload = extractStateSyncPayload(payload);
  if (!syncPayload) {
    onInvalidPayload?.('State sync payload is missing state');
    return false;
  }
  dispatch(syncGameState(syncPayload.gameState));
  dispatch(syncWorldState(syncPayload.worldState));
  if (isStateSyncEnvelope(payload)) {
    onSequenceApplied?.(payload.sequence);
  }
  return true;
};

export type HostMigrationPayload = {
  sessionId?: string;
  newHostId: string;
};

export const applyHostMigrationPayload = (
  payload: HostMigrationPayload,
  dispatch: DispatchLike,
  startHostLoopIfPromoted: () => void,
  getIsHostAfterPromotion: () => boolean,
  expectedSessionId?: string | null,
  onInvalidPayload?: (reason: string) => void
): boolean => {
  if (expectedSessionId && payload.sessionId && payload.sessionId !== expectedSessionId) {
    onInvalidPayload?.(`Host migration session ${payload.sessionId} does not match ${expectedSessionId}`);
    return false;
  }

  dispatch(promoteToHost(payload.newHostId));

  if (getIsHostAfterPromotion()) {
    startHostLoopIfPromoted();
    return true;
  }

  return false;
};

export const applyPresenceJoinPayload = (
  presences: PresenceState[],
  dispatch: DispatchLike,
  cancelPendingDisconnect?: (playerId: string) => void
): number => {
  presences.forEach(presence => {
    cancelPendingDisconnect?.(presence.playerId);
    dispatch(addConnectedPlayer(presence.playerId));
  });

  return presences.length;
};

export const applyPresenceLeavePayload = (
  presences: PresenceState[],
  dispatch: DispatchLike,
  handlePlayerDisconnect: (playerId: string) => void,
  schedulePlayerDisconnect?: SchedulePlayerDisconnect
): number => {
  presences.forEach(presence => {
    dispatch(removeConnectedPlayer(presence.playerId));
    if (schedulePlayerDisconnect) {
      schedulePlayerDisconnect(presence.playerId, () => handlePlayerDisconnect(presence.playerId));
    } else {
      handlePlayerDisconnect(presence.playerId);
    }
  });

  return presences.length;
};

export const shouldFinalizePlayerDisconnect = (
  playerId: string,
  connectedPlayerIds: readonly string[]
): boolean => !connectedPlayerIds.includes(playerId);

export const selectNextHostId = (
  connectedPlayerIds: string[],
  leavingPlayerId: string
): string | null => {
  const connectedIds = connectedPlayerIds.filter(id => id !== leavingPlayerId);
  return [...connectedIds].sort()[0] ?? null;
};

export interface JoinableSessionSnapshot {
  id: string;
  host_player_id: string;
  game_mode: string;
  player_count: number;
  max_players: number;
  game_state?: GameState | null;
  world_state?: WorldState | null;
}

export interface ReconnectSessionSnapshot {
  id: string;
  host_player_id: string;
  game_mode: string;
  game_state?: GameState | null;
  world_state?: WorldState | null;
}

export interface ActiveSessionSummary {
  gameMode: string;
  playerCount: number;
  hasState: boolean;
  stateStatus: 'none' | 'valid' | 'invalid';
  stateError?: string;
}

export const getJoinSessionError = (
  session: JoinableSessionSnapshot | null,
  hasQueryError = false
): string | null => {
  if (hasQueryError || !session) return 'Session not found';
  if (session.game_mode === 'ended') return 'Game has ended';
  if (session.game_mode === 'lobby' && session.player_count >= session.max_players) {
    return 'Session is full';
  }
  return null;
};

export const getActiveSessionSummary = (session: {
  game_mode: string;
  player_count: number;
  game_state?: GameState | null;
  world_state?: WorldState | null;
}): ActiveSessionSummary => {
  const hasState = Boolean(session.game_state);
  if (!hasState) {
    return {
      gameMode: session.game_mode,
      playerCount: session.player_count,
      hasState,
      stateStatus: 'none',
    };
  }

  const persistedState = resolvePersistedStateSnapshot(session.game_state, session.world_state);
  return {
    gameMode: session.game_mode,
    playerCount: session.player_count,
    hasState,
    stateStatus: persistedState.error ? 'invalid' : 'valid',
    stateError: persistedState.error ?? undefined,
  };
};

export const resolvePersistedStateSnapshot = (
  gameState?: GameState | null,
  worldState?: WorldState | null
): {
  error: string | null;
  gameState?: GameState;
  worldState?: WorldState;
} => {
  if (!gameState || !worldState) return { error: 'No saved game state' };

  const validation = validateStateSyncPayload({
    gameState,
    worldState,
  });
  if (!validation.valid) {
    return { error: `Saved game state is invalid: ${validation.reason}` };
  }

  return {
    error: null,
    gameState,
    worldState,
  };
};

export const resolveReconnectSession = (
  session: ReconnectSessionSnapshot | null,
  playerId: string,
  playerName: string,
  hasQueryError = false
): {
  error: string | null;
  gameState?: GameState;
  worldState?: WorldState;
  player?: GameState['players'][number];
} => {
  if (hasQueryError || !session) return { error: 'Session not found' };
  if (session.game_mode === 'ended') return { error: 'Game has ended' };

  const persistedState = resolvePersistedStateSnapshot(session.game_state, session.world_state);
  if (persistedState.error || !persistedState.gameState || !persistedState.worldState) {
    return { error: persistedState.error ?? 'No saved game state' };
  }

  const player = findReconnectablePlayer(persistedState.gameState, playerId, playerName);
  if (!player) return { error: 'Player not found in session' };

  return {
    error: null,
    gameState: persistedState.gameState,
    worldState: persistedState.worldState,
    player,
  };
};

const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generatePlayerId = (): string => {
  return `player_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const STATE_SAVE_INTERVAL_MS = 5000;

class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private phaseInterval: ReturnType<typeof setInterval> | null = null;
  private stateSaveInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private lastSavedStateHash: string | null = null;
  private diagnostics: RealtimeDiagnostic[] = [];
  private pendingDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private hostAuthorityToken: string | null = null;
  private stateSyncSequence = 0;
  private lastAppliedStateSyncSequence: number | null = null;
  private lastBroadcastStateSyncHash: string | null = null;
  private lastStateSyncPayloadWarningAtMs: number | null = null;
  private hostActionRateLimitBuckets = new Map<string, HostActionRateLimitBucket>();

  getDiagnostics(): readonly RealtimeDiagnostic[] {
    return this.diagnostics;
  }

  clearDiagnostics() {
    this.diagnostics = [];
  }

  private resetStateSyncOrdering() {
    this.stateSyncSequence = 0;
    this.lastAppliedStateSyncSequence = null;
    this.lastBroadcastStateSyncHash = null;
    this.lastStateSyncPayloadWarningAtMs = null;
  }

  private resetHostActionRateLimits() {
    this.hostActionRateLimitBuckets.clear();
  }

  private cancelPendingPlayerDisconnect(playerId: string) {
    const timer = this.pendingDisconnectTimers.get(playerId);
    if (!timer) return;

    clearTimeout(timer);
    this.pendingDisconnectTimers.delete(playerId);
  }

  private clearPendingPlayerDisconnects() {
    this.pendingDisconnectTimers.forEach(timer => clearTimeout(timer));
    this.pendingDisconnectTimers.clear();
  }

  private schedulePlayerDisconnect(playerId: string, finalizeDisconnect: () => void) {
    this.cancelPendingPlayerDisconnect(playerId);

    const timer = setTimeout(() => {
      this.pendingDisconnectTimers.delete(playerId);
      const state = store.getState();
      if (!shouldFinalizePlayerDisconnect(playerId, state.session.connectedPlayerIds)) return;

      this.recordDiagnostic({
        code: 'player_disconnect_timeout',
        severity: 'info',
        message: 'Player remained disconnected after the grace period',
        sessionId: this.sessionId,
        playerId,
        roundNumber: state.game.roundNumber,
        phase: state.game.currentPhase,
        details: { graceMs: PLAYER_DISCONNECT_GRACE_MS },
      });

      finalizeDisconnect();
    }, PLAYER_DISCONNECT_GRACE_MS);

    this.pendingDisconnectTimers.set(playerId, timer);
  }

  private recordDiagnostic(input: RealtimeDiagnosticInput) {
    const diagnostic = createRealtimeDiagnostic(input);
    this.diagnostics = appendRealtimeDiagnostic(this.diagnostics, diagnostic);
    emitRealtimeDiagnosticEvent(diagnostic);
    void postRealtimeDiagnostic(diagnostic).catch(() => {
      // Diagnostics must never interrupt gameplay or recurse into diagnostics.
    });
    return diagnostic;
  }

  private getHostAuthorityContext(): { hostPlayerId: string; hostToken: string } | null {
    const session = store.getState().session;
    if (!session.localPlayerId || !this.hostAuthorityToken) return null;
    return {
      hostPlayerId: session.localPlayerId,
      hostToken: this.hostAuthorityToken,
    };
  }

  private async claimHostAuthority(hostPlayerId: string) {
    if (!this.sessionId) return;

    const response = await postSessionAuthorityRequest<{ ok: true; sessionId: string; hostToken: string }>({
      type: 'claimHost',
      sessionId: this.sessionId,
      hostPlayerId,
    });
    if (!response) return;

    this.hostAuthorityToken = response.hostToken;
  }

  async createSession(playerName: string): Promise<{ sessionCode: string; playerId: string } | null> {
    try {
      if (!supabase) {
        store.dispatch(setSessionError('Supabase is not configured'));
        return null;
      }

      store.dispatch(setConnectionStatus('connecting'));

      const playerId = generatePlayerId();
      const sessionCode = generateSessionCode();
      let createdSessionId: string | null = null;

      const authoritySession = await postSessionAuthorityRequest<{ ok: true; sessionId: string; hostToken: string }>({
        type: 'createSession',
        sessionCode,
        hostPlayerId: playerId,
        maxPlayers,
        gameConfig: {},
      });

      if (authoritySession) {
        createdSessionId = authoritySession.sessionId;
        this.hostAuthorityToken = authoritySession.hostToken;
      } else {
        const { data, error } = await supabase
          .from('game_sessions')
          .insert({
          session_code: sessionCode,
          host_player_id: playerId,
          game_mode: 'lobby',
          player_count: 1,
          game_config: {},
          })
          .select('id')
          .maybeSingle();

        if (error || !data) {
          store.dispatch(setSessionError(error?.message || 'Failed to create session'));
          return null;
        }
        createdSessionId = data.id;
      }

      if (!createdSessionId) {
        store.dispatch(setSessionError('Failed to create session'));
        return null;
      }

      this.sessionId = createdSessionId;

      store.dispatch(setSession({
        sessionId: createdSessionId,
        sessionCode,
        hostPlayerId: playerId,
        isHost: true,
      }));
      store.dispatch(setLocalPlayer({ playerId, playerName }));

      await this.joinChannel(createdSessionId, playerId, playerName);

      store.dispatch(joinGame({ playerName, playerId }));

      this.startStateSaveLoop();

      return { sessionCode, playerId };
    } catch {
      store.dispatch(setSessionError('Failed to create session'));
      return null;
    }
  }

  async joinSession(sessionCode: string, playerName: string): Promise<{ playerId: string } | null> {
    try {
      if (!supabase) {
        store.dispatch(setSessionError('Supabase is not configured'));
        return null;
      }

      store.dispatch(setConnectionStatus('connecting'));

      const { data: session, error } = await supabase
        .from('game_sessions')
        .select('id, host_player_id, game_mode, player_count, max_players, game_state, world_state')
        .eq('session_code', sessionCode.toUpperCase())
        .maybeSingle();

      const joinError = getJoinSessionError(
        session as JoinableSessionSnapshot | null,
        Boolean(error)
      );
      if (joinError) {
        store.dispatch(setSessionError(joinError));
        return null;
      }

      const playerId = generatePlayerId();
      const joinableSession = session as JoinableSessionSnapshot;
      this.sessionId = joinableSession.id;

      store.dispatch(setSession({
        sessionId: joinableSession.id,
        sessionCode: sessionCode.toUpperCase(),
        hostPlayerId: joinableSession.host_player_id,
        isHost: false,
      }));
      store.dispatch(setLocalPlayer({ playerId, playerName }));

      if (joinableSession.game_state && joinableSession.world_state) {
        const persistedState = resolvePersistedStateSnapshot(
          joinableSession.game_state,
          joinableSession.world_state
        );
        if (persistedState.error || !persistedState.gameState || !persistedState.worldState) {
          store.dispatch(setSessionError(persistedState.error ?? 'No saved game state'));
          return null;
        }

        store.dispatch(syncGameState(persistedState.gameState));
        store.dispatch(syncWorldState(persistedState.worldState));
      }

      await this.joinChannel(joinableSession.id, playerId, playerName);

      this.sendAction({ type: 'join', playerName, playerId });

      return { playerId };
    } catch {
      store.dispatch(setSessionError('Failed to join session'));
      return null;
    }
  }

  async reconnectSession(
    sessionCode: string,
    playerId: string,
    playerName: string
  ): Promise<{ reconnected: boolean } | null> {
    try {
      if (!supabase) {
        store.dispatch(setSessionError('Supabase is not configured'));
        return null;
      }

      store.dispatch(setConnectionStatus('connecting'));

      const { data: session, error } = await supabase
        .from('game_sessions')
        .select('id, host_player_id, game_mode, game_state, world_state')
        .eq('session_code', sessionCode.toUpperCase())
        .maybeSingle();

      const reconnectSession = session as ReconnectSessionSnapshot | null;
      const resolved = resolveReconnectSession(
        reconnectSession,
        playerId,
        playerName,
        Boolean(error)
      );
      if (resolved.error || !reconnectSession || !resolved.gameState || !resolved.worldState || !resolved.player) {
        store.dispatch(setSessionError(resolved.error ?? 'Failed to reconnect'));
        return null;
      }

      this.sessionId = reconnectSession.id;

      store.dispatch(setSession({
        sessionId: reconnectSession.id,
        sessionCode: sessionCode.toUpperCase(),
        hostPlayerId: reconnectSession.host_player_id,
        isHost: false,
      }));
      store.dispatch(setLocalPlayer({
        playerId: resolved.player.id,
        playerName: resolved.player.name,
      }));
      store.dispatch(syncGameState(resolved.gameState));
      store.dispatch(syncWorldState(resolved.worldState));

      await this.joinChannel(reconnectSession.id, resolved.player.id, resolved.player.name);

      return { reconnected: true };
    } catch {
      store.dispatch(setSessionError('Failed to reconnect'));
      return null;
    }
  }

  async getActiveSession(sessionCode: string): Promise<ActiveSessionSummary | null> {
    if (!supabase) {
      store.dispatch(setSessionError('Supabase is not configured'));
      return null;
    }

    const { data, error } = await supabase
      .from('game_sessions')
      .select('game_mode, player_count, game_state, world_state')
      .eq('session_code', sessionCode.toUpperCase())
      .maybeSingle();

    if (error || !data) return null;

    return getActiveSessionSummary(data);
  }

  private async joinChannel(sessionId: string, playerId: string, playerName: string) {
    if (!supabase) {
      store.dispatch(setSessionError('Supabase is not configured'));
      return;
    }

      if (this.channel) {
        await supabase.removeChannel(this.channel);
      }
      this.resetStateSyncOrdering();
      this.resetHostActionRateLimits();

      this.channel = supabase.channel(`game:${sessionId}`, {
      config: { presence: { key: playerId } },
    });

    this.channel
      .on('broadcast', { event: 'game_action' }, (payload) => {
        this.handleRemoteAction(payload.payload as GameAction);
      })
      .on('broadcast', { event: 'state_sync' }, (payload) => {
        const state = store.getState();
        const session = state.session;
        applyStateSyncPayload(
          payload.payload,
          session.isHost,
          store.dispatch,
          (reason) => {
            this.recordDiagnostic({
              code: 'invalid_state_sync',
              severity: 'warning',
              message: `Rejected invalid state sync: ${reason}`,
              sessionId: this.sessionId,
              roundNumber: state.game.roundNumber,
              phase: state.game.currentPhase,
              details: { reason },
            });
          },
          this.lastAppliedStateSyncSequence,
          (sequence) => {
            this.lastAppliedStateSyncSequence = sequence;
          },
          this.sessionId
        );
      })
      .on('broadcast', { event: 'host_migration' }, (payload) => {
        const migrationPayload = payload.payload as HostMigrationPayload;
        applyHostMigrationPayload(
          migrationPayload,
          store.dispatch,
          () => {
            void this.claimHostAuthority(migrationPayload.newHostId).catch(error => {
              this.recordDiagnostic({
                code: 'persistence_save_failed',
                severity: 'warning',
                message: 'Failed to claim host authority after migration',
                sessionId: this.sessionId,
                playerId: migrationPayload.newHostId,
                details: normaliseRealtimeError(error),
              });
            });
            this.startHostLoop();
          },
          () => store.getState().session.isHost,
          this.sessionId,
          (reason) => {
            const latestState = store.getState();
            this.recordDiagnostic({
              code: 'invalid_action',
              severity: 'warning',
              message: `Rejected invalid host migration: ${reason}`,
              sessionId: this.sessionId,
              playerId: migrationPayload.newHostId,
              roundNumber: latestState.game.roundNumber,
              phase: latestState.game.currentPhase,
              details: { reason },
            });
          }
        );
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        applyPresenceJoinPayload(
          newPresences as PresenceState[],
          store.dispatch,
          (presencePlayerId) => this.cancelPendingPlayerDisconnect(presencePlayerId)
        );
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        applyPresenceLeavePayload(
          leftPresences as PresenceState[],
          store.dispatch,
          (playerId) => this.handlePlayerDisconnect(playerId),
          (presencePlayerId, finalizeDisconnect) => {
            this.schedulePlayerDisconnect(presencePlayerId, finalizeDisconnect);
          }
        );
      });

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        store.dispatch(setConnectionStatus('connected'));
        await this.channel!.track({ playerId, playerName });
      } else if (status === 'CHANNEL_ERROR') {
        store.dispatch(setConnectionStatus('error'));
      }
    });
  }

  private handleRemoteAction(action: GameAction) {
    const state = store.getState();

    applyHostGameAction(action, {
      isHost: state.session.isHost,
      hostPlayerId: state.session.hostPlayerId,
      gameState: state.game,
      tiles: state.world.tiles,
      activeTiles: state.world.activeTiles,
      dispatch: store.dispatch,
      broadcastStateSync: () => this.broadcastStateSync(),
      updateSessionPlayerCount: () => {
        void this.updateSessionPlayerCount();
      },
      startHostLoop: () => this.startHostLoop(),
      stopHostLoop: () => this.stopHostLoop(),
      queueTurnActionAudit: (queuedAction) => this.queueTurnActionAudit(queuedAction),
      rateLimitAction: (limitedAction) => checkHostActionRateLimit(
        this.hostActionRateLimitBuckets,
        limitedAction,
        Date.now()
      ),
      recordRejectedAction: (rejectedAction, reason, details) => {
        this.recordDiagnostic({
          code: 'invalid_action',
          severity: 'warning',
          message: `Rejected invalid host action: ${reason}`,
          sessionId: this.sessionId,
          actionType: rejectedAction.type,
          playerId: getGameActionAuditPlayerId(rejectedAction),
          roundNumber: state.game.roundNumber,
          phase: state.game.currentPhase,
          details: { reason, ...details },
        });
      },
      recordRateLimitedAction: (limitedAction, limit) => {
        this.recordDiagnostic({
          code: 'action_rate_limited',
          severity: 'warning',
          message: 'Rejected host action because the actor exceeded the action rate limit',
          sessionId: this.sessionId,
          actionType: limitedAction.type,
          playerId: getGameActionAuditPlayerId(limitedAction),
          roundNumber: state.game.roundNumber,
          phase: state.game.currentPhase,
          details: {
            rateLimitKey: limit.key,
            scope: limit.scope,
            count: limit.count,
            maxActions: limit.maxActions,
            windowMs: limit.windowMs,
            retryAfterMs: limit.retryAfterMs,
          },
        });
      },
    });
  }

  sendAction(action: GameAction) {
    const session = store.getState().session;

    if (!canSendLocalGameAction(action, session.localPlayerId)) {
      this.recordDiagnostic({
        code: 'invalid_action',
        severity: 'warning',
        message: 'Refused to send a local action for another player',
        sessionId: this.sessionId,
        actionType: action.type,
        playerId: getGameActionAuditPlayerId(action),
        details: {
          localPlayerId: session.localPlayerId,
          reason: 'action_player_mismatch',
        },
      });
      return;
    }

    if (session.isHost) {
      this.handleRemoteAction(action);
      return;
    }

    if (!this.channel) {
      this.recordDiagnostic({
        code: 'missing_channel',
        severity: 'warning',
        message: `Cannot send ${action.type} without an active realtime channel`,
        sessionId: this.sessionId,
        actionType: action.type,
        playerId: getGameActionAuditPlayerId(action),
      });
      return;
    }

    try {
      void Promise.resolve(this.channel.send({
        type: 'broadcast',
        event: 'game_action',
        payload: action,
      })).then(status => {
        if (status !== 'ok') {
          this.recordDiagnostic({
            code: 'broadcast_failed',
            severity: 'error',
            message: `Realtime action broadcast failed with status ${status}`,
            sessionId: this.sessionId,
            actionType: action.type,
            playerId: getGameActionAuditPlayerId(action),
            details: { status },
          });
        }
      }).catch(error => {
        this.recordDiagnostic({
          code: 'broadcast_failed',
          severity: 'error',
          message: `Realtime action broadcast failed for ${action.type}`,
          sessionId: this.sessionId,
          actionType: action.type,
          playerId: getGameActionAuditPlayerId(action),
          details: normaliseRealtimeError(error),
        });
      });
    } catch (error) {
      this.recordDiagnostic({
        code: 'broadcast_failed',
        severity: 'error',
        message: `Realtime action broadcast failed for ${action.type}`,
        sessionId: this.sessionId,
        actionType: action.type,
        playerId: getGameActionAuditPlayerId(action),
        details: normaliseRealtimeError(error),
      });
    }
  }

  private broadcastStateSync() {
    if (!this.channel) {
      this.recordDiagnostic({
        code: 'missing_channel',
        severity: 'warning',
        message: 'Cannot broadcast state sync without an active realtime channel',
        sessionId: this.sessionId,
      });
      return;
    }

    const state = store.getState();
    const stateHash = createPersistedStateHash(state.game, state.world);
    if (!shouldBroadcastStateSync(stateHash, this.lastBroadcastStateSyncHash)) return;

    const envelope = createStateSyncEnvelope(
      state.game,
      state.world,
      this.stateSyncSequence + 1,
      this.sessionId ?? ''
    );
    const payloadBytes = measureJsonPayloadBytes(envelope);
    const payloadWarningAtMs = Date.now();
    if (shouldRecordStateSyncPayloadWarning(
      payloadBytes,
      STATE_SYNC_WARN_BYTES,
      this.lastStateSyncPayloadWarningAtMs,
      STATE_SYNC_WARN_MIN_INTERVAL_MS,
      payloadWarningAtMs
    )) {
      this.recordDiagnostic({
        code: 'state_sync_payload_large',
        severity: 'warning',
        message: `State sync payload is ${payloadBytes} bytes`,
        sessionId: this.sessionId,
        roundNumber: state.game.roundNumber,
        phase: state.game.currentPhase,
        details: {
          payloadBytes,
          warnBytes: STATE_SYNC_WARN_BYTES,
          minIntervalMs: STATE_SYNC_WARN_MIN_INTERVAL_MS,
          sequence: envelope.sequence,
          stateHash: envelope.stateHash,
        },
      });
      this.lastStateSyncPayloadWarningAtMs = payloadWarningAtMs;
    }

    try {
      void Promise.resolve(this.channel.send({
        type: 'broadcast',
        event: 'state_sync',
        payload: envelope,
      })).then(status => {
        if (status === 'ok') {
          this.stateSyncSequence = envelope.sequence;
          this.lastBroadcastStateSyncHash = envelope.stateHash;
        } else {
          this.recordDiagnostic({
            code: 'state_sync_failed',
            severity: 'error',
            message: `Realtime state sync failed with status ${status}`,
            sessionId: this.sessionId,
            roundNumber: state.game.roundNumber,
            phase: state.game.currentPhase,
            details: { status },
          });
        }
      }).catch(error => {
        this.recordDiagnostic({
          code: 'state_sync_failed',
          severity: 'error',
          message: 'Realtime state sync failed',
          sessionId: this.sessionId,
          roundNumber: state.game.roundNumber,
          phase: state.game.currentPhase,
          details: normaliseRealtimeError(error),
        });
      });
    } catch (error) {
      this.recordDiagnostic({
        code: 'state_sync_failed',
        severity: 'error',
        message: 'Realtime state sync failed',
        sessionId: this.sessionId,
        roundNumber: state.game.roundNumber,
        phase: state.game.currentPhase,
        details: normaliseRealtimeError(error),
      });
    }
  }

  startHostLoop() {
    this.stopHostLoop();

    this.phaseInterval = setInterval(() => {
      const state = store.getState();
      if (state.game.gameMode !== 'playing') {
        this.stopHostLoop();
        return;
      }
      store.dispatch(updatePhaseTimer({ tiles: state.world.tiles }));
      this.broadcastStateSync();
    }, 1000);
  }

  stopHostLoop() {
    if (this.phaseInterval) {
      clearInterval(this.phaseInterval);
      this.phaseInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private startStateSaveLoop() {
    this.stopStateSaveLoop();

    this.stateSaveInterval = setInterval(() => {
      this.saveGameState();
    }, STATE_SAVE_INTERVAL_MS);
  }

  private stopStateSaveLoop() {
    if (this.stateSaveInterval) {
      clearInterval(this.stateSaveInterval);
      this.stateSaveInterval = null;
    }
  }

  private async saveGameState() {
    if (!this.sessionId) return;

    const session = store.getState().session;
    if (!session.isHost) return;

    const state = store.getState();
    const gameState = state.game;
    const worldState = state.world;

    const stateHash = createPersistedStateHash(gameState, worldState);

    if (stateHash === this.lastSavedStateHash) return;

    try {
      const authority = this.getHostAuthorityContext();
      if (authority) {
        await postSessionAuthorityRequest({
          type: 'saveState',
          sessionId: this.sessionId,
          hostPlayerId: authority.hostPlayerId,
          hostToken: authority.hostToken,
          gameState,
          worldState,
        });
        this.lastSavedStateHash = stateHash;
        return;
      }

      if (!supabase) return;
      const { error } = await supabase
        .from('game_sessions')
        .update({
          game_state: gameState,
          world_state: worldState,
          round_number: gameState.roundNumber,
          game_mode: gameState.gameMode,
          player_count: gameState.players.length,
          last_saved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.sessionId);

      if (!error) {
        this.lastSavedStateHash = stateHash;
        return;
      }

      this.recordDiagnostic({
        code: 'persistence_save_failed',
        severity: 'error',
        message: 'Failed to persist host game state',
        sessionId: this.sessionId,
        roundNumber: gameState.roundNumber,
        phase: gameState.currentPhase,
        details: normaliseRealtimeError(error),
      });
    } catch (error) {
      this.recordDiagnostic({
        code: 'persistence_save_failed',
        severity: 'error',
        message: 'Failed to persist host game state',
        sessionId: this.sessionId,
        roundNumber: gameState.roundNumber,
        phase: gameState.currentPhase,
        details: normaliseRealtimeError(error),
      });
    }
  }

  async recordTurnAction(actionType: string, playerId: string | null, actionData: object) {
    if (!this.sessionId) return;

    const session = store.getState().session;
    if (!session.isHost) return;

    const gameState = store.getState().game;
    const authority = this.getHostAuthorityContext();
    if (authority) {
      await postSessionAuthorityRequest({
        type: 'recordAction',
        sessionId: this.sessionId,
        hostPlayerId: authority.hostPlayerId,
        hostToken: authority.hostToken,
        roundNumber: gameState.roundNumber,
        phase: gameState.currentPhase,
        actionType: actionType as GameAction['type'],
        playerId,
        actionData: actionData as GameAction,
      });
      return;
    }

    if (!supabase) return;
    const { error } = await supabase.from('game_turn_history').insert({
      session_id: this.sessionId,
      round_number: gameState.roundNumber,
      phase: gameState.currentPhase,
      action_type: actionType,
      player_id: playerId,
      action_data: actionData,
    });

    if (error) {
      throw error;
    }
  }

  private queueTurnActionAudit(action: GameAction) {
    void this.recordTurnAction(
      action.type,
      getGameActionAuditPlayerId(action),
      action
    ).catch(error => {
      const gameState = store.getState().game;
      this.recordDiagnostic({
        code: 'turn_audit_failed',
        severity: 'warning',
        message: `Failed to record audit trail for ${action.type}`,
        sessionId: this.sessionId,
        actionType: action.type,
        playerId: getGameActionAuditPlayerId(action),
        roundNumber: gameState.roundNumber,
        phase: gameState.currentPhase,
        details: normaliseRealtimeError(error),
      });
    });
  }

  private handlePlayerDisconnect(playerId: string) {
    const session = store.getState().session;

    if (session.isHost && playerId !== session.localPlayerId) {
      const gamePlayer = store.getState().game.players.find(p => p.id === playerId);
      if (gamePlayer) {
        store.dispatch(leaveGame({ playerId }));
        this.broadcastStateSync();
        this.updateSessionPlayerCount();
      }
    }

    if (playerId === session.hostPlayerId && !session.isHost) {
      const newHostId = selectNextHostId(session.connectedPlayerIds, playerId);

      if (newHostId && newHostId === session.localPlayerId) {
        store.dispatch(promoteToHost(newHostId));
        this.channel?.send({
          type: 'broadcast',
          event: 'host_migration',
          payload: { sessionId: this.sessionId ?? undefined, newHostId },
        });

        void this.claimHostAuthority(newHostId).catch(error => {
          this.recordDiagnostic({
            code: 'persistence_save_failed',
            severity: 'warning',
            message: 'Failed to claim host authority after disconnect migration',
            sessionId: this.sessionId,
            playerId: newHostId,
            details: normaliseRealtimeError(error),
          });
        });

        if (store.getState().game.gameMode === 'playing') {
          this.startHostLoop();
        }
      }
    }
  }

  private async updateSessionPlayerCount() {
    if (!this.sessionId) return;
    const playerCount = store.getState().game.players.length;

    try {
      const authority = this.getHostAuthorityContext();
      if (authority) {
        await postSessionAuthorityRequest({
          type: 'updatePlayerCount',
          sessionId: this.sessionId,
          hostPlayerId: authority.hostPlayerId,
          hostToken: authority.hostToken,
          playerCount,
        });
        return;
      }

      if (!supabase) return;
      const { error } = await supabase
        .from('game_sessions')
        .update({ player_count: playerCount, updated_at: new Date().toISOString() })
        .eq('id', this.sessionId);

      if (error) {
        this.recordDiagnostic({
          code: 'player_count_update_failed',
          severity: 'warning',
          message: 'Failed to update session player count',
          sessionId: this.sessionId,
          details: normaliseRealtimeError(error),
        });
      }
    } catch (error) {
      this.recordDiagnostic({
        code: 'player_count_update_failed',
        severity: 'warning',
        message: 'Failed to update session player count',
        sessionId: this.sessionId,
        details: normaliseRealtimeError(error),
      });
    }
  }

  async disconnect() {
    this.stopHostLoop();
    this.stopStateSaveLoop();
    this.clearPendingPlayerDisconnects();

    if (this.sessionId) {
      const session = store.getState().session;
      if (session.isHost) {
        await this.saveGameState();
        const authority = this.getHostAuthorityContext();
        if (authority) {
          try {
            await postSessionAuthorityRequest({
              type: 'markEnded',
              sessionId: this.sessionId,
              hostPlayerId: authority.hostPlayerId,
              hostToken: authority.hostToken,
            });
          } catch (error) {
            this.recordDiagnostic({
              code: 'disconnect_update_failed',
              severity: 'warning',
              message: 'Failed to mark host session as ended during disconnect',
              sessionId: this.sessionId,
              details: normaliseRealtimeError(error),
            });
          }
        } else if (supabase) {
          const { error } = await supabase
            .from('game_sessions')
            .update({ game_mode: 'ended', updated_at: new Date().toISOString() })
            .eq('id', this.sessionId);
          if (error) {
            this.recordDiagnostic({
              code: 'disconnect_update_failed',
              severity: 'warning',
              message: 'Failed to mark host session as ended during disconnect',
              sessionId: this.sessionId,
              details: normaliseRealtimeError(error),
            });
          }
        }
      }
    }

    if (this.channel && supabase) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.sessionId = null;
    this.lastSavedStateHash = null;
    this.hostAuthorityToken = null;
    this.resetStateSyncOrdering();
    this.resetHostActionRateLimits();
    store.dispatch(clearSession());
  }
}

export const realtimeService = new RealtimeService();

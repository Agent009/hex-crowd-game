import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

type GamePhase =
  | 'round_start'
  | 'ap_renewal'
  | 'interaction'
  | 'bartering'
  | 'terrain_effects'
  | 'disaster_check'
  | 'elimination';

type GameActionType =
  | 'join'
  | 'leave'
  | 'ready'
  | 'start'
  | 'move'
  | 'harvest'
  | 'craft'
  | 'useItem'
  | 'proposeTrade'
  | 'acceptTrade'
  | 'rejectTrade'
  | 'cancelTrade'
  | 'recruitHero'
  | 'restHero'
  | 'learnSkill'
  | 'castSpell'
  | 'recruitUnit'
  | 'initiateCombat'
  | 'forceNextPhase'
  | 'endGame';

interface AuthorityPayload {
  source?: string;
  request?: Record<string, unknown>;
}

interface HostAuthoritySessionRow {
  host_player_id: string | null;
  host_authority_token_hash: string | null;
}

interface ClaimHostSessionRow {
  id: string;
  game_mode: string | null;
  game_state: unknown;
}

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const validPhases = new Set<GamePhase>([
  'round_start',
  'ap_renewal',
  'interaction',
  'bartering',
  'terrain_effects',
  'disaster_check',
  'elimination',
]);

const validActionTypes = new Set<GameActionType>([
  'join',
  'leave',
  'ready',
  'start',
  'move',
  'harvest',
  'craft',
  'useItem',
  'proposeTrade',
  'acceptTrade',
  'rejectTrade',
  'cancelTrade',
  'recruitHero',
  'restHero',
  'learnSkill',
  'castSpell',
  'recruitUnit',
  'initiateCombat',
  'forceNextPhase',
  'endGame',
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string) {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isValidGameMode(value: unknown) {
  return value === 'lobby' || value === 'playing' || value === 'ended';
}

function validateGameState(value: unknown): { valid: true } | { valid: false; error: string } {
  if (!isRecord(value)) return { valid: false, error: 'gameState must be an object' };
  if (!isValidGameMode(value.gameMode)) return { valid: false, error: 'gameState.gameMode is invalid' };
  if (typeof value.currentPhase !== 'string' || !validPhases.has(value.currentPhase as GamePhase)) {
    return { valid: false, error: 'gameState.currentPhase is invalid' };
  }
  if (!Number.isInteger(value.roundNumber) || Number(value.roundNumber) < 1) {
    return { valid: false, error: 'gameState.roundNumber is invalid' };
  }
  if (!Array.isArray(value.players) || value.players.length > 30) {
    return { valid: false, error: 'gameState.players is invalid' };
  }
  if (!Array.isArray(value.teams)) return { valid: false, error: 'gameState.teams is invalid' };
  if (!isRecord(value.playerStats)) return { valid: false, error: 'gameState.playerStats is invalid' };
  return { valid: true };
}

function validateWorldState(value: unknown): { valid: true } | { valid: false; error: string } {
  if (!isRecord(value)) return { valid: false, error: 'worldState must be an object' };
  if (!isRecord(value.tiles)) return { valid: false, error: 'worldState.tiles is invalid' };
  if (!Array.isArray(value.activeTiles)) return { valid: false, error: 'worldState.activeTiles is invalid' };
  if (!Number.isInteger(value.worldSize) || Number(value.worldSize) < 0) {
    return { valid: false, error: 'worldState.worldSize is invalid' };
  }
  return { valid: true };
}

function gameStateIncludesPlayer(gameState: unknown, playerId: string): boolean {
  if (!isRecord(gameState) || !Array.isArray(gameState.players)) return false;

  return gameState.players.some(player => (
    isRecord(player) && player.id === playerId
  ));
}

async function verifyHost(
  supabase: SupabaseClient,
  sessionId: string,
  hostPlayerId: string,
  hostToken: string
) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('host_player_id, host_authority_token_hash')
    .eq('id', sessionId)
    .maybeSingle();

  const session = data as HostAuthoritySessionRow | null;
  if (error || !session) return { ok: false, error: 'Session not found' };
  if (session.host_player_id !== hostPlayerId) return { ok: false, error: 'Host player mismatch' };

  const expectedHash = session.host_authority_token_hash;
  if (!expectedHash || expectedHash !== await hashToken(hostToken)) {
    return { ok: false, error: 'Invalid host authority token' };
  }

  return { ok: true };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Session authority is not configured' }, 500);
  }

  let payload: AuthorityPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (payload.source !== 'hex-crowd-game' || !isRecord(payload.request)) {
    return jsonResponse({ error: 'Invalid authority request' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const authorityRequest = payload.request;
  const type = safeString(authorityRequest.type, 40);

  if (type === 'createSession') {
    const sessionCode = safeString(authorityRequest.sessionCode, 6);
    const hostPlayerId = safeString(authorityRequest.hostPlayerId, 120);
    const maxPlayers = authorityRequest.maxPlayers;
    if (!sessionCode || !/^[A-Z2-9]{6}$/.test(sessionCode) || !hostPlayerId) {
      return jsonResponse({ error: 'Invalid createSession payload' }, 400);
    }
    if (!Number.isInteger(maxPlayers) || Number(maxPlayers) < 2 || Number(maxPlayers) > 30) {
      return jsonResponse({ error: 'Invalid maxPlayers' }, 400);
    }

    const hostToken = randomToken();
    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        session_code: sessionCode,
        host_player_id: hostPlayerId,
        game_mode: 'lobby',
        player_count: 1,
        max_players: maxPlayers,
        game_config: isRecord(authorityRequest.gameConfig) ? authorityRequest.gameConfig : {},
        host_authority_token_hash: await hashToken(hostToken),
        host_authority_issued_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (error || !data) return jsonResponse({ error: 'Failed to create session' }, 500);
    return jsonResponse({ ok: true, sessionId: data.id, hostToken }, 201);
  }

  if (type === 'claimHost') {
    const sessionId = safeString(authorityRequest.sessionId, 80);
    const hostPlayerId = safeString(authorityRequest.hostPlayerId, 120);
    if (!sessionId || !hostPlayerId) return jsonResponse({ error: 'Invalid claimHost payload' }, 400);

    const { data: existingSession, error: lookupError } = await supabase
      .from('game_sessions')
      .select('id, game_mode, game_state')
      .eq('id', sessionId)
      .neq('game_mode', 'ended')
      .maybeSingle();

    const claimSession = existingSession as ClaimHostSessionRow | null;
    if (lookupError || !claimSession) return jsonResponse({ error: 'Session is not claimable' }, 404);
    if (!gameStateIncludesPlayer(claimSession.game_state, hostPlayerId)) {
      return jsonResponse({ error: 'Claiming host must be present in saved session state' }, 403);
    }

    const hostToken = randomToken();
    const { data, error } = await supabase
      .from('game_sessions')
      .update({
        host_player_id: hostPlayerId,
        host_authority_token_hash: await hashToken(hostToken),
        host_authority_issued_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .neq('game_mode', 'ended')
      .select('id')
      .maybeSingle();

    if (error || !data) return jsonResponse({ error: 'Failed to claim host authority' }, 500);
    return jsonResponse({ ok: true, sessionId, hostToken }, 202);
  }

  const sessionId = safeString(authorityRequest.sessionId, 80);
  const hostPlayerId = safeString(authorityRequest.hostPlayerId, 120);
  const hostToken = safeString(authorityRequest.hostToken, 160);
  if (!sessionId || !hostPlayerId || !hostToken) {
    return jsonResponse({ error: 'Missing host authority fields' }, 400);
  }

  const hostCheck = await verifyHost(supabase, sessionId, hostPlayerId, hostToken);
  if (!hostCheck.ok) return jsonResponse({ error: hostCheck.error }, 403);

  if (type === 'saveState') {
    const gameValidation = validateGameState(authorityRequest.gameState);
    if (!gameValidation.valid) return jsonResponse({ error: gameValidation.error }, 400);

    const worldValidation = validateWorldState(authorityRequest.worldState);
    if (!worldValidation.valid) return jsonResponse({ error: worldValidation.error }, 400);

    const gameState = authorityRequest.gameState as Record<string, unknown>;
    const { error } = await supabase
      .from('game_sessions')
      .update({
        game_state: authorityRequest.gameState,
        world_state: authorityRequest.worldState,
        round_number: gameState.roundNumber,
        game_mode: gameState.gameMode,
        player_count: Array.isArray(gameState.players) ? gameState.players.length : 0,
        last_saved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) return jsonResponse({ error: 'Failed to save game state' }, 500);
    return jsonResponse({ ok: true }, 202);
  }

  if (type === 'recordAction') {
    const roundNumber = authorityRequest.roundNumber;
    const phase = safeString(authorityRequest.phase, 40);
    const actionType = safeString(authorityRequest.actionType, 40);
    if (!Number.isInteger(roundNumber) || Number(roundNumber) < 1) {
      return jsonResponse({ error: 'Invalid roundNumber' }, 400);
    }
    if (!phase || !validPhases.has(phase as GamePhase)) return jsonResponse({ error: 'Invalid phase' }, 400);
    if (!actionType || !validActionTypes.has(actionType as GameActionType)) {
      return jsonResponse({ error: 'Invalid actionType' }, 400);
    }
    if (!isRecord(authorityRequest.actionData)) return jsonResponse({ error: 'Invalid actionData' }, 400);

    const { error } = await supabase
      .from('game_turn_history')
      .insert({
        session_id: sessionId,
        round_number: roundNumber,
        phase,
        action_type: actionType,
        player_id: safeString(authorityRequest.playerId, 120),
        action_data: authorityRequest.actionData,
      });

    if (error) return jsonResponse({ error: 'Failed to record action' }, 500);
    return jsonResponse({ ok: true }, 202);
  }

  if (type === 'updatePlayerCount') {
    const playerCount = authorityRequest.playerCount;
    if (!Number.isInteger(playerCount) || Number(playerCount) < 0 || Number(playerCount) > 30) {
      return jsonResponse({ error: 'Invalid playerCount' }, 400);
    }

    const { error } = await supabase
      .from('game_sessions')
      .update({ player_count: playerCount, updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) return jsonResponse({ error: 'Failed to update player count' }, 500);
    return jsonResponse({ ok: true }, 202);
  }

  if (type === 'markEnded') {
    const { error } = await supabase
      .from('game_sessions')
      .update({ game_mode: 'ended', updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) return jsonResponse({ error: 'Failed to mark session ended' }, 500);
    return jsonResponse({ ok: true }, 202);
  }

  return jsonResponse({ error: 'Unknown authority request type' }, 400);
});

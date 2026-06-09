import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

type DiagnosticSeverity = 'info' | 'warning' | 'error';

type DiagnosticCode =
  | 'missing_channel'
  | 'broadcast_failed'
  | 'state_sync_failed'
  | 'state_sync_payload_large'
  | 'invalid_state_sync'
  | 'invalid_action'
  | 'persistence_save_failed'
  | 'turn_audit_failed'
  | 'player_count_update_failed'
  | 'player_disconnect_timeout'
  | 'disconnect_update_failed';

interface RealtimeDiagnosticPayload {
  source?: string;
  diagnostic?: {
    id?: unknown;
    code?: unknown;
    severity?: unknown;
    message?: unknown;
    timestamp?: unknown;
    sessionId?: unknown;
    actionType?: unknown;
    playerId?: unknown;
    roundNumber?: unknown;
    phase?: unknown;
    details?: unknown;
  };
}

const allowedCodes = new Set<DiagnosticCode>([
  'missing_channel',
  'broadcast_failed',
  'state_sync_failed',
  'state_sync_payload_large',
  'invalid_state_sync',
  'invalid_action',
  'persistence_save_failed',
  'turn_audit_failed',
  'player_count_update_failed',
  'player_disconnect_timeout',
  'disconnect_update_failed',
]);

const allowedSeverities = new Set<DiagnosticSeverity>(['info', 'warning', 'error']);
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
    },
  });
}

function safeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function safeNullableString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  return safeString(value, maxLength);
}

function safeDetails(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const details = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(details)
      .filter(([, entryValue]) => (
        entryValue === null
        || ['string', 'number', 'boolean'].includes(typeof entryValue)
      ))
      .slice(0, 20)
  );
}

function normalisePayload(payload: RealtimeDiagnosticPayload) {
  if (payload.source !== 'hex-crowd-game') {
    return { error: 'Invalid source' };
  }

  const diagnostic = payload.diagnostic;
  if (!diagnostic || typeof diagnostic !== 'object') {
    return { error: 'Missing diagnostic' };
  }

  const code = safeString(diagnostic.code, 80) as DiagnosticCode | null;
  if (!code || !allowedCodes.has(code)) {
    return { error: 'Invalid diagnostic code' };
  }

  const severity = safeString(diagnostic.severity, 20) as DiagnosticSeverity | null;
  if (!severity || !allowedSeverities.has(severity)) {
    return { error: 'Invalid diagnostic severity' };
  }

  const diagnosticId = safeString(diagnostic.id, 120);
  const message = safeString(diagnostic.message, 500);
  const timestamp = safeString(diagnostic.timestamp, 80);
  if (!diagnosticId || !message || !timestamp) {
    return { error: 'Missing required diagnostic fields' };
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return { error: 'Invalid diagnostic timestamp' };
  }

  const roundNumber = typeof diagnostic.roundNumber === 'number' && Number.isInteger(diagnostic.roundNumber)
    ? diagnostic.roundNumber
    : null;

  return {
    record: {
      diagnostic_id: diagnosticId,
      code,
      severity,
      message,
      session_id: safeNullableString(diagnostic.sessionId, 80),
      action_type: safeNullableString(diagnostic.actionType, 80),
      player_id: safeNullableString(diagnostic.playerId, 120),
      round_number: roundNumber,
      phase: safeNullableString(diagnostic.phase, 80),
      details: safeDetails(diagnostic.details),
      diagnostic_timestamp: parsedTimestamp.toISOString(),
    },
  };
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
    return jsonResponse({ error: 'Diagnostics sink is not configured' }, 500);
  }

  let payload: RealtimeDiagnosticPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const normalised = normalisePayload(payload);
  if ('error' in normalised) {
    return jsonResponse({ error: normalised.error }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase
    .from('realtime_diagnostics')
    .insert(normalised.record);

  if (error) {
    return jsonResponse({ error: 'Failed to store diagnostic' }, 500);
  }

  return jsonResponse({ ok: true }, 202);
});

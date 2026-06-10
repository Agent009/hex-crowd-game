/*
  # Store realtime diagnostics emitted by the game client

  Diagnostics are written by the `realtime-diagnostics` Edge Function using a
  service role key. Public clients do not write directly to this table.
*/

CREATE TABLE IF NOT EXISTS realtime_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id text NOT NULL,
  code text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  session_id uuid,
  action_type text,
  player_id text,
  round_number integer,
  phase text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnostic_timestamp timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realtime_diagnostics_received_at
  ON realtime_diagnostics (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_diagnostics_session_received
  ON realtime_diagnostics (session_id, received_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_realtime_diagnostics_code_received
  ON realtime_diagnostics (code, received_at DESC);

ALTER TABLE realtime_diagnostics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_realtime_diagnostics_code'
  ) THEN
    ALTER TABLE realtime_diagnostics
      ADD CONSTRAINT chk_realtime_diagnostics_code
      CHECK (
        code IN (
          'missing_channel',
          'broadcast_failed',
          'state_sync_failed',
          'state_sync_payload_large',
          'invalid_state_sync',
          'invalid_action',
          'action_rate_limited',
          'persistence_save_failed',
          'turn_audit_failed',
          'player_count_update_failed',
          'player_disconnect_timeout',
          'disconnect_update_failed'
        )
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_realtime_diagnostics_severity'
  ) THEN
    ALTER TABLE realtime_diagnostics
      ADD CONSTRAINT chk_realtime_diagnostics_severity
      CHECK (severity IN ('info', 'warning', 'error')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_realtime_diagnostics_message_length'
  ) THEN
    ALTER TABLE realtime_diagnostics
      ADD CONSTRAINT chk_realtime_diagnostics_message_length
      CHECK (char_length(message) BETWEEN 1 AND 500) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_realtime_diagnostics_phase'
  ) THEN
    ALTER TABLE realtime_diagnostics
      ADD CONSTRAINT chk_realtime_diagnostics_phase
      CHECK (
        phase IS NULL OR phase IN (
          'round_start',
          'ap_renewal',
          'interaction',
          'bartering',
          'terrain_effects',
          'disaster_check',
          'elimination'
        )
      ) NOT VALID;
  END IF;
END $$;

CREATE POLICY "No direct anonymous diagnostic writes"
  ON realtime_diagnostics
  FOR INSERT
  TO anon
  WITH CHECK (false);

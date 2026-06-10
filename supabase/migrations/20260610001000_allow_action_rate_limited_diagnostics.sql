/*
  # Allow action-rate-limit diagnostics

  Existing test projects may already have the original realtime diagnostic code
  constraint. Recreate it so the optional diagnostics sink can store host action
  flood-control events emitted by the client.
*/

ALTER TABLE realtime_diagnostics
  DROP CONSTRAINT IF EXISTS chk_realtime_diagnostics_code;

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

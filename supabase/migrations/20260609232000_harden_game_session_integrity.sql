/*
  # Harden multiplayer session data integrity

  Adds defensive database constraints for future writes without assuming every
  existing playtest row is already clean. NOT VALID constraints still apply to
  new/updated rows, and can be validated later after old data is cleaned.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_game_sessions_session_code_format'
  ) THEN
    ALTER TABLE game_sessions
      ADD CONSTRAINT chk_game_sessions_session_code_format
      CHECK (session_code ~ '^[A-Z2-9]{6}$') NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_game_sessions_game_mode'
  ) THEN
    ALTER TABLE game_sessions
      ADD CONSTRAINT chk_game_sessions_game_mode
      CHECK (game_mode IN ('lobby', 'playing', 'ended')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_game_sessions_player_counts'
  ) THEN
    ALTER TABLE game_sessions
      ADD CONSTRAINT chk_game_sessions_player_counts
      CHECK (
        max_players BETWEEN 2 AND 30
        AND player_count BETWEEN 0 AND max_players
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_game_sessions_round_number'
  ) THEN
    ALTER TABLE game_sessions
      ADD CONSTRAINT chk_game_sessions_round_number
      CHECK (round_number IS NULL OR round_number >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_game_sessions_state_json'
  ) THEN
    ALTER TABLE game_sessions
      ADD CONSTRAINT chk_game_sessions_state_json
      CHECK (
        (game_state IS NULL OR jsonb_typeof(game_state) = 'object')
        AND (world_state IS NULL OR jsonb_typeof(world_state) = 'object')
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_turn_history_round_number'
  ) THEN
    ALTER TABLE game_turn_history
      ADD CONSTRAINT chk_turn_history_round_number
      CHECK (round_number >= 1) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_turn_history_phase'
  ) THEN
    ALTER TABLE game_turn_history
      ADD CONSTRAINT chk_turn_history_phase
      CHECK (
        phase IN (
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_turn_history_action_type'
  ) THEN
    ALTER TABLE game_turn_history
      ADD CONSTRAINT chk_turn_history_action_type
      CHECK (
        action_type IN (
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
          'endGame'
        )
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_game_sessions_cleanup
  ON game_sessions (game_mode, updated_at)
  WHERE game_mode = 'ended';

CREATE OR REPLACE FUNCTION delete_ended_game_sessions(older_than interval DEFAULT interval '7 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM game_sessions
  WHERE game_mode = 'ended'
    AND updated_at < now() - older_than;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION delete_ended_game_sessions(interval) FROM PUBLIC;

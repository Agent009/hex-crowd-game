/*
  # Add optional server-owned session authority controls

  The browser can still use direct Supabase writes in local/dev environments, but
  production can deploy `supabase/functions/session-authority` and configure
  `VITE_SESSION_AUTHORITY_ENDPOINT` so host persistence, player-count updates,
  session end writes, and turn audit writes happen through a service-role Edge
  Function instead of direct anonymous table writes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'host_authority_token_hash'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN host_authority_token_hash text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'host_authority_issued_at'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN host_authority_issued_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_game_sessions_host_authority_hash'
  ) THEN
    ALTER TABLE game_sessions
      ADD CONSTRAINT chk_game_sessions_host_authority_hash
      CHECK (
        host_authority_token_hash IS NULL
        OR host_authority_token_hash ~ '^[a-f0-9]{64}$'
      ) NOT VALID;
  END IF;
END $$;

DROP POLICY IF EXISTS "Host can update their session" ON game_sessions;
DROP POLICY IF EXISTS "Anyone can insert turn history" ON game_turn_history;

CREATE POLICY "No direct anonymous session updates when authority gateway is used"
  ON game_sessions
  FOR UPDATE
  TO anon
  USING (host_authority_token_hash IS NULL)
  WITH CHECK (host_authority_token_hash IS NULL);

CREATE POLICY "No direct anonymous turn-history writes when authority gateway is used"
  ON game_turn_history
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_sessions
      WHERE game_sessions.id = game_turn_history.session_id
      AND game_sessions.game_mode IN ('lobby', 'playing')
      AND game_sessions.host_authority_token_hash IS NULL
    )
  );

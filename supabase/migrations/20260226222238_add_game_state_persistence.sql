/*
  # Add Game State Persistence

  1. Changes to `game_sessions` table
    - `game_state` (jsonb) - Full Redux game state (players, teams, phase, etc.)
    - `world_state` (jsonb) - Full Redux world state (tiles, activeTiles)
    - `last_saved_at` (timestamptz) - Timestamp of last state save
    - `round_number` (integer) - Current round for quick queries

  2. New Tables
    - `game_turn_history`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to game_sessions)
      - `round_number` (integer) - Which round this action occurred in
      - `phase` (text) - Which phase the action occurred in
      - `action_type` (text) - Type of action (move, harvest, trade, etc.)
      - `player_id` (text) - Player who took the action
      - `action_data` (jsonb) - Full action payload
      - `created_at` (timestamptz) - When the action was recorded

  3. Security
    - Enable RLS on `game_turn_history` table
    - Allow anonymous users to read/write turn history for active sessions

  4. Notes
    - State is stored as JSONB for flexibility with evolving schema
    - Turn history enables replay and debugging
    - round_number on sessions allows quick "active games" queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'game_state'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN game_state jsonb DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'world_state'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN world_state jsonb DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'last_saved_at'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN last_saved_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'round_number'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN round_number integer DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS game_turn_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  phase text NOT NULL,
  action_type text NOT NULL,
  player_id text,
  action_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turn_history_session ON game_turn_history(session_id);
CREATE INDEX IF NOT EXISTS idx_turn_history_session_round ON game_turn_history(session_id, round_number);

ALTER TABLE game_turn_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read turn history for active sessions"
  ON game_turn_history
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM game_sessions
      WHERE game_sessions.id = game_turn_history.session_id
      AND game_sessions.game_mode IN ('lobby', 'playing')
    )
  );

CREATE POLICY "Anyone can insert turn history"
  ON game_turn_history
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_sessions
      WHERE game_sessions.id = game_turn_history.session_id
      AND game_sessions.game_mode IN ('lobby', 'playing')
    )
  );

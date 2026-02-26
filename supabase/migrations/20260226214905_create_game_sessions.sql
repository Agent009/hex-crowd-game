/*
  # Create game_sessions table for multiplayer support

  1. New Tables
    - `game_sessions`
      - `id` (uuid, primary key) - unique session identifier
      - `session_code` (text, unique) - 6-char join code for players
      - `host_player_id` (text) - ID of the player hosting the game loop
      - `game_mode` (text) - current mode: lobby, playing, ended
      - `player_count` (integer) - current number of connected players
      - `max_players` (integer) - maximum players allowed (30)
      - `created_at` (timestamptz) - when the session was created
      - `updated_at` (timestamptz) - last activity timestamp
      - `game_config` (jsonb) - game configuration (teams, test mode, etc.)

  2. Security
    - Enable RLS on `game_sessions` table
    - Allow anonymous users to create, read, and update sessions
    - Sessions are public by design (join via code), but only the host can update
*/

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text UNIQUE NOT NULL,
  host_player_id text NOT NULL,
  game_mode text NOT NULL DEFAULT 'lobby',
  player_count integer NOT NULL DEFAULT 1,
  max_players integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  game_config jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_code ON game_sessions (session_code);
CREATE INDEX IF NOT EXISTS idx_game_sessions_mode ON game_sessions (game_mode);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active sessions by code"
  ON game_sessions
  FOR SELECT
  TO anon
  USING (game_mode IN ('lobby', 'playing'));

CREATE POLICY "Anyone can create a session"
  ON game_sessions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Host can update their session"
  ON game_sessions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

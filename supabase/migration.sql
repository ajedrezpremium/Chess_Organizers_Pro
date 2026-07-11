-- Chess Organizers Pro — Supabase PostgreSQL Migration
-- Copy and paste this whole file into Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

-- ============================================================
-- SCHEMA COMPLETO (19 tablas + índices + datos semilla)
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'organizer'
                          CHECK(role IN ('admin','arbiter','organizer','federation')),
  federation    TEXT    DEFAULT '',
  fide_id       TEXT    DEFAULT '',
  verified      INTEGER DEFAULT 0,
  push_token    TEXT    DEFAULT '',
  push_platform TEXT    DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id              SERIAL PRIMARY KEY,
  name            TEXT    NOT NULL,
  federation      TEXT    DEFAULT '',
  city            TEXT    DEFAULT '',
  start_date      TEXT,
  end_date        TEXT,
  system          TEXT    NOT NULL DEFAULT 'dutch'
                          CHECK(system IN ('dutch','roundrobin','burstein','dubov')),
  n_rounds        INTEGER NOT NULL DEFAULT 6,
  time_control    TEXT    DEFAULT '90+30',
  rated           INTEGER DEFAULT 1,
  chief_arbiter   TEXT    DEFAULT '',
  deputy_arbiter  TEXT    DEFAULT '',
  tournament_type TEXT    DEFAULT 'S',
  status          TEXT    DEFAULT 'pending'
                          CHECK(status IN ('pending','active','finished','cancelled')),
  tiebreaks       TEXT    DEFAULT 'BH1,BH,SB,DE,PR',
  description     TEXT    DEFAULT '',
  banner_url      TEXT    DEFAULT '',
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  -- migrated columns
  primary_color   TEXT    DEFAULT '#f59e0b',
  secondary_color TEXT    DEFAULT '#1f2937',
  logo_url        TEXT    DEFAULT '',
  submitted_to_fide INTEGER DEFAULT 0,
  submitted_at    TIMESTAMPTZ,
  categories      TEXT    DEFAULT '',
  stream_url      TEXT    DEFAULT '',
  stream_platform TEXT    DEFAULT '',
  registration_fee INTEGER DEFAULT 0,
  registration_currency TEXT DEFAULT 'usd',
  auto_approve    INTEGER DEFAULT 0,
  custom_fields   TEXT    DEFAULT '[]',
  registration_open INTEGER DEFAULT 1,
  registration_opens_at TEXT DEFAULT '',
  registration_closes_at TEXT DEFAULT '',
  max_players     INTEGER DEFAULT 0,
  registered_count INTEGER DEFAULT 0,
  fide_event_id   TEXT    DEFAULT '',
  fide_approved   INTEGER DEFAULT 0,
  deputy_arbiter_2 TEXT   DEFAULT '',
  tournament_director TEXT DEFAULT '',
  location_address TEXT   DEFAULT '',
  round_time      TEXT    DEFAULT '',
  -- NEW: demo tournaments
  is_demo         INTEGER DEFAULT 0
);

-- Players
CREATE TABLE IF NOT EXISTS players (
  id              SERIAL PRIMARY KEY,
  fide_id         TEXT    DEFAULT '',
  name            TEXT    NOT NULL,
  last_name       TEXT    DEFAULT '',
  title           TEXT    DEFAULT '',
  federation      TEXT    DEFAULT '',
  fide_rating     INTEGER DEFAULT 0,
  national_rating INTEGER DEFAULT 0,
  birth_date      TEXT    DEFAULT '',
  sex             TEXT    DEFAULT '',
  email           TEXT    DEFAULT '',
  phone           TEXT    DEFAULT '',
  notes           TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament Players
CREATE TABLE IF NOT EXISTS tournament_players (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seed_rank       INTEGER DEFAULT 0,
  current_points  REAL    DEFAULT 0,
  color_diff      INTEGER DEFAULT 0,
  color_history   TEXT    DEFAULT '',
  opponents       TEXT    DEFAULT '',
  penalty_points  REAL    DEFAULT 0,
  received_bye    INTEGER DEFAULT 0,
  withdrawn       INTEGER DEFAULT 0,
  final_position  INTEGER,
  category        TEXT    DEFAULT '',
  checked_in      INTEGER DEFAULT 0,
  tiebreak_values TEXT    DEFAULT '',
  UNIQUE(tournament_id, player_id)
);

-- Rounds
CREATE TABLE IF NOT EXISTS rounds (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number    INTEGER NOT NULL,
  status          TEXT    DEFAULT 'pending'
                          CHECK(status IN ('pending','generated','published','closed')),
  published_at    TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, round_number)
);

-- Pairings
CREATE TABLE IF NOT EXISTS pairings (
  id              SERIAL PRIMARY KEY,
  round_id        INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  board           INTEGER NOT NULL,
  white_id        INTEGER REFERENCES tournament_players(id),
  black_id        INTEGER REFERENCES tournament_players(id),
  result          TEXT    DEFAULT '-'
                          CHECK(result IN ('1','0','=','U','F','H','Z','-')),
  is_bye          INTEGER DEFAULT 0,
  white_rating    INTEGER DEFAULT 0,
  black_rating    INTEGER DEFAULT 0,
  UNIQUE(round_id, board)
);

-- Tiebreak Config
CREATE TABLE IF NOT EXISTS tiebreak_config (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  tiebreak_order  TEXT    NOT NULL DEFAULT 'BH1,BH,SB,DE,PR',
  tiebreak_codes  TEXT    DEFAULT '',
  UNIQUE(tournament_id)
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  short_name      TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id              SERIAL PRIMARY KEY,
  team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tournament_player_id INTEGER NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  board_number    INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, tournament_player_id),
  UNIQUE(team_id, board_number)
);

-- Registration Requests
CREATE TABLE IF NOT EXISTS registration_requests (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  last_name       TEXT    DEFAULT '',
  email           TEXT    DEFAULT '',
  fide_id         TEXT    DEFAULT '',
  fide_rating     INTEGER DEFAULT 0,
  federation      TEXT    DEFAULT '',
  title           TEXT    DEFAULT '',
  phone           TEXT    DEFAULT '',
  notes           TEXT    DEFAULT '',
  custom_data     TEXT    DEFAULT '',
  paid            INTEGER DEFAULT 0,
  stripe_payment_intent_id TEXT DEFAULT '',
  stripe_checkout_session_id TEXT DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','approved','rejected')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Federation Settings
CREATE TABLE IF NOT EXISTS federation_settings (
  id              SERIAL PRIMARY KEY,
  federation      TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  logo_url        TEXT    DEFAULT '',
  default_system  TEXT    DEFAULT 'dutch',
  default_rounds  INTEGER DEFAULT 6,
  api_enabled     INTEGER DEFAULT 0,
  api_key         TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Membership Plans
CREATE TABLE IF NOT EXISTS membership_plans (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,
  description TEXT    DEFAULT '',
  price_mxn   INTEGER NOT NULL DEFAULT 0,
  price_usd   REAL    NOT NULL DEFAULT 0,
  max_tournaments INTEGER DEFAULT -1,
  max_players_per_tournament INTEGER DEFAULT -1,
  features    TEXT    DEFAULT '[]',
  recommended INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- User Memberships
CREATE TABLE IF NOT EXISTS user_memberships (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  plan_id     INTEGER NOT NULL REFERENCES membership_plans(id),
  status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','expired')),
  stripe_customer_id TEXT DEFAULT '',
  stripe_subscription_id TEXT DEFAULT '',
  stripe_price_id TEXT DEFAULT '',
  cancel_at_period_end INTEGER DEFAULT 0,
  current_period_end TIMESTAMPTZ,
  start_date  TIMESTAMPTZ DEFAULT NOW(),
  end_date    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  body          TEXT    DEFAULT '',
  read          INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- User Notification Settings
CREATE TABLE IF NOT EXISTS user_notification_settings (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  telegram_token TEXT   DEFAULT '',
  telegram_chat_id TEXT DEFAULT '',
  twilio_phone  TEXT    DEFAULT '',
  email_enabled INTEGER DEFAULT 1,
  notify_rounds  INTEGER DEFAULT 1,
  notify_results INTEGER DEFAULT 1,
  notify_finished INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  key           TEXT    NOT NULL UNIQUE,
  active        INTEGER DEFAULT 1,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  url           TEXT    NOT NULL,
  event_type    TEXT    NOT NULL,
  active        INTEGER DEFAULT 1,
  last_triggered_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament Arbiters
CREATE TABLE IF NOT EXISTS tournament_arbiters (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Leagues
CREATE TABLE IF NOT EXISTS leagues (
  id            SERIAL PRIMARY KEY,
  name          TEXT    NOT NULL,
  description   TEXT    DEFAULT '',
  federation    TEXT    DEFAULT '',
  season        TEXT    DEFAULT '',
  scoring_system TEXT   DEFAULT 'placement',
  status        TEXT    DEFAULT 'active' CHECK(status IN ('active','finished','cancelled')),
  created_by    INTEGER REFERENCES users(id),
  logo_url      TEXT    DEFAULT '',
  tiebreaks     TEXT    DEFAULT 'BH1,BH,SB,DE,PR',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- League Tournaments
CREATE TABLE IF NOT EXISTS league_tournaments (
  id            SERIAL PRIMARY KEY,
  league_id     INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number  INTEGER DEFAULT 1,
  weight        REAL    DEFAULT 1.0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, tournament_id)
);

-- League Participants
CREATE TABLE IF NOT EXISTS league_participants (
  id            SERIAL PRIMARY KEY,
  league_id     INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id     INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  total_points  REAL    DEFAULT 0,
  tournaments_played INTEGER DEFAULT 0,
  best_result   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, player_id)
);

-- Team Matches
CREATE TABLE IF NOT EXISTS team_matches (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
  home_team_id  INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id  INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_date    TEXT,
  location      TEXT    DEFAULT '',
  round         INTEGER DEFAULT 1,
  status        TEXT    DEFAULT 'pending' CHECK(status IN ('pending','active','finished','cancelled')),
  home_score    REAL    DEFAULT 0,
  away_score    REAL    DEFAULT 0,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Match Pairings
CREATE TABLE IF NOT EXISTS match_pairings (
  id              SERIAL PRIMARY KEY,
  team_match_id   INTEGER NOT NULL REFERENCES team_matches(id) ON DELETE CASCADE,
  board           INTEGER NOT NULL,
  home_player_id  INTEGER REFERENCES tournament_players(id) ON DELETE SET NULL,
  away_player_id  INTEGER REFERENCES tournament_players(id) ON DELETE SET NULL,
  result          TEXT    DEFAULT '-' CHECK(result IN ('1','0','=','U','F','H','Z','-')),
  home_rating     INTEGER DEFAULT 0,
  away_rating     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_match_id, board)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_player    ON tournament_players(player_id);
CREATE INDEX IF NOT EXISTS idx_rounds_tournament             ON rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_pairings_round                ON pairings(round_id);
CREATE INDEX IF NOT EXISTS idx_players_fide                  ON players(fide_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by        ON tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user            ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread          ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_webhooks_user                 ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_tournament           ON webhooks(tournament_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user                 ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key                  ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_league_tournaments_league     ON league_tournaments(league_id);
CREATE INDEX IF NOT EXISTS idx_league_participants_league    ON league_participants(league_id);
CREATE INDEX IF NOT EXISTS idx_team_matches_tournament       ON team_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_match_pairings_match          ON match_pairings(team_match_id);

-- ============================================================
-- DATOS SEMILLA — Planes de membresía
-- ============================================================
INSERT INTO membership_plans (name, slug, description, price_mxn, price_usd, max_tournaments, max_players_per_tournament, features, recommended)
VALUES
  ('Free',     'free',   'Para organizadores que inician', 0, 0,    2,  30,  '["Hasta 2 torneos activos","30 jugadores por torneo","Pairings automáticos","Clasificación en vivo","Exportación PDF/CSV/TRF","Página pública del torneo"]', 0),
  ('Básico',   'basico', 'Para clubes y torneos locales',  199, 9.99, 10, 100, '["Hasta 10 torneos activos","100 jugadores por torneo","Todo lo de Free","Múltiples árbitros","Check-in de jugadores","Widgets embeddables","Sin anuncios"]', 1),
  ('Pro',      'pro',    'Para federaciones y eventos grandes', 499, 24.99, -1, -1, '["Torneos ilimitados","Jugadores ilimitados","Todo lo de Básico","Subida FIDE automática","Boletines PDF automáticos","API pública","Soporte prioritario","Múltiples organizadores"]', 0)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SCANNER / PGN IMPORT TABLES
-- ============================================================

-- Scan Jobs - tracking de escaneos
CREATE TABLE IF NOT EXISTS scan_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tournament_id   INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
  file_path       TEXT    NOT NULL,
  file_name       TEXT    NOT NULL,
  file_size       INTEGER NOT NULL,
  mime_type       TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'queued'
                          CHECK(status IN ('queued','processing','completed','failed')),
  progress        INTEGER DEFAULT 0,
  current_step    TEXT    DEFAULT 'uploaded',
  ocr_text        TEXT    DEFAULT '',
  parsed_data     JSONB   DEFAULT '{}',
  result_metadata JSONB   DEFAULT '{}',
  error_message   TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_user ON scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_tournament ON scan_jobs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);

-- Scan Games - partidas extraídas
CREATE TABLE IF NOT EXISTS scan_games (
  id              SERIAL PRIMARY KEY,
  job_id          UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
  round_number    INTEGER DEFAULT 1,
  board_number    INTEGER DEFAULT 1,
  white_name      TEXT    DEFAULT '',
  white_last_name TEXT    DEFAULT '',
  white_fide_id   TEXT    DEFAULT '',
  white_rating    INTEGER DEFAULT 0,
  white_title     TEXT    DEFAULT '',
  white_federation TEXT   DEFAULT '',
  black_name      TEXT    DEFAULT '',
  black_last_name TEXT    DEFAULT '',
  black_fide_id   TEXT    DEFAULT '',
  black_rating    INTEGER DEFAULT 0,
  black_title     TEXT    DEFAULT '',
  black_federation TEXT   DEFAULT '',
  result          TEXT    DEFAULT '-'
                          CHECK(result IN ('1-0','0-1','1/2-1/2','*','-')),
  moves           TEXT    DEFAULT '',
  confidence      REAL    DEFAULT 0,
  metadata        JSONB   DEFAULT '{}',
  imported        INTEGER DEFAULT 0,
  imported_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_games_job ON scan_games(job_id);
CREATE INDEX IF NOT EXISTS idx_scan_games_imported ON scan_games(imported);

-- Trigger para updated_at en scan_jobs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_scan_jobs_updated_at ON scan_jobs;
CREATE TRIGGER update_scan_jobs_updated_at
  BEFORE UPDATE ON scan_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

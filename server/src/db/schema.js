/**
 * schema.js — Esquema de base de datos FIDE-compliant
 *
 * Tablas: users, tournaments, players, tournament_players,
 *         rounds, pairings, tiebreak_config, federation_settings
 *
 * Ejecutar: node src/db/schema.js
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const DB_PATH = config.db.path;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'organizer'
                         CHECK(role IN ('admin','arbiter','organizer','federation')),
  federation    TEXT    DEFAULT '',
  fide_id       TEXT    DEFAULT '',
  verified      INTEGER DEFAULT 0,
  created_at    TEXT    DEFAULT (datetime('now')),
  updated_at    TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournaments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at      TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournament_players (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seed_rank       INTEGER DEFAULT 0,
  current_points  REAL    DEFAULT 0,
  color_diff      INTEGER DEFAULT 0,
  color_history   TEXT    DEFAULT '',  -- JSON array
  opponents       TEXT    DEFAULT '',  -- JSON array
  received_bye    INTEGER DEFAULT 0,
  withdrawn       INTEGER DEFAULT 0,
  final_position  INTEGER,
  UNIQUE(tournament_id, player_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number    INTEGER NOT NULL,
  status          TEXT    DEFAULT 'pending'
                          CHECK(status IN ('pending','generated','published','closed')),
  published_at    TEXT,
  closed_at       TEXT,
  created_at      TEXT    DEFAULT (datetime('now')),
  UNIQUE(tournament_id, round_number)
);

CREATE TABLE IF NOT EXISTS pairings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS tiebreak_config (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  tiebreak_order  TEXT    NOT NULL DEFAULT 'BH1,BH,SB,DE,PR',
  tiebreak_codes  TEXT    DEFAULT '',
  UNIQUE(tournament_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  short_name      TEXT    DEFAULT '',
  created_at      TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_members (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tournament_player_id INTEGER NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  board_number    INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    DEFAULT (datetime('now')),
  UNIQUE(team_id, tournament_player_id),
  UNIQUE(team_id, board_number)
);

CREATE TABLE IF NOT EXISTS registration_requests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
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
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','approved','rejected')),
  created_at      TEXT    DEFAULT (datetime('now')),
  updated_at      TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS federation_settings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  federation      TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  logo_url        TEXT    DEFAULT '',
  default_system  TEXT    DEFAULT 'dutch',
  default_rounds  INTEGER DEFAULT 6,
  api_enabled     INTEGER DEFAULT 0,
  api_key         TEXT    DEFAULT '',
  created_at      TEXT    DEFAULT (datetime('now'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_player    ON tournament_players(player_id);
CREATE INDEX IF NOT EXISTS idx_rounds_tournament             ON rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_pairings_round                ON pairings(round_id);
CREATE INDEX IF NOT EXISTS idx_players_fide                  ON players(fide_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by        ON tournaments(created_by);
`;

export function migrate() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(SCHEMA);

  // Migraciones posteriores (ALTER TABLE seguros)
  const migrations = [
    `ALTER TABLE tournaments ADD COLUMN primary_color   TEXT DEFAULT '#f59e0b'`,
    `ALTER TABLE tournaments ADD COLUMN secondary_color TEXT DEFAULT '#1f2937'`,
    `ALTER TABLE tournaments ADD COLUMN logo_url        TEXT DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); console.log(`  ✓ ${sql.slice(0, 50)}…`); } catch { /* ya existe */ }
  }

  // 2026-05: submitted_to_fide flag
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN submitted_to_fide INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN submitted_at TEXT`); } catch {}

  // 2026-05: Membership / subscription
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS membership_plans (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        slug        TEXT    NOT NULL UNIQUE,
        description TEXT    DEFAULT '',
        price_mxn   INTEGER NOT NULL DEFAULT 0,
        price_usd   REAL    NOT NULL DEFAULT 0,
        max_tournaments INTEGER DEFAULT -1,
        max_players_per_tournament INTEGER DEFAULT -1,
        features    TEXT    DEFAULT '[]',
        recommended INTEGER DEFAULT 0,
        created_at  TEXT    DEFAULT (datetime('now'))
      )
    `);
  } catch {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_memberships (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id),
        plan_id     INTEGER NOT NULL REFERENCES membership_plans(id),
        status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','expired')),
        start_date  TEXT    DEFAULT (datetime('now')),
        end_date    TEXT,
        created_at  TEXT    DEFAULT (datetime('now')),
        UNIQUE(user_id, plan_id)
      )
    `);
  } catch {}

  // Seed default plans
  const existingPlans = db.prepare('SELECT COUNT(*) as c FROM membership_plans').get().c;
  if (existingPlans === 0) {
    const insertPlan = db.prepare('INSERT INTO membership_plans (name, slug, description, price_mxn, price_usd, max_tournaments, max_players_per_tournament, features, recommended) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insertPlan.run('Free', 'free', 'Para organizadores que inician', 0, 0, 2, 30, JSON.stringify(['Hasta 2 torneos activos', '30 jugadores por torneo', 'Pairings automáticos', 'Clasificación en vivo', 'Exportación PDF/CSV/TRF', 'Página pública del torneo']), 0);
    insertPlan.run('Básico', 'basico', 'Para clubes y torneos locales', 199, 9.99, 10, 100, JSON.stringify(['Hasta 10 torneos activos', '100 jugadores por torneo', 'Todo lo de Free', 'Múltiples árbitros', 'Check-in de jugadores', 'Widgets embeddables', 'Sin anuncios']), 1);
    insertPlan.run('Pro', 'pro', 'Para federaciones y eventos grandes', 499, 24.99, -1, -1, JSON.stringify(['Torneos ilimitados', 'Jugadores ilimitados', 'Todo lo de Básico', 'Subida FIDE automática', 'Boletines PDF automáticos', 'API pública', 'Soporte prioritario', 'Múltiples organizadores']), 0);
    console.log('  ✓ Planes de membresía sembrados');
  }

  // 2026-05: Schedule per round
  try { db.exec(`ALTER TABLE rounds ADD COLUMN scheduled_at TEXT`); } catch {}

  // 2026-05: Notifications center + Telegram/Twilio settings
  const migrationsNotify = [
    `CREATE TABLE IF NOT EXISTS notifications (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
      type          TEXT    NOT NULL,
      title         TEXT    NOT NULL,
      body          TEXT    DEFAULT '',
      read          INTEGER DEFAULT 0,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS user_notification_settings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      telegram_token TEXT   DEFAULT '',
      telegram_chat_id TEXT DEFAULT '',
      twilio_phone  TEXT    DEFAULT '',
      email_enabled INTEGER DEFAULT 1,
      notify_rounds  INTEGER DEFAULT 1,
      notify_results INTEGER DEFAULT 1,
      notify_finished INTEGER DEFAULT 1,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read)`,
  ];
  for (const sql of migrationsNotify) {
    try { db.exec(sql); } catch { /* ya existe */ }
  }

  // 2026-05: Categories (U8, U10, Open, etc.)
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN categories TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE tournament_players ADD COLUMN category TEXT DEFAULT ''`); } catch {}

  // 2026-05: Live stream URL
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN stream_url TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN stream_platform TEXT DEFAULT ''`); } catch {}

  // 2026-05: API Keys + Webhooks
  const migrations3 = [
    `CREATE TABLE IF NOT EXISTS api_keys (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT    NOT NULL,
      key           TEXT    NOT NULL UNIQUE,
      last_used_at  TEXT,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS webhooks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
      url           TEXT    NOT NULL,
      event_type    TEXT    NOT NULL,
      active        INTEGER DEFAULT 1,
      last_triggered_at TEXT,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_webhooks_tournament ON webhooks(tournament_id)`,
    `CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)`,
  ];
  for (const sql of migrations3) {
    try { db.exec(sql); console.log(`  ✓ ${sql.slice(0, 50)}…`); } catch { /* ya existe */ }
  }

  // 2026-05: Stripe subscription columns
  try { db.exec(`ALTER TABLE user_memberships ADD COLUMN stripe_customer_id TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE user_memberships ADD COLUMN stripe_subscription_id TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE user_memberships ADD COLUMN stripe_price_id TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE user_memberships ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE user_memberships ADD COLUMN current_period_end TEXT`); } catch {}

  // 2026-05: Registration fee + custom fields + auto approve
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN registration_fee INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN registration_currency TEXT DEFAULT 'usd'`); } catch {}
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN auto_approve INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE tournaments ADD COLUMN custom_fields TEXT DEFAULT '[]'`); } catch {}
  try { db.exec(`ALTER TABLE registration_requests ADD COLUMN custom_data TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE registration_requests ADD COLUMN paid INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE registration_requests ADD COLUMN stripe_payment_intent_id TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE registration_requests ADD COLUMN stripe_checkout_session_id TEXT DEFAULT ''`); } catch {}

  // 2026-05: Árbitros de torneo + check-in
  const migrations2 = [
    `CREATE TABLE IF NOT EXISTS tournament_arbiters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tournament_id, user_id)
    )`,
    `ALTER TABLE tournament_players ADD COLUMN checked_in INTEGER DEFAULT 0`,
  ];
  for (const sql of migrations2) {
    try { db.exec(sql); console.log(`  ✓ ${sql.slice(0, 50)}…`); } catch { /* ya existe */ }
  }

  console.log(`✓ Migración completada: ${DB_PATH}`);
  db.close();
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate();
}

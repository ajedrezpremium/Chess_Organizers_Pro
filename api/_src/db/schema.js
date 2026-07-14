/**
 * schema.js — Supabase PostgreSQL migration
 *
 * Run the full migration.sql in Supabase SQL Editor instead.
 * This file is kept for local development & Vercel startup safety.
 */

import { getDb } from './supabase.js';

const USERS_TABLE_SQL = `
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
);`;

const TOURNAMENTS_TABLE_SQL = `
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
  status          TEXT    DEFAULT 'draft',
  created_by      INTEGER REFERENCES users(id),
  description     TEXT    DEFAULT '',
  location        TEXT    DEFAULT '',
  category        TEXT    DEFAULT '',
  min_rating      INTEGER DEFAULT 0,
  max_rating      INTEGER DEFAULT 9999,
  pairings_visible INTEGER DEFAULT 1,
  show_players    INTEGER DEFAULT 1,
  allow_external_registration INTEGER DEFAULT 0,
  registration_open INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);`;

const ALL_TABLES = [USERS_TABLE_SQL, TOURNAMENTS_TABLE_SQL];

export async function migrate() {
  const db = getDb();
  for (const sql of ALL_TABLES) {
    try {
      await db.exec(sql);
    } catch (e) {
      console.error('Migration error:', e.message);
    }
  }
  try {
    await db.exec(`ALTER TABLE tournaments RENAME COLUMN organizer_id TO created_by`);
  } catch (e) {
    // Column may already be renamed or not exist
  }
  return true;
}

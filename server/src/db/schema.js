/**
 * schema.js — Supabase PostgreSQL migration
 *
 * Run the full migration.sql in Supabase SQL Editor instead.
 * This file is kept for local development & Vercel startup safety.
 */

import { getDb } from './supabase.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  try {
    const db = getDb();
    // Test if already migrated
    await db.prepare('SELECT 1 FROM users LIMIT 1').get();
    return true;
  } catch (e) {
    // Run migration SQL if tables don't exist
    try {
      const sqlPath = resolve(__dirname, '..', '..', '..', 'supabase', 'migration.sql');
      const sql = readFileSync(sqlPath, 'utf-8');
      const db = getDb();
      await db.exec(sql);
      console.log('✓ Supabase migration applied');
      return true;
    } catch (migrateErr) {
      console.error('Migration error (tables may not exist yet):', migrateErr.message);
      return false;
    }
  }
}

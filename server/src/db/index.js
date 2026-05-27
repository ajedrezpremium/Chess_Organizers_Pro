import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import config from '../config.js';

let db = null;

export function getDb() {
  if (db) return db;

  const dir = dirname(config.db.path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(config.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  return db;
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}

export default getDb;

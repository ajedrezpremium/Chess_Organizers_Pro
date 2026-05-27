import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import config from '../config.js';

let db = null;

export function getDb() {
  if (db) return db;

  const dir = dirname(config.db.path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new DatabaseSync(config.db.path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  return db;
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}

export default getDb;

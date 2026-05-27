import crypto from 'crypto';
import { getDb } from '../db/index.js';

/**
 * Middleware de autenticación por API Key.
 * Acepta Bearer token en Header o ?api_key= en query string.
 * Adjunta req.apiUser con { user_id, key_id, name }.
 */
export function apiAuthenticate(req, res, next) {
  let rawKey = '';

  // Check Authorization header
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    rawKey = header.slice(7).trim();
  }

  // Fallback to query param
  if (!rawKey && req.query.api_key) {
    rawKey = req.query.api_key.trim();
  }

  if (!rawKey) {
    return res.status(401).json({ error: 'API key requerida (Bearer token o ?api_key=)' });
  }

  // Hash the key and look it up
  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');
  const db = getDb();
  const keyRecord = db.prepare('SELECT id, user_id, name FROM api_keys WHERE key = ?').get(hashedKey);
  if (!keyRecord) {
    return res.status(401).json({ error: 'API key inválida' });
  }

  // Update last_used_at
  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(keyRecord.id);

  req.apiUser = {
    userId: keyRecord.user_id,
    keyId: keyRecord.id,
    keyName: keyRecord.name,
  };

  next();
}

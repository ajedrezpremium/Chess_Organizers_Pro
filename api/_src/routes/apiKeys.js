import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api-keys — listar keys del usuario
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const keys = await db.prepare('SELECT id, name, key, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(keys);
});

// POST /api-keys — crear nueva API key
router.post('/', authenticate, async (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Se requiere un nombre para la key' });

  // Generate a secure random key with prefix
  const rawKey = 'cop_' + crypto.randomBytes(24).toString('hex');
  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

  const result = await db.prepare('INSERT INTO api_keys (user_id, name, key) VALUES (?, ?, ?)').run(req.user.id, name.trim(), hashedKey);

  res.status(201).json({
    id: result.lastInsertRowid,
    name: name.trim(),
    key: rawKey, // Only shown once
    created_at: new Date().toISOString(),
  });
});

// DELETE /api-keys/:id — revocar key
router.delete('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const result = await db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'API key no encontrada' });
  res.json({ ok: true });
});

export default router;

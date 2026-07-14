import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const VALID_EVENTS = ['round.generated', 'result.updated', 'tournament.finished', 'tournament.created'];

// GET /webhooks — list webhooks del usuario
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const hooks = await db.prepare(`
    SELECT w.*, t.name as tournament_name FROM webhooks w
    LEFT JOIN tournaments t ON w.tournament_id = t.id
    WHERE w.user_id = ? ORDER BY w.created_at DESC
  `).all(req.user.id);
  res.json(hooks);
});

// POST /webhooks — crear webhook
router.post('/', authenticate, async (req, res) => {
  const db = getDb();
  const { url, event_type, tournament_id } = req.body;

  if (!url || !event_type) return res.status(400).json({ error: 'url y event_type son requeridos' });
  if (!VALID_EVENTS.includes(event_type)) {
    return res.status(400).json({ error: `event_type inválido. Válidos: ${VALID_EVENTS.join(', ')}` });
  }

  // Validate URL
  try { new URL(url); } catch { return res.status(400).json({ error: 'URL inválida' }); }

  // Verify tournament_id belongs to user if provided
  if (tournament_id) {
    const t = await db.prepare('SELECT id FROM tournaments WHERE id = ? AND created_by = ?').get(tournament_id, req.user.id);
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
  }

  const result = await db.prepare(
    'INSERT INTO webhooks (user_id, tournament_id, url, event_type) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, tournament_id || null, url, event_type);

  const hook = await db.prepare('SELECT * FROM webhooks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(hook);
});

// PATCH /webhooks/:id — toggle active
router.patch('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const hook = await db.prepare('SELECT * FROM webhooks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!hook) return res.status(404).json({ error: 'Webhook no encontrado' });

  const { active } = req.body;
  if (active !== undefined) {
    await db.prepare('UPDATE webhooks SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
  }

  const updated = await db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /webhooks/:id
router.delete('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const result = await db.prepare('DELETE FROM webhooks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Webhook no encontrado' });
  res.json({ ok: true });
});

export default router;

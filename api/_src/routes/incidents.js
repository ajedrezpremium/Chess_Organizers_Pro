import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /incidents? tournament_id=1
router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const tid = req.query.tournament_id;
    if (!tid) return res.status(400).json({ error: 'tournament_id requerido' });
    const rows = await db.prepare('SELECT * FROM incidents WHERE tournament_id = ? ORDER BY created_at DESC').all(tid);
    res.json({ incidents: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /incidents
router.post('/', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { tournament_id, round_id, board, type, priority, title, description } = req.body;
    if (!tournament_id || !title) return res.status(400).json({ error: 'tournament_id y title requeridos' });
    const result = await db.prepare(
      'INSERT INTO incidents (tournament_id, round_id, board, type, priority, title, description, arbiter_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(tournament_id, round_id || null, board || null, type || 'other', priority || 'medium', title, description || '', req.user.id);
    const inc = await db.prepare('SELECT * FROM incidents WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(inc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /incidents/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { status, priority, description } = req.body;
    const fields = [];
    const vals = [];
    if (status) { fields.push('status = ?'); vals.push(status); }
    if (priority) { fields.push('priority = ?'); vals.push(priority); }
    if (description !== undefined) { fields.push('description = ?'); vals.push(description); }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
    fields.push('updated_at = NOW()');
    vals.push(req.params.id);
    await db.prepare(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    const inc = await db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
    res.json(inc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const db = getDb();
    await db.prepare('DELETE FROM incidents WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

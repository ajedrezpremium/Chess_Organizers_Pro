import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /tournaments/:tid/groups — listar grupos/secciones de un torneo
router.get('/tournaments/:tid/groups', authenticate, async (req, res) => {
  const db = getDb();
  const groups = await db.prepare(
    'SELECT * FROM tournament_groups WHERE tournament_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(req.params.tid);

  for (const g of groups) {
    const cnt = await db.prepare(
      'SELECT COUNT(*) as c FROM tournament_players WHERE tournament_id = ? AND group_id = ?'
    ).get(req.params.tid, g.id);
    g.player_count = cnt.c;
  }

  res.json(groups);
});

// POST /tournaments/:tid/groups — crear grupo
router.post('/tournaments/:tid/groups', authenticate, async (req, res) => {
  const db = getDb();
  const t = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const { name, system, n_rounds, time_control, tiebreaks } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del grupo es obligatorio' });

  const maxSort = await db.prepare(
    'SELECT MAX(sort_order) as max FROM tournament_groups WHERE tournament_id = ?'
  ).get(req.params.tid);
  const nextSort = (maxSort?.max ?? -1) + 1;

  const result = await db.prepare(`
    INSERT INTO tournament_groups (tournament_id, name, system, n_rounds, time_control, tiebreaks, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.tid, name.trim(), system ?? t.system, n_rounds ?? t.n_rounds, time_control ?? t.time_control, tiebreaks ?? t.tiebreaks ?? 'BH1,BH,SB,DE,PR', nextSort);

  const group = await db.prepare('SELECT * FROM tournament_groups WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(group);
});

// PATCH /groups/:id — actualizar grupo
router.patch('/groups/:id', authenticate, async (req, res) => {
  const db = getDb();
  const g = await db.prepare(`
    SELECT g.* FROM tournament_groups g
    JOIN tournaments t ON g.tournament_id = t.id
    WHERE g.id = ? AND t.created_by = ?
  `).get(req.params.id, req.user.id);
  if (!g) return res.status(404).json({ error: 'Grupo no encontrado' });

  const allowed = ['name', 'system', 'n_rounds', 'time_control', 'tiebreaks', 'status', 'sort_order'];
  const updates = [];
  const params = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  await db.prepare(`UPDATE tournament_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const group = await db.prepare('SELECT * FROM tournament_groups WHERE id = ?').get(req.params.id);
  res.json(group);
});

// DELETE /groups/:id — eliminar grupo (no elimina jugadores, les quita group_id)
router.delete('/groups/:id', authenticate, async (req, res) => {
  const db = getDb();
  const g = await db.prepare(`
    SELECT g.* FROM tournament_groups g
    JOIN tournaments t ON g.tournament_id = t.id
    WHERE g.id = ? AND t.created_by = ?
  `).get(req.params.id, req.user.id);
  if (!g) return res.status(404).json({ error: 'Grupo no encontrado' });

  // Desasignar jugadores del grupo y rondas del grupo
  await db.prepare('UPDATE tournament_players SET group_id = NULL WHERE group_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM rounds WHERE group_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM tournament_groups WHERE id = ?').run(req.params.id);

  res.json({ ok: true });
});

// PATCH /tournaments/:tid/groups/assign — asignar jugador a un grupo
router.patch('/tournaments/:tid/groups/assign', authenticate, async (req, res) => {
  const db = getDb();
  const { player_id, group_id } = req.body;

  const t = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const tp = await db.prepare('SELECT id FROM tournament_players WHERE id = ? AND tournament_id = ?').get(player_id, req.params.tid);
  if (!tp) return res.status(404).json({ error: 'Jugador no encontrado en este torneo' });

  await db.prepare('UPDATE tournament_players SET group_id = ? WHERE id = ?').run(group_id || null, player_id);
  res.json({ ok: true });
});

export default router;

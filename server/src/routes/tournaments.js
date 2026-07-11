import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { notifyRegistrationApproved, notifyTournamentFinished } from '../services/notifications.js';
import { dispatchWebhooks } from '../services/webhooks.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// GET /tournaments
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const { status, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT * FROM tournaments WHERE created_by = ?';
  const params = [req.user.id];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const tournaments = await db.prepare(sql).all(...params);
  const total = await db.prepare('SELECT COUNT(*) as count FROM tournaments WHERE created_by = ?').get(req.user.id);
  res.json({ tournaments, total: total.count, page: parseInt(page) });
});

// GET /tournaments/:id
router.get('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const t = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  // Parse tiebreaks JSON
  t.tiebreaks = t.tiebreaks ? t.tiebreaks.split(',') : ['BH1','BH','SB','DE','PR'];
  res.json(t);
});

// POST /tournaments
router.post('/', authenticate, validate({
  name: { type: 'string', required: true },
  system: { type: 'string' },
  n_rounds: { type: 'integer' },
  start_date: { type: 'date' },
  time_control: { type: 'string' },
}), async (req, res) => {
  const db = getDb();
  const { name, system, n_rounds, start_date, end_date, city, federation, time_control, rated, chief_arbiter, description } = req.body;

  const result = await db.prepare(`
    INSERT INTO tournaments (name, system, n_rounds, start_date, end_date, city, federation, time_control, rated, chief_arbiter, description, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, system ?? 'dutch', n_rounds ?? 6, start_date ?? null, end_date ?? null, city ?? '', federation ?? '', time_control ?? '90+30', rated ?? 1, chief_arbiter ?? '', description ?? '', req.user.id);

  const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid);

  // Webhook
  dispatchWebhooks('tournament.created', tournament.id, { name: tournament.name });

  res.status(201).json(tournament);
});

// PATCH /tournaments/:id
router.patch('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const t = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const allowed = ['name','system','n_rounds','start_date','end_date','city','federation','time_control','rated','chief_arbiter','status','description','primary_color','secondary_color','logo_url','banner_url','stream_url','stream_platform','registration_fee','registration_currency','auto_approve','custom_fields'];
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

  await db.prepare(`UPDATE tournaments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);

  // Webhook + notifications for tournament finished
  if (req.body.status === 'finished') {
    dispatchWebhooks('tournament.finished', tournament.id, { name: tournament.name });
    notifyTournamentFinished(tournament.id);
  }

  res.json(tournament);
});

// DELETE /tournaments/:id
router.delete('/:id', authenticate, async (req, res) => {
  const db = getDb();
  const result = await db.prepare('DELETE FROM tournaments WHERE id = ? AND created_by = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Torneo no encontrado' });
  res.json({ ok: true });
});

// ── Inscripción de jugadores ───────────────────────────────────────

// POST /tournaments/:id/players — inscribir jugador
router.post('/:id/players', authenticate, async (req, res) => {
  const db = getDb();
  const { player_id, seed_rank, category } = req.body;

  const t = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
  if (t.status !== 'pending') return res.status(400).json({ error: 'El torneo ya comenzó' });

  const existing = await db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?').get(req.params.id, player_id);
  if (existing) return res.status(409).json({ error: 'Jugador ya inscrito' });

  const result = await db.prepare(`
    INSERT INTO tournament_players (tournament_id, player_id, seed_rank, category)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, player_id, seed_rank ?? 0, category ?? '');

  const tp = await db.prepare(`
    SELECT tp.*, p.name, p.last_name, p.fide_rating, p.title, p.federation, p.fide_id
    FROM tournament_players tp JOIN players p ON tp.player_id = p.id
    WHERE tp.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(tp);
});

// GET /tournaments/:id/players — lista inscritos
router.get('/:id/players', authenticate, async (req, res) => {
  const db = getDb();
  const players = await db.prepare(`
    SELECT tp.*, p.name, p.last_name, p.fide_rating, p.title, p.federation, p.fide_id
    FROM tournament_players tp JOIN players p ON tp.player_id = p.id
    WHERE tp.tournament_id = ?
    ORDER BY tp.seed_rank ASC
  `).all(req.params.id);

  res.json(players);
});

// PATCH /tournaments/:id/players/:pid/category — actualizar categoría
router.patch('/:id/players/:pid/category', authenticate, async (req, res) => {
  const db = getDb();
  const { category } = req.body;
  const tp = await db.prepare('SELECT id FROM tournament_players WHERE id = ? AND tournament_id = ?').get(req.params.pid, req.params.id);
  if (!tp) return res.status(404).json({ error: 'Jugador no encontrado en este torneo' });
  await db.prepare('UPDATE tournament_players SET category = ? WHERE id = ?').run(category || '', req.params.pid);
  res.json({ ok: true });
});

// PATCH /tournaments/:id/players/:pid/penalty — aplicar penalización
router.patch('/:id/players/:pid/penalty', authenticate, async (req, res) => {
  const db = getDb();
  const { points } = req.body; // Cantidad a penalizar (e.g. 0.5)
  const tp = await db.prepare('SELECT id, current_points, penalty_points FROM tournament_players WHERE id = ? AND tournament_id = ?').get(req.params.pid, req.params.id);
  if (!tp) return res.status(404).json({ error: 'Jugador no encontrado en este torneo' });
  
  const penalty = parseFloat(points) || 0;
  if (penalty <= 0) return res.status(400).json({ error: 'La penalización debe ser mayor a 0' });
  
  await db.prepare('UPDATE tournament_players SET current_points = current_points - ?, penalty_points = penalty_points + ? WHERE id = ?').run(penalty, penalty, req.params.pid);
  res.json({ ok: true });
});

// ── Solicitudes de registro ─────────────────────────────────────────

// GET /tournaments/:id/registrations — lista solicitudes pendientes
router.get('/:id/registrations', authenticate, async (req, res) => {
  const db = getDb();
  const t = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const { status } = req.query;
  let sql = 'SELECT * FROM registration_requests WHERE tournament_id = ?';
  const params = [req.params.id];
  if (status) {
    const statuses = status.split(',');
    if (statuses.length === 1) { sql += ' AND status = ?'; params.push(status); }
    else { sql += ` AND status IN (${statuses.map(() => '?').join(',')})`; params.push(...statuses); }
  }
  sql += ' ORDER BY created_at DESC';

  const requests = await db.prepare(sql).all(...params);
  res.json(requests);
});

// PATCH /tournaments/:id/registrations/:reqId — aprobar/rechazar
router.patch('/:id/registrations/:reqId', authenticate, async (req, res) => {
  const db = getDb();
  const t = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const reg = await db.prepare('SELECT * FROM registration_requests WHERE id = ? AND tournament_id = ?').get(req.params.reqId, req.params.id);
  if (!reg) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (reg.status !== 'pending' && reg.status !== 'pending_payment') return res.status(400).json({ error: 'Solicitud ya procesada' });

  const { action } = req.body; // 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });

  await db.prepare("UPDATE registration_requests SET status = ?, updated_at = datetime('now') WHERE id = ?").run(action, req.params.reqId);

  if (action === 'approved') {
    // Buscar o crear jugador
    let player = null;
    if (reg.fide_id) {
      player = await db.prepare('SELECT * FROM players WHERE fide_id = ?').get(reg.fide_id);
    }
    if (!player && reg.email) {
      player = await db.prepare('SELECT * FROM players WHERE email = ? AND email != ?').get(reg.email, '');
    }
    if (!player) {
      const result = await db.prepare(`
        INSERT INTO players (fide_id, name, last_name, fide_rating, federation, title, email, phone, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(reg.fide_id ?? '', reg.name, reg.last_name ?? '', reg.fide_rating ?? 0, reg.federation ?? '', reg.title ?? '', reg.email ?? '', reg.phone ?? '', reg.notes ?? '');
      player = await db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
    }

    // Obtener seed_rank
    const maxSeed = await db.prepare('SELECT MAX(seed_rank) as max FROM tournament_players WHERE tournament_id = ?').get(req.params.id);
    const nextSeed = (maxSeed?.max ?? 0) + 1;

    // Inscribir
    const existing = await db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?').get(req.params.id, player.id);
    if (!existing) {
      await db.prepare('INSERT INTO tournament_players (tournament_id, player_id, seed_rank) VALUES (?, ?, ?)').run(req.params.id, player.id, nextSeed);
    }

    notifyRegistrationApproved(req.params.id, reg.email, reg.name);
    res.json({ ok: true, message: 'Solicitud aprobada y jugador inscrito', player });
  } else {
    res.json({ ok: true, message: 'Solicitud rechazada' });
  }
});

export default router;

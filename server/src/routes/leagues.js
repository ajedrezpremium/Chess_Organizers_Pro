import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { buildPlayerState } from '../utils/roundUtils.js';
import { calculateTiebreak } from '../../../src/engine/tiebreaks.js';
import { DEFAULT_TIEBREAK_ORDER } from '../../../src/engine/types.js';

const router = Router();
router.use(authenticate);

// POST /leagues
router.post('/', async (req, res) => {
  const db = getDb();
  const { name, description, federation, season, scoring_system, tiebreaks } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const result = await db.prepare(
    'INSERT INTO leagues (name, description, federation, season, scoring_system, tiebreaks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name.trim(), description || '', federation || '', season || '', scoring_system || 'placement', tiebreaks || 'BH1,BH,SB,DE,PR', req.user.id);
  const league = await db.prepare('SELECT * FROM leagues WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(league);
});

// GET /leagues
router.get('/', async (req, res) => {
  const db = getDb();
  const leagues = await db.prepare(`
    SELECT l.*,
      (SELECT COUNT(*) FROM league_tournaments lt JOIN tournaments t ON t.id = lt.tournament_id WHERE lt.league_id = l.id) as tournament_count,
      (SELECT COUNT(*) FROM league_participants WHERE league_id = l.id) as participant_count
    FROM leagues l ORDER BY l.created_at DESC
  `).all();
  res.json(leagues);
});

// GET /leagues/:id
router.get('/:id', async (req, res) => {
  const db = getDb();
  const league = await db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
  if (!league) return res.status(404).json({ error: 'Liga no encontrada' });

  league.tournaments = await db.prepare(`
    SELECT lt.*, t.name, t.start_date, t.end_date, t.status, t.system, t.n_rounds, t.federation
    FROM league_tournaments lt JOIN tournaments t ON t.id = lt.tournament_id
    WHERE lt.league_id = ? ORDER BY lt.round_number ASC
  `).all(req.params.id);

  league.participants = await db.prepare(`
    SELECT lp.*, p.name, p.last_name, p.fide_rating, p.title, p.federation, p.fide_id
    FROM league_participants lp JOIN players p ON p.id = lp.player_id
    WHERE lp.league_id = ? ORDER BY lp.total_points DESC
  `).all(req.params.id);

  res.json(league);
});

// PUT /leagues/:id
router.put('/:id', async (req, res) => {
  const db = getDb();
  const league = await db.prepare('SELECT * FROM leagues WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!league) return res.status(404).json({ error: 'Liga no encontrada' });
  const allowed = ['name','description','federation','season','scoring_system','status','logo_url','tiebreaks'];
  const updates = []; const params = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) { updates.push(`${k} = ?`); params.push(req.body[k]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'Sin campos' });
  params.push(req.params.id);
  await db.prepare(`UPDATE leagues SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  res.json(await db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id));
});

// DELETE /leagues/:id
router.delete('/:id', async (req, res) => {
  const db = getDb();
  const r = await db.prepare('DELETE FROM leagues WHERE id = ? AND created_by = ?').run(req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Liga no encontrada' });
  res.json({ ok: true });
});

// POST /leagues/:id/tournaments — asignar torneo a liga
router.post('/:id/tournaments', async (req, res) => {
  const db = getDb();
  const league = await db.prepare('SELECT * FROM leagues WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!league) return res.status(404).json({ error: 'Liga no encontrada' });
  const { tournament_id, weight } = req.body;
  if (!tournament_id) return res.status(400).json({ error: 'Torneo requerido' });
  const t = await db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tournament_id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
  const maxRound = await db.prepare('SELECT COALESCE(MAX(round_number),0) as r FROM league_tournaments WHERE league_id = ?').get(req.params.id);
  try {
    await db.prepare('INSERT INTO league_tournaments (league_id, tournament_id, round_number, weight) VALUES (?, ?, ?, ?)').run(req.params.id, tournament_id, maxRound.r + 1, weight || 1.0);
    res.status(201).json({ ok: true });
  } catch { res.status(409).json({ error: 'El torneo ya está en la liga' }); }
});

// DELETE /leagues/:lid/tournaments/:tid
router.delete('/:lid/tournaments/:tid', async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM league_tournaments WHERE league_id = ? AND tournament_id = ?').run(req.params.lid, req.params.tid);
  res.json({ ok: true });
});

// POST /leagues/:id/calculate-standings — recalcular clasificación
router.post('/:id/calculate-standings', async (req, res) => {
  const db = getDb();
  const league = await db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
  if (!league) return res.status(404).json({ error: 'Liga no encontrada' });

  const tournaments = await db.prepare(`
    SELECT lt.*, t.name, t.status, t.n_rounds, t.tiebreaks
    FROM league_tournaments lt JOIN tournaments t ON t.id = lt.tournament_id
    WHERE lt.league_id = ? AND t.status IN ('active','finished')
    ORDER BY lt.round_number ASC
  `).all(req.params.id);

  const playerPoints = {};

  for (const lt of tournaments) {
    const players = buildPlayerState(db, lt.tournament_id);
    const tOrder = (lt.tiebreaks || league.tiebreaks || DEFAULT_TIEBREAK_ORDER).split(',').filter(Boolean);
    const standings = calculateTiebreak(players, null, tOrder);

    for (const p of standings) {
      if (!playerPoints[p.id]) {
        playerPoints[p.id] = { playerId: p.id, name: p.name, lastName: p.lastName, rating: p.rating, title: p.title, federation: p.federation, points: 0, played: 0, best: null };
      }
      const pts = p.points * (lt.weight || 1.0);
      playerPoints[p.id].points += pts;
      playerPoints[p.id].played += 1;
      playerPoints[p.id].federation = p.federation;
      if (playerPoints[p.id].best === null || lt.round_number < playerPoints[p.id].best) {
        playerPoints[p.id].best = lt.round_number;
      }
    }
  }

  const sorted = Object.values(playerPoints).sort((a, b) => b.points - a.points);

  const deleteStmt = db.prepare('DELETE FROM league_participants WHERE league_id = ?');
  const insertStmt = db.prepare('INSERT INTO league_participants (league_id, player_id, total_points, tournaments_played, best_result) VALUES (?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    deleteStmt.run(req.params.id);
    for (const p of sorted) {
      insertStmt.run(req.params.id, p.playerId, Math.round(p.points * 100) / 100, p.played, p.best);
    }
  });
  tx();

  res.json(sorted.map((p, i) => ({ ...p, position: i + 1 })));
});

export default router;

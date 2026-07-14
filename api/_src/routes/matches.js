import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /matches?tournament_id=
router.get('/', async (req, res) => {
  const db = getDb();
  let rows;
  if (req.query.tournament_id) {
    rows = await db.prepare(`
      SELECT tm.*, h.name as home_name, h.short_name as home_short, a.name as away_name, a.short_name as away_short
      FROM team_matches tm
      JOIN teams h ON h.id = tm.home_team_id
      JOIN teams a ON a.id = tm.away_team_id
      WHERE tm.tournament_id = ? ORDER BY tm.round ASC, tm.match_date ASC
    `).all(req.query.tournament_id);
  } else {
    rows = await db.prepare(`
      SELECT tm.*, h.name as home_name, h.short_name as home_short, a.name as away_name, a.short_name as away_short
      FROM team_matches tm
      JOIN teams h ON h.id = tm.home_team_id
      JOIN teams a ON a.id = tm.away_team_id
      ORDER BY tm.created_at DESC LIMIT 50
    `).all();
  }
  res.json(rows);
});

// GET /matches/:id
router.get('/:id', async (req, res) => {
  const db = getDb();
  const m = await db.prepare(`
    SELECT tm.*, h.name as home_name, h.short_name as home_short, a.name as away_name, a.short_name as away_short
    FROM team_matches tm
    JOIN teams h ON h.id = tm.home_team_id
    JOIN teams a ON a.id = tm.away_team_id
    WHERE tm.id = ?
  `).get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match no encontrado' });
  m.pairings = await db.prepare(`
    SELECT mp.*,
      hp.name as home_player_name, hp.last_name as home_player_last, hp.fide_rating as home_rating,
      ap.name as away_player_name, ap.last_name as away_player_last, ap.fide_rating as away_rating
    FROM match_pairings mp
    LEFT JOIN tournament_players htp ON htp.id = mp.home_player_id
    LEFT JOIN players hp ON hp.id = htp.player_id
    LEFT JOIN tournament_players atp ON atp.id = mp.away_player_id
    LEFT JOIN players ap ON ap.id = atp.player_id
    WHERE mp.team_match_id = ? ORDER BY mp.board ASC
  `).all(req.params.id);
  res.json(m);
});

// POST /matches
router.post('/', async (req, res) => {
  const db = getDb();
  const { tournament_id, home_team_id, away_team_id, match_date, location, round } = req.body;
  if (!home_team_id || !away_team_id) return res.status(400).json({ error: 'Equipos requeridos' });
  if (home_team_id === away_team_id) return res.status(400).json({ error: 'Los equipos deben ser distintos' });
  const home = await db.prepare('SELECT id, tournament_id FROM teams WHERE id = ?').get(home_team_id);
  const away = await db.prepare('SELECT id, tournament_id FROM teams WHERE id = ?').get(away_team_id);
  if (!home || !away) return res.status(404).json({ error: 'Equipo no encontrado' });
  const tid = tournament_id || home.tournament_id;
  const result = await db.prepare(
    'INSERT INTO team_matches (tournament_id, home_team_id, away_team_id, match_date, location, round, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(tid, home_team_id, away_team_id, match_date || null, location || '', round || 1, req.user.id);
  const match = await db.prepare('SELECT * FROM team_matches WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(match);
});

// PUT /matches/:id
router.put('/:id', async (req, res) => {
  const db = getDb();
  const allowed = ['match_date','location','round','status','home_score','away_score'];
  const updates = []; const params = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) { updates.push(`${k} = ?`); params.push(req.body[k]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'Sin campos' });
  params.push(req.params.id);
  await db.prepare(`UPDATE team_matches SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  res.json(await db.prepare('SELECT * FROM team_matches WHERE id = ?').get(req.params.id));
});

// DELETE /matches/:id
router.delete('/:id', async (req, res) => {
  const db = getDb();
  const r = await db.prepare('DELETE FROM team_matches WHERE id = ? AND created_by = ?').run(req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Match no encontrado' });
  res.json({ ok: true });
});

// POST /matches/:id/pairings — añadir pairing a match
router.post('/:id/pairings', async (req, res) => {
  const db = getDb();
  const m = await db.prepare(`
    SELECT tm.* FROM team_matches tm JOIN teams t ON t.id = tm.home_team_id
    WHERE tm.id = ? AND t.tournament_id = (SELECT tournament_id FROM teams WHERE id = tm.home_team_id)
  `).get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match no encontrado' });

  const { home_player_id, away_player_id, board } = req.body;
  if (!board || board < 1) return res.status(400).json({ error: 'Tablero requerido' });

  try {
    const result = await db.prepare(
      'INSERT INTO match_pairings (team_match_id, board, home_player_id, away_player_id, home_rating, away_rating) VALUES (?, ?, ?, ?, (SELECT fide_rating FROM players WHERE id = (SELECT player_id FROM tournament_players WHERE id = ?)), (SELECT fide_rating FROM players WHERE id = (SELECT player_id FROM tournament_players WHERE id = ?)))'
    ).run(req.params.id, board, home_player_id || null, away_player_id || null, home_player_id, away_player_id);
    const p = await db.prepare(`
      SELECT mp.*, hp.name as home_player_name, hp.last_name as home_player_last,
        ap.name as away_player_name, ap.last_name as away_player_last
      FROM match_pairings mp
      LEFT JOIN tournament_players htp ON htp.id = mp.home_player_id
      LEFT JOIN players hp ON hp.id = htp.player_id
      LEFT JOIN tournament_players atp ON atp.id = mp.away_player_id
      LEFT JOIN players ap ON ap.id = atp.player_id
      WHERE mp.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(p);
  } catch { res.status(409).json({ error: 'Tablero ya ocupado' }); }
});

// PUT /matches/:mid/pairings/:pid — actualizar resultado
router.put('/:mid/pairings/:pid', async (req, res) => {
  const db = getDb();
  const { result } = req.body;
  if (!result) return res.status(400).json({ error: 'Resultado requerido' });
  await db.prepare('UPDATE match_pairings SET result = ? WHERE id = ?').run(result, req.params.pid);

  // Recalcular scores del match
  const pairings = await db.prepare('SELECT result FROM match_pairings WHERE team_match_id = ?').all(req.params.mid);
  let homeScore = 0, awayScore = 0;
  for (const p of pairings) {
    if (p.result === '1') homeScore += 1;
    else if (p.result === '0') awayScore += 1;
    else if (p.result === '=') { homeScore += 0.5; awayScore += 0.5; }
  }
  await db.prepare('UPDATE team_matches SET home_score = ?, away_score = ? WHERE id = ?').run(homeScore, awayScore, req.params.mid);

  res.json(await db.prepare('SELECT * FROM match_pairings WHERE id = ?').get(req.params.pid));
});

// DELETE /matches/:mid/pairings/:pid
router.delete('/:mid/pairings/:pid', async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM match_pairings WHERE id = ? AND team_match_id = ?').run(req.params.pid, req.params.mid);
  res.json({ ok: true });
});

export default router;

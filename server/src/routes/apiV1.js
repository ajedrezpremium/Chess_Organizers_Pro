import { Router } from 'express';
import { getDb } from '../db/index.js';
import { apiAuthenticate } from '../middleware/apiAuth.js';
import { buildPlayerState } from '../utils/roundUtils.js';
import { applyRoundResults, buildStandings } from '../../../src/engine/dutch.js';
import { calculateTiebreak } from '../../../src/engine/tiebreaks.js';
import { DEFAULT_TIEBREAK_ORDER } from '../../../src/engine/types.js';

const router = Router();

// All v1 API routes require API key authentication
router.use(apiAuthenticate);

// GET /api/v1/tournaments — list public tournaments
router.get('/tournaments', (req, res) => {
  const db = getDb();
  const { status, federation, page = 1, limit = 50 } = req.query;

  let sql = 'SELECT id, name, federation, city, system, n_rounds, time_control, rated, status, start_date, end_date, created_at FROM tournaments WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (federation) { sql += ' AND federation = ?'; params.push(federation); }

  const total = db.prepare(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as count FROM')).get(...params).count;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const tournaments = db.prepare(sql).all(...params);
  res.json({ tournaments, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/v1/tournaments/:id
router.get('/tournaments/:id', (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT id, name, federation, city, system, n_rounds, time_control, rated, status, start_date, end_date, chief_arbiter, description, created_at FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
  res.json(t);
});

// GET /api/v1/tournaments/:id/players
router.get('/tournaments/:id/players', (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const players = db.prepare(`
    SELECT tp.seed_rank, tp.current_points, tp.color_diff, tp.received_bye, tp.withdrawn,
           p.name, p.last_name, p.title, p.federation, p.fide_rating, p.fide_id
    FROM tournament_players tp JOIN players p ON tp.player_id = p.id
    WHERE tp.tournament_id = ? ORDER BY tp.seed_rank ASC
  `).all(req.params.id);

  res.json(players);
});

// GET /api/v1/tournaments/:id/standings
router.get('/tournaments/:id/standings', (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const players = buildPlayerState(db, req.params.id);
  const totalRounds = db.prepare("SELECT MAX(round_number) as max FROM rounds WHERE tournament_id = ? AND status = 'closed'").get(req.params.id)?.max ?? 0;
  const tiebreaks = t.tiebreaks ? t.tiebreaks.split(',') : DEFAULT_TIEBREAK_ORDER;

  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const withTb = players.map((player) => ({
    ...player,
    tiebreakValues: tiebreaks.map((tb) => calculateTiebreak(tb, player, playersById, totalRounds)),
  }));

  const standings = buildStandings(withTb);

  res.json({
    standings: standings.map((s, i) => ({
      position: i + 1,
      name: s.name,
      lastName: s.lastName,
      fideRating: s.fideRating,
      title: s.title,
      points: s.points,
      tiebreakValues: s.tiebreakValues,
    })),
    tiebreaks,
  });
});

// GET /api/v1/tournaments/:id/rounds
router.get('/tournaments/:id/rounds', (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const rounds = db.prepare('SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC').all(req.params.id);
  for (const r of rounds) {
    r.pairings = db.prepare(`
      SELECT p.board, p.result, p.is_bye,
             w.name as white_name, w.last_name as white_last,
             b.name as black_name, b.last_name as black_last
      FROM pairings p
      LEFT JOIN tournament_players tpw ON p.white_id = tpw.id LEFT JOIN players w ON tpw.player_id = w.id
      LEFT JOIN tournament_players tpb ON p.black_id = tpb.id LEFT JOIN players b ON tpb.player_id = b.id
      WHERE p.round_id = ? ORDER BY p.board ASC
    `).all(r.id);
  }

  res.json(rounds);
});

// GET /api/v1/tournaments/:id/crosstab
router.get('/tournaments/:id/crosstab', (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const players = buildPlayerState(db, req.params.id);
  const closedRounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.id);

  const crosstab = players.map((p) => ({
    name: p.name,
    lastName: p.lastName,
    points: p.points,
    opponents: p.opponents,
    results: closedRounds.map((r) => {
      const opp = p.opponents[r.round_number - 1];
      const idx = opp ? p.opponents.indexOf(opp) : -1;
      return idx >= 0 ? p.colorHistory[idx] || '?' : '';
    }),
  }));

  res.json({ crosstab, rounds: closedRounds.length });
});

// GET /api/v1/players — search players
router.get('/players', (req, res) => {
  const db = getDb();
  const { q, page = 1, limit = 20 } = req.query;

  let sql = 'SELECT id, name, last_name, fide_rating, title, federation, fide_id FROM players WHERE 1=1';
  const params = [];

  if (q) { sql += ' AND (name LIKE ? OR last_name LIKE ? OR fide_id LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const total = db.prepare(sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as count FROM')).get(...params).count;
  sql += ' ORDER BY fide_rating DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const players = db.prepare(sql).all(...params);
  res.json({ players, total, page: parseInt(page) });
});

// GET /api/v1/federations
router.get('/federations', (req, res) => {
  const db = getDb();
  const feds = db.prepare(`
    SELECT federation as code, COUNT(*) as count FROM tournaments WHERE federation != '' AND federation IS NOT NULL
    GROUP BY federation ORDER BY count DESC
  `).all();
  res.json(feds);
});

// GET /api/v1/stats
router.get('/stats', (req, res) => {
  const db = getDb();
  const stats = {
    totalTournaments: db.prepare('SELECT COUNT(*) as c FROM tournaments').get().c,
    activeTournaments: db.prepare("SELECT COUNT(*) as c FROM tournaments WHERE status = 'active'").get().c,
    totalPlayers: db.prepare('SELECT COUNT(*) as c FROM players').get().c,
    totalPairings: db.prepare("SELECT COUNT(*) as c FROM pairings WHERE result != '-'").get().c,
    federations: db.prepare("SELECT federation as code, COUNT(*) as count FROM tournaments WHERE federation != '' GROUP BY federation ORDER BY count DESC LIMIT 20").all(),
  };
  res.json(stats);
});

export default router;

import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────

function isArbiterOf(db, tournamentId, userId) {
  const t = db.prepare('SELECT created_by FROM tournaments WHERE id = ?').get(tournamentId);
  if (t && t.created_by === userId) return true;
  return !!db.prepare('SELECT id FROM tournament_arbiters WHERE tournament_id = ? AND user_id = ?').get(tournamentId, userId);
}

// ── GET /arbiters/search-users?q=email ────────────────────────────
router.get('/search-users', authenticate, (req, res) => {
  const db = getDb();
  const { q } = req.query;
  if (!q) return res.json([]);
  const users = db.prepare("SELECT id, name, email, role FROM users WHERE email LIKE ? OR name LIKE ? LIMIT 20").all(`%${q}%`, `%${q}%`);
  res.json(users);
});

// ── GET /arbiters/tournaments — torneos donde soy árbitro ────────
router.get('/tournaments', authenticate, (req, res) => {
  const db = getDb();
  const owned = db.prepare("SELECT * FROM tournaments WHERE created_by = ? AND status != 'pending'").all(req.user.id);
  const assigned = db.prepare(`
    SELECT t.* FROM tournaments t
    JOIN tournament_arbiters ta ON ta.tournament_id = t.id
    WHERE ta.user_id = ? AND t.status != 'pending'
  `).all(req.user.id);
  const seen = new Set();
  const all = [...owned, ...assigned].filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  res.json(all);
});

// ── GET /arbiters/tournaments/:id — datos para el panel ─────────
router.get('/tournaments/:id', authenticate, (req, res) => {
  const db = getDb();
  if (!isArbiterOf(db, req.params.id, req.user.id)) return res.status(403).json({ error: 'No eres árbitro de este torneo' });

  const tournament = db.prepare("SELECT * FROM tournaments WHERE id = ? AND status != 'pending'").get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  const rounds = db.prepare(`
    SELECT r.*, json_group_array(json_object(
      'id', p.id, 'board', p.board, 'result', p.result, 'is_bye', p.is_bye,
      'white_id', p.white_id, 'black_id', p.black_id
    )) as pairings_json
    FROM rounds r LEFT JOIN pairings p ON p.round_id = r.id
    WHERE r.tournament_id = ?
    GROUP BY r.id ORDER BY r.round_number ASC
  `).all(req.params.id);

  for (const r of rounds) {
    r.pairings = JSON.parse(r.pairings_json).filter((p) => p.id);
    // Enrich with player names
    for (const p of r.pairings) {
      if (p.white_id) {
        const w = db.prepare('SELECT tp.id, pl.name, pl.last_name FROM tournament_players tp JOIN players pl ON pl.id = tp.player_id WHERE tp.id = ?').get(p.white_id);
        if (w) { p.white_name = w.name; p.white_last = w.last_name; }
      }
      if (p.black_id) {
        const b = db.prepare('SELECT tp.id, pl.name, pl.last_name FROM tournament_players tp JOIN players pl ON pl.id = tp.player_id WHERE tp.id = ?').get(p.black_id);
        if (b) { p.black_name = b.name; p.black_last = b.last_name; }
      }
    }
    delete r.pairings_json;
  }

  const players = db.prepare(`
    SELECT tp.id, tp.seed_rank, tp.current_points, tp.checked_in,
           p.name, p.last_name, p.fide_rating, p.title, p.federation
    FROM tournament_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.tournament_id = ? ORDER BY tp.seed_rank ASC
  `).all(req.params.id);

  res.json({ tournament, rounds, players });
});

// ── PATCH /arbiters/rounds/:rid/result — ingresar resultado ──────
router.patch('/rounds/:rid/result', authenticate, (req, res) => {
  const db = getDb();
  const round = db.prepare(`
    SELECT r.*, t.id as tid, t.created_by FROM rounds r
    JOIN tournaments t ON t.id = r.tournament_id
    WHERE r.id = ?
  `).get(req.params.rid);
  if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });
  if (!isArbiterOf(db, round.tid, req.user.id)) return res.status(403).json({ error: 'No eres árbitro de este torneo' });

  const { pairing_id, result } = req.body;
  if (!pairing_id || !result) return res.status(400).json({ error: 'Se requieren pairing_id y result' });
  if (!['1', '0', '=', 'U', 'F', 'H', 'Z'].includes(result)) return res.status(400).json({ error: 'Resultado inválido' });

  db.prepare('UPDATE pairings SET result = ? WHERE id = ? AND round_id = ?').run(result, pairing_id, req.params.rid);
  res.json({ ok: true });
});

// ── POST /arbiters/players/:tpId/check-in ─────────────────────────
router.post('/players/:tpId/check-in', authenticate, (req, res) => {
  const db = getDb();
  const tp = db.prepare(`
    SELECT tp.*, t.created_by, t.id as tid FROM tournament_players tp
    JOIN tournaments t ON t.id = tp.tournament_id WHERE tp.id = ?
  `).get(req.params.tpId);
  if (!tp) return res.status(404).json({ error: 'Jugador no encontrado' });
  if (!isArbiterOf(db, tp.tid, req.user.id)) return res.status(403).json({ error: 'No eres árbitro de este torneo' });

  db.prepare('UPDATE tournament_players SET checked_in = 1 WHERE id = ?').run(req.params.tpId);
  res.json({ ok: true, player: tp.id, checked_in: 1 });
});

// ── GET /arbiters/tournaments/:id/arbiters — lista árbitros ──────
router.get('/tournaments/:id/arbiters', authenticate, (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT created_by FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
  if (t.created_by !== req.user.id) return res.status(403).json({ error: 'Solo el organizador puede gestionar árbitros' });

  const arbiters = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, ta.created_at as added_at
    FROM tournament_arbiters ta JOIN users u ON u.id = ta.user_id
    WHERE ta.tournament_id = ?
  `).all(req.params.id);
  res.json(arbiters);
});

// ── POST /arbiters/tournaments/:id/arbiters — añadir árbitro ─────
router.post('/tournaments/:id/arbiters', authenticate, (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT created_by FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
  if (t.created_by !== req.user.id) return res.status(403).json({ error: 'Solo el organizador puede gestionar árbitros' });

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Se requiere user_id' });

  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(user_id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  try {
    db.prepare('INSERT INTO tournament_arbiters (tournament_id, user_id) VALUES (?, ?)').run(req.params.id, user_id);
    res.status(201).json({ ok: true, user });
  } catch {
    res.status(409).json({ error: 'El usuario ya es árbitro de este torneo' });
  }
});

// ── DELETE /arbiters/tournaments/:id/arbiters/:userId ────────────
router.delete('/tournaments/:id/arbiters/:userId', authenticate, (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT created_by FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
  if (t.created_by !== req.user.id) return res.status(403).json({ error: 'Solo el organizador puede gestionar árbitros' });

  db.prepare('DELETE FROM tournament_arbiters WHERE tournament_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ ok: true });
});

export default router;

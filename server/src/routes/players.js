import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// GET /players — buscar jugadores
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { q, federation, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM players WHERE 1=1';
  const params = [];

  if (q) { sql += ' AND (name LIKE ? OR last_name LIKE ? OR fide_id LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (federation) { sql += ' AND federation = ?'; params.push(federation); }

  sql += ' ORDER BY fide_rating DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const players = await db.prepare(sql).all(...params);
  res.json({ players, page: parseInt(page) });
});

// GET /players/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const player = await db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });
  res.json(player);
});

// POST /players
router.post('/', authenticate, validate({
  name: { type: 'string', required: true },
  fide_id: { type: 'string' },
  fide_rating: { type: 'integer' },
}), (req, res) => {
  const db = getDb();
  const { fide_id, name, last_name, title, federation, fide_rating, national_rating, birth_date, sex, email, phone, notes } = req.body;

  // Si tiene fide_id, verificar duplicado
  if (fide_id) {
    const existing = await db.prepare('SELECT id FROM players WHERE fide_id = ?').get(fide_id);
    if (existing) return res.status(409).json({ error: 'Jugador con ese FIDE ID ya existe', id: existing.id });
  }

  const result = await db.prepare(`
    INSERT INTO players (fide_id, name, last_name, title, federation, fide_rating, national_rating, birth_date, sex, email, phone, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fide_id ?? '', name, last_name ?? '', title ?? '', federation ?? '', fide_rating ?? 0, national_rating ?? 0, birth_date ?? '', sex ?? '', email ?? '', phone ?? '', notes ?? '');

  const player = await db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(player);
});

// PATCH /players/:id
router.patch('/:id', authenticate, (req, res) => {
  const db = getDb();
  const p = await db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Jugador no encontrado' });

  const allowed = ['fide_id','name','last_name','title','federation','fide_rating','national_rating','birth_date','sex','email','phone','notes'];
  const updates = [];
  const params = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Sin cambios' });

  params.push(req.params.id);
  await db.prepare(`UPDATE players SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json(await db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id));
});

// GET /players/my-tournaments — historial y estadísticas del jugador autenticado
router.get('/my-tournaments', authenticate, (req, res) => {
  try {
    const db = getDb();
    const user = req.user;

    // Buscar player(s) por email del usuario
    const player = await db.prepare(`SELECT * FROM players WHERE email = ? AND email != ''`).get(user.email);
    if (!player) return res.json({ player: null, tournaments: [], stats: null });

    // Torneos donde participó este player
    const participations = await db.prepare(`
      SELECT tp.*, t.name, t.system, t.n_rounds, t.federation, t.status, t.end_date as finished_date
      FROM tournament_players tp
      JOIN tournaments t ON t.id = tp.tournament_id
      WHERE tp.player_id = ?
      ORDER BY t.created_at DESC
    `).all(player.id);

    let totalGames = 0, totalWins = 0, totalPoints = 0;

    const tournaments = participations.map((p) => {
      // Obtener rondas y resultados para este jugador en este torneo
      const rounds = await db.prepare(`
        SELECT r.round_number, pa.*, pw.name as white_name, pw.fide_rating as white_rating,
               pb.name as black_name, pb.fide_rating as black_rating
        FROM rounds r
        JOIN pairings pa ON pa.round_id = r.id
        LEFT JOIN players pw ON pw.id = CASE WHEN pa.white_id = tp_local.id THEN pa.black_id ELSE pa.white_id END
        LEFT JOIN players pb ON pb.id = CASE WHEN pa.black_id = tp_local.id THEN pa.white_id ELSE pa.black_id END
        JOIN tournament_players tp_local ON tp_local.tournament_id = r.tournament_id AND tp_local.player_id = ?
        WHERE r.tournament_id = ? AND r.status = 'closed'
          AND (pa.white_id = tp_local.id OR pa.black_id = tp_local.id)
        ORDER BY r.round_number ASC
      `).all(player.id, p.tournament_id);

      const playerTpId = await db.prepare(`SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?`).get(p.tournament_id, player.id)?.id;

      const roundData = rounds.map((r) => {
        const isWhite = String(r.white_id) === String(playerTpId);
        const score = isWhite
          ? (r.result === '1' ? 1 : r.result === '0' ? 0 : r.result === '=' ? 0.5 : null)
          : (r.result === '0' ? 1 : r.result === '1' ? 0 : r.result === '=' ? 0.5 : null);
        if (score !== null) { totalGames++; totalPoints += score; if (score === 1) totalWins++; }
        return {
          round_number: r.round_number,
          white_name: r.white_name, white_rating: r.white_rating,
          black_name: r.black_name, black_rating: r.black_rating,
          result: r.result, is_bye: !!r.is_bye,
        };
      });

      return {
        id: p.tournament_id,
        name: p.name, system: p.system, n_rounds: p.n_rounds,
        federation: p.federation, status: p.status, finished_date: p.finished_date,
        player_score: p.current_points,
        rounds: roundData,
      };
    });

    const stats = {
      tournaments: tournaments.length,
      games: totalGames,
      wins: totalWins,
      points: totalPoints,
    };

    res.json({ player, tournaments, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

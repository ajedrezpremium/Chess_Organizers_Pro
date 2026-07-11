import { Router } from 'express';
import { getDb } from '../db/index.js';
import config from '../config.js';
import { buildPlayerState } from '../utils/roundUtils.js';
import { buildStandings } from '../../../src/engine/dutch.js';
import { calculateRatingChanges, perRoundChanges } from '../services/ratingChange.js';
import { calculateTiebreak } from '../../../src/engine/tiebreaks.js';
import { DEFAULT_TIEBREAK_ORDER } from '../../../src/engine/types.js';
import { subscribe } from '../services/pubsub.js';
import { notifyRegistrationReceived } from '../services/notifications.js';

const router = Router();

// GET /public/tournaments — listar torneos públicos con filtros
router.get('/tournaments', async (req, res) => {
  const db = getDb();
  const { page = 1, limit = 20, federation, status, system, search, from, to } = req.query;
  let sql = "SELECT id, name, system, n_rounds, federation, status, city, start_date, end_date, time_control, description, created_at FROM tournaments WHERE status != 'pending'";
  const params = [];

  if (federation) { sql += ' AND federation = ?'; params.push(federation); }
  if (status === 'active' || status === 'finished') { sql += ' AND status = ?'; params.push(status); }
  if (system) { sql += ' AND system = ?'; params.push(system); }
  if (search) { sql += ' AND (name LIKE ? OR city LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (from) { sql += ' AND start_date >= ?'; params.push(from); }
  if (to) { sql += ' AND start_date <= ?'; params.push(to); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const tournaments = await db.prepare(sql).all(...params);
  for (const t of tournaments) {
    const cnt = await db.prepare('SELECT COUNT(*) as c FROM tournament_players WHERE tournament_id = ?').get(t.id);
    t.player_count = cnt.c;
  }
  const total = await db.prepare("SELECT COUNT(*) as count FROM tournaments WHERE status != 'pending'").get();
  res.json({ tournaments, total: total.count, page: parseInt(page) });
});

// GET /public/tournaments/:id
router.get('/tournaments/:id', async (req, res) => {
  const db = getDb();
  const t = await db.prepare("SELECT * FROM tournaments WHERE id = ?").get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });
  if (t.status === 'pending') return res.status(404).json({ error: 'Torneo no encontrado' });

  t.tiebreaks = t.tiebreaks ? t.tiebreaks.split(',') : ['BH1','BH','SB','DE','PR'];
  t.categories = t.categories ? t.categories.split(',').map((c) => c.trim()).filter(Boolean) : [];
  const players = await db.prepare('SELECT COUNT(*) as count FROM tournament_players WHERE tournament_id = ?').get(req.params.id);
  t.player_count = players.count;

  res.json(t);
});

// GET /public/tournaments/:id/players
router.get('/tournaments/:id/players', async (req, res) => {
  const db = getDb();
  const players = await db.prepare(`
    SELECT tp.seed_rank, tp.current_points, tp.category, p.name, p.last_name, p.fide_rating, p.title, p.federation, p.fide_id
    FROM tournament_players tp JOIN players p ON tp.player_id = p.id
    WHERE tp.tournament_id = ?
    ORDER BY tp.seed_rank ASC
  `).all(req.params.id);

  res.json(players);
});

// GET /public/tournaments/:id/rounds
router.get('/tournaments/:id/rounds', async (req, res) => {
  const db = getDb();
  const rounds = await db.prepare('SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC').all(req.params.id);
  for (const r of rounds) {
    r.pairings = await db.prepare(`
      SELECT p.*, w.name as white_name, w.last_name as white_last, w.fide_rating as white_rating,
             b.name as black_name, b.last_name as black_last, b.fide_rating as black_rating
      FROM pairings p
      LEFT JOIN tournament_players tpw ON p.white_id = tpw.id
      LEFT JOIN players w ON tpw.player_id = w.id
      LEFT JOIN tournament_players tpb ON p.black_id = tpb.id
      LEFT JOIN players b ON tpb.player_id = b.id
      WHERE p.round_id = ?
      ORDER BY p.board ASC
    `).all(r.id);
  }
  res.json(rounds);
});

// GET /public/tournaments/:id/standings
router.get('/tournaments/:id/standings', async (req, res) => {
  const db = getDb();
  const tournament = await db.prepare("SELECT * FROM tournaments WHERE id = ?").get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  let players = buildPlayerState(db, req.params.id);
  const totalRounds = await db.prepare("SELECT MAX(round_number) as max FROM rounds WHERE tournament_id = ? AND status = 'closed'").get(req.params.id)?.max ?? 0;
  const tiebreaks = tournament.tiebreaks ? tournament.tiebreaks.split(',') : DEFAULT_TIEBREAK_ORDER;

  // Category filter
  const categoryFilter = req.query.category;
  if (categoryFilter) {
    players = players.filter((p) => p.category === categoryFilter);
  }

  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const withTb = players.map((player) => ({
    ...player,
    tiebreakValues: tiebreaks.map((tb) => calculateTiebreak(tb, player, playersById, totalRounds)),
  }));

  const standings = buildStandings(withTb);

  const closedRounds = await db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.id);
  const roundPairings = closedRounds.map((r) => {
    const pairings = await db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
    return { number: r.round_number, pairings };
  });
  const ratingChanges = calculateRatingChanges(players, roundPairings);

  res.json({
    standings: standings.map((s, i) => ({
      position: i + 1,
      id: s.id,
      name: s.name,
      lastName: s.lastName,
      fideRating: s.fideRating,
      title: s.title,
      category: s.category,
      points: s.points,
      tiebreakValues: s.tiebreakValues,
      ratingChange: ratingChanges[s.id] ?? 0,
    })),
    ratingChanges,
    tiebreaks,
  });
});

// GET /public/tournaments/:id/performance — TPR + per-round ΔR
router.get('/tournaments/:id/performance', async (req, res) => {
  try {
    const db = getDb();
    const tournament = await db.prepare("SELECT * FROM tournaments WHERE id = ?").get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const players = buildPlayerState(db, req.params.id);
    const rounds = await db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.id);
    const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

    for (const r of rounds) {
      r.pairings = await db.prepare(
        `SELECT p.*, w.fide_rating as white_rating, w2.fide_rating as black_rating
         FROM pairings p
         LEFT JOIN tournament_players tpw ON p.white_id = tpw.id
         LEFT JOIN players w ON tpw.player_id = w.id
         LEFT JOIN tournament_players tpb ON p.black_id = tpb.id
         LEFT JOIN players w2 ON tpb.player_id = w2.id
         WHERE p.round_id = ? ORDER BY p.board ASC`
      ).all(r.id);
    }

    const chg = perRoundChanges(players, rounds);
    const pairingsByRound = {};
    for (const r of rounds) {
      pairingsByRound[r.round_number] = r.pairings;
    }

    const results = players.map((player) => {
      let totalPts = 0;
      let totalGames = 0;
      let oppRatings = [];

      for (let rn = 1; rn <= tournament.n_rounds; rn++) {
        const pbs = pairingsByRound[rn] || [];
        const pairing = pbs.find((pb) => String(pb.white_id) === player.id || String(pb.black_id) === player.id);
        if (!pairing) continue;
        const isWhite = String(pairing.white_id) === player.id;
        const oppId = isWhite ? String(pairing.black_id) : String(pairing.white_id);
        const opp = playerMap[oppId];
        const pts = pairing.result === '1' ? (isWhite ? 1 : 0) : pairing.result === '=' ? 0.5 : pairing.result === '0' ? (isWhite ? 0 : 1) : null;
        if (pts === null) continue;
        totalPts += pts;
        totalGames++;
        if (opp && opp.fideRating > 0) oppRatings.push({ rating: opp.fideRating, result: pts });
      }

      const pchg = chg[player.id] || { total: null, rounds: [], kFactor: 40, tpr: null };
      const fallbackTpr = oppRatings.length > 0
        ? Math.round(oppRatings.reduce((s, o) => s + o.rating, 0) / oppRatings.length + 800 * (totalPts / totalGames - 0.5))
        : null;

      return {
        id: player.id, name: player.name, lastName: player.lastName,
        rating: player.fideRating, title: player.title, federation: player.country,
        points: totalPts, games: totalGames, tpr: pchg.tpr || fallbackTpr,
        ratingChg: pchg.total,
        roundChanges: pchg.rounds,
        kFactor: pchg.kFactor,
      };
    });

    results.sort((a, b) => b.points - a.points || (b.rating || 0) - (a.rating || 0));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /public/tournaments/:id/sse — Server-Sent Events
router.get('/tournaments/:id/sse', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Enviar heartbeat cada 30s para mantener conexión
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 30000);

  subscribe(req.params.id, res);

  req.on('close', () => clearInterval(heartbeat));
});

// GET /public/players/search — búsqueda global de jugadores
router.get('/players/search', async (req, res) => {
  const db = getDb();
  const { q, page = 1, limit = 30 } = req.query;
  if (!q || q.trim().length < 2) return res.json({ players: [], total: 0, page: 1 });

  const search = `%${q.trim()}%`;
  const sql = `SELECT id, fide_id, name, last_name, title, federation, fide_rating, national_rating
               FROM players WHERE name LIKE ? OR last_name LIKE ? OR fide_id LIKE ?
               ORDER BY fide_rating DESC LIMIT ? OFFSET ?`;
  const players = await db.prepare(sql).all(search, search, search, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const total = await db.prepare(`SELECT COUNT(*) as c FROM players WHERE name LIKE ? OR last_name LIKE ? OR fide_id LIKE ?`).get(search, search, search);
  res.json({ players, total: total.c, page: parseInt(page) });
});

// GET /public/players/:id/tournaments — historial de torneos de un jugador
router.get('/players/:id/tournaments', async (req, res) => {
  const db = getDb();
  const player = await db.prepare('SELECT id, fide_id, name, last_name, title, federation, fide_rating FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

  const tournaments = await db.prepare(`
    SELECT t.id, t.name, t.system, t.federation, t.city, t.start_date, t.end_date, t.status, t.n_rounds,
           tp.seed_rank, tp.current_points, tp.final_position
    FROM tournament_players tp
    JOIN tournaments t ON tp.tournament_id = t.id
    WHERE tp.player_id = ? AND t.status IN ('active','finished')
    ORDER BY t.start_date DESC
  `).all(req.params.id);

  res.json({ player, tournaments });
});

// ── 6.4 Catálogo Global ────────────────────────────────────────────

// GET /public/federations — lista de federaciones con torneos
router.get('/federations', async (req, res) => {
  const db = getDb();
  const fromTours = await db.prepare("SELECT DISTINCT federation FROM tournaments WHERE federation != '' AND status != 'pending' ORDER BY federation").all();
  const fromSettings = await db.prepare("SELECT federation, name, logo_url FROM federation_settings ORDER BY name").all();
  const fedMap = {};
  for (const t of fromTours) if (t.federation) fedMap[t.federation] = { code: t.federation, name: t.federation, logo_url: '' };
  for (const s of fromSettings) fedMap[s.federation] = { code: s.federation, name: s.name, logo_url: s.logo_url || '' };
  res.json(Object.values(fedMap).sort((a, b) => a.name.localeCompare(b.name)));
});

// GET /public/stats — estadísticas globales del catálogo
router.get('/stats', async (req, res) => {
  const db = getDb();
  const total = await db.prepare("SELECT COUNT(*) as c FROM tournaments WHERE status != 'pending'").get().c;
  const active = await db.prepare("SELECT COUNT(*) as c FROM tournaments WHERE status = 'active'").get().c;
  const finished = await db.prepare("SELECT COUNT(*) as c FROM tournaments WHERE status = 'finished'").get().c;
  const totalPlayers = await db.prepare("SELECT COUNT(*) as c FROM tournament_players tp JOIN tournaments t ON t.id = tp.tournament_id WHERE t.status != 'pending'").get().c;
  const byFederation = await db.prepare(`
    SELECT federation, COUNT(*) as count FROM tournaments
    WHERE federation != '' AND status != 'pending' GROUP BY federation ORDER BY count DESC LIMIT 10
  `).all();
  const bySystem = await db.prepare(`
    SELECT system, COUNT(*) as count FROM tournaments
    WHERE status != 'pending' GROUP BY system ORDER BY count DESC
  `).all();
  const totalOrganizers = await db.prepare("SELECT COUNT(DISTINCT created_by) as c FROM tournaments WHERE status != 'pending'").get().c;
  res.json({ total, active, finished, totalPlayers, byFederation, bySystem, totalOrganizers });
});

// GET /public/organizers — lista de organizadores
router.get('/organizers', async (req, res) => {
  const db = getDb();
  const organizers = await db.prepare(`
    SELECT u.id, u.name, u.email, u.federation,
           (SELECT COUNT(*) FROM tournaments t WHERE t.created_by = u.id AND t.status != 'pending') as tournament_count,
           (SELECT COUNT(*) FROM tournaments t WHERE t.created_by = u.id AND t.status = 'active') as active_count,
           (SELECT COUNT(*) FROM tournaments t WHERE t.created_by = u.id AND t.status = 'finished') as finished_count
    FROM users u
    WHERE u.id IN (SELECT DISTINCT created_by FROM tournaments WHERE status != 'pending')
    ORDER BY tournament_count DESC
  `).all();
  res.json(organizers);
});

// GET /public/organizers/:id — detalle de organizador + sus torneos
router.get('/organizers/:id', async (req, res) => {
  const db = getDb();
  const org = await db.prepare("SELECT id, name, email, federation FROM users WHERE id = ?").get(req.params.id);
  if (!org) return res.status(404).json({ error: 'Organizador no encontrado' });

  const tournaments = await db.prepare(`
    SELECT t.id, t.name, t.system, t.n_rounds, t.federation, t.city, t.start_date, t.status,
           (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = t.id) as player_count
    FROM tournaments t WHERE t.created_by = ? AND t.status != 'pending' ORDER BY t.created_at DESC
  `).all(req.params.id);

  res.json({ organizer: org, tournaments });
});

// ── Widgets embeddables ────────────────────────────────────────────

router.get('/widget/tournaments/:id/standings', async (req, res) => {
  const db = getDb();
  const tournament = await db.prepare("SELECT id, name, federation, system, n_rounds, tiebreaks, primary_color, secondary_color, logo_url FROM tournaments WHERE id = ? AND status != 'pending'").get(req.params.id);
  if (!tournament) return res.status(404).send('Torneo no encontrado');

  const players = buildPlayerState(db, req.params.id);
  const totalRounds = await db.prepare("SELECT MAX(round_number) as max FROM rounds WHERE tournament_id = ? AND status = 'closed'").get(req.params.id)?.max ?? 0;
  const tiebreaks = tournament.tiebreaks ? tournament.tiebreaks.split(',') : DEFAULT_TIEBREAK_ORDER;
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const withTb = players.map((p) => ({ ...p, tiebreakValues: tiebreaks.map((tb) => calculateTiebreak(tb, p, playersById, totalRounds)) }));
  const standings = buildStandings(withTb);

  const closedRounds = await db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.id);
  const roundPairings = closedRounds.map((r) => {
    const pairings = await db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
    return { number: r.round_number, pairings };
  });
  const ratingChanges = calculateRatingChanges(players, roundPairings);

  const pc = tournament.primary_color || '#f59e0b';
  const sc = tournament.secondary_color || '#1f2937';
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:${sc};color:#fff;font-size:12px;overflow-x:auto}
  .hdr{display:flex;align-items:center;gap:8px;padding:8px 12px;background:${pc}22;border-bottom:1px solid ${pc}44}
  .hdr img{height:24px;width:auto}
  .hdr h1{font-size:13px;font-weight:700;color:${pc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;padding:5px 6px;font-size:9px;text-transform:uppercase;color:${pc};border-bottom:1px solid ${pc}33;letter-spacing:0.3px}
  td{padding:4px 6px;border-bottom:1px solid #ffffff15;font-size:11px}
  tr:hover td{background:#ffffff08}
  .pos{color:#888;width:24px;text-align:center;font-weight:700}
  .pts{font-weight:700;text-align:center;color:${pc};width:30px}
  .elo{color:#888}
  .chg{font-size:10px;width:32px;text-align:center}
  .chg.pos{color:#4ade80}
  .chg.neg{color:#f87171}
  .ftr{text-align:center;padding:6px;font-size:8px;color:#666}
  .ftr a{color:${pc};text-decoration:none}
</style></head><body>
<div class="hdr">${tournament.logo_url ? `<img src="${tournament.logo_url}" alt="">` : `<span style="color:${pc}">♛</span>`}
<h1>${tournament.name}</h1></div>
<table><thead><tr><th class="pos">#</th><th>Jugador</th><th class="elo">Elo</th><th class="pts">Pts</th><th class="chg">Δ</th></tr></thead><tbody>`;
  standings.forEach((s, i) => {
    const chg = ratingChanges[s.id] || 0;
    html += `<tr><td class="pos">${i + 1}</td><td>${s.title ? s.title + ' ' : ''}${s.name} ${s.lastName || ''}</td>
      <td class="elo">${s.fideRating || ''}</td>
      <td class="pts">${s.points}</td>
      <td class="chg ${chg > 0 ? 'pos' : chg < 0 ? 'neg' : ''}">${chg > 0 ? '+' : ''}${chg}</td></tr>`;
  });
  html += `</tbody></table>
<div class="ftr">♛ <a href="/public/tournament/${tournament.id}" target="_blank">Chess Organizers Pro</a></div>
</body></html>`;
  res.set('Content-Type', 'text/html;charset=utf-8');
  res.send(html);
});

router.get('/widget/tournaments/:id/wall', async (req, res) => {
  const db = getDb();
  const tournament = await db.prepare("SELECT id, name, primary_color, secondary_color, logo_url, system, n_rounds FROM tournaments WHERE id = ? AND status != 'pending'").get(req.params.id);
  if (!tournament) return res.status(404).send('Torneo no encontrado');

  const round = await db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status IN ('generated','published') ORDER BY round_number ASC").all(req.params.id).pop();
  if (!round) return res.status(200).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#1f2937;color:#666;text-align:center;padding:40px;font-size:14px">⏳ Esperando próxima ronda</body></html>`);

  const pairings = await db.prepare(`
    SELECT p.board, p.result, p.is_bye,
           w.name as w_name, w.last_name as w_last, w.fide_rating as w_elo,
           b.name as b_name, b.last_name as b_last, b.fide_rating as b_elo
    FROM pairings p
    LEFT JOIN tournament_players tpw ON p.white_id = tpw.id
    LEFT JOIN players w ON tpw.player_id = w.id
    LEFT JOIN tournament_players tpb ON p.black_id = tpb.id
    LEFT JOIN players b ON tpb.player_id = b.id
    WHERE p.round_id = ? ORDER BY p.board ASC
  `).all(round.id);

  const pc = tournament.primary_color || '#f59e0b';
  const sc = tournament.secondary_color || '#1f2937';
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:${sc};color:#fff;font-size:13px}
  .hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;background:${pc}22;border-bottom:1px solid ${pc}44}
  .hdr h1{font-size:14px;font-weight:700;color:${pc}}
  .round{text-align:center;padding:8px;font-size:11px;color:#888;border-bottom:1px solid #ffffff15}
  .card{margin:6px;padding:10px;background:#ffffff08;border-radius:8px;border-left:3px solid ${pc}}
  .players{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .player{font-weight:600;font-size:13px}
  .player small{font-weight:400;color:#888;font-size:11px}
  .result{font-size:16px;font-weight:700;color:${pc};text-align:center;min-width:40px}
  .board{font-size:10px;color:#666;margin-bottom:4px}
  .ftr{text-align:center;padding:8px;font-size:8px;color:#555}
  .live{display:inline-block;width:8px;height:8px;background:#4ade80;border-radius:50%;margin-right:4px;animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
</style></head><body>
<div class="hdr"><span style="color:${pc}">♛</span><h1>${tournament.name}</h1></div>
<div class="round"><span class="live"></span>Ronda ${round.round_number} en vivo</div>`;
  pairings.forEach((p) => {
    if (p.is_bye) return;
    html += `<div class="card">
      <div class="board">Mesa ${p.board}</div>
      <div class="players">
        <div class="player">${p.w_name || ''} ${p.w_last || ''} <small>${p.w_elo || ''}</small></div>
        <div class="result">${p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : '-'}</div>
        <div class="player">${p.b_name || ''} ${p.b_last || ''} <small>${p.b_elo || ''}</small></div>
      </div>
    </div>`;
  });
  html += `<div class="ftr"><a href="/public/tournament/${tournament.id}/tv" target="_blank" style="color:${pc};text-decoration:none">Ver en Chess Organizers Pro</a></div>
</body></html>`;
  res.set('Content-Type', 'text/html;charset=utf-8');
  res.send(html);
});

// ── Helpers ────────────────────────────────────────────────────────

function resultPoints(r) {
  if (r === '1') return 1;
  if (r === '0') return 0;
  if (r === '=') return 0.5;
  return null;
}

// GET /public/tournaments/:id/crosstab — tabla cruzada pública
router.get('/tournaments/:id/crosstab', async (req, res) => {
  try {
    const db = getDb();
    const tournament = await db.prepare("SELECT * FROM tournaments WHERE id = ? AND status != 'pending'").get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const players = buildPlayerState(db, req.params.id);
    const rounds = await db.prepare("SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC").all(req.params.id);

    const pairingsByRound = {};
    for (const r of rounds) {
      pairingsByRound[r.round_number] = await db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
    }

    const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

    const matrix = players.map((player) => {
      const roundData = [];
      let totalPoints = 0;

      for (let rn = 1; rn <= tournament.n_rounds; rn++) {
        const pbs = pairingsByRound[rn] || [];
        const pairing = pbs.find((pb) => String(pb.white_id) === player.id || String(pb.black_id) === player.id);
        if (!pairing) {
          roundData.push({ opponent: null, result: '-', color: null, board: null });
          continue;
        }
        const isWhite = String(pairing.white_id) === player.id;
        const oppId = isWhite ? String(pairing.black_id) : String(pairing.white_id);
        const opp = playerMap[oppId];
        const pts = resultPoints(pairing.result);
        if (pts !== null) totalPoints += pts;
        roundData.push({
          opponent: opp ? { id: opp.id, name: opp.name, lastName: opp.lastName, rating: opp.fideRating } : null,
          result: pairing.result, color: isWhite ? 'W' : 'B', board: pairing.board, isBye: !!pairing.is_bye,
        });
      }

      return {
        id: player.id, name: player.name, lastName: player.lastName,
        rating: player.fideRating, title: player.title, federation: player.country,
        points: totalPoints, rounds: roundData,
      };
    });

    matrix.sort((a, b) => b.points - a.points || (b.rating || 0) - (a.rating || 0));
    res.json({ tournament: tournament.name, nRounds: tournament.n_rounds, players: matrix });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /public/tournaments/:id/head-to-head — enfrentamientos directos entre dos jugadores
router.get('/tournaments/:id/head-to-head', async (req, res) => {
  try {
    const db = getDb();
    const { p1, p2 } = req.query;
    if (!p1 || !p2) return res.status(400).json({ error: 'Se requieren p1 y p2 (IDs de jugadores)' });

    const tps1 = await db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND id = ?').get(req.params.id, p1);
    const tps2 = await db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND id = ?').get(req.params.id, p2);
    if (!tps1 || !tps2) return res.status(404).json({ error: 'Jugador no encontrado en este torneo' });

    const rounds = await db.prepare("SELECT id, round_number, status FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC").all(req.params.id);

    const encounters = [];
    for (const round of rounds) {
      const pairing = await db.prepare(
        "SELECT * FROM pairings WHERE round_id = ? AND ((white_id = ? AND black_id = ?) OR (white_id = ? AND black_id = ?))"
      ).get(round.id, p1, p2, p2, p1);

      if (pairing) {
        const isP1White = String(pairing.white_id) === String(p1);
        encounters.push({
          round: round.round_number, board: pairing.board,
          result: pairing.result, isBye: !!pairing.is_bye,
          p1Color: isP1White ? 'W' : 'B',
        });
      }
    }

    const p1d = await db.prepare("SELECT tp.id, p.name, p.last_name, p.fide_rating, p.title FROM tournament_players tp JOIN players p ON tp.player_id = p.id WHERE tp.id = ?").get(p1);
    const p2d = await db.prepare("SELECT tp.id, p.name, p.last_name, p.fide_rating, p.title FROM tournament_players tp JOIN players p ON tp.player_id = p.id WHERE tp.id = ?").get(p2);

    res.json({ player1: p1d, player2: p2d, encounters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /public/tournaments/:id/registration-status — estado de inscripción
router.get('/tournaments/:id/registration-status', async (req, res) => {
  const db = getDb();
  const t = await db.prepare("SELECT registration_open, registration_opens_at, registration_closes_at, max_players, registered_count, registration_fee, registration_currency, status, auto_approve FROM tournaments WHERE id = ?").get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const now = new Date();
  const opensAt = t.registration_opens_at ? new Date(t.registration_opens_at) : null;
  const closesAt = t.registration_closes_at ? new Date(t.registration_closes_at) : null;

  let canRegister = !!t.registration_open;
  let message = '';

  if (!canRegister) message = 'Las inscripciones están cerradas.';
  else if (opensAt && now < opensAt) { canRegister = false; message = `Las inscripciones abren el ${opensAt.toLocaleDateString()}.`; }
  else if (closesAt && now > closesAt) { canRegister = false; message = 'Las inscripciones han cerrado.'; }
  else if (t.max_players > 0 && (t.registered_count || 0) >= t.max_players) { canRegister = false; message = `Torneo completo (${t.max_players} jugadores).`; }

  res.json({
    canRegister,
    message,
    isOpen: !!t.registration_open,
    opensAt: t.registration_opens_at || null,
    closesAt: t.registration_closes_at || null,
    maxPlayers: t.max_players || 0,
    registeredCount: t.registered_count || 0,
    spotsRemaining: t.max_players > 0 ? Math.max(0, t.max_players - (t.registered_count || 0)) : -1,
    hasFee: (t.registration_fee || 0) > 0,
    fee: t.registration_fee || 0,
    currency: t.registration_currency || 'usd',
    autoApprove: !!t.auto_approve,
    status: t.status,
    needsPayment: (t.registration_fee || 0) > 0 && t.status !== 'finished',
  });
});

// POST /public/tournaments/:id/register — auto-registro de jugador
router.post('/tournaments/:id/register', async (req, res) => {
  const db = getDb();
  const t = await db.prepare("SELECT * FROM tournaments WHERE id = ? AND status != 'pending'").get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  // ── Registration open checks ──
  if (!t.registration_open) {
    return res.status(403).json({ error: 'Las inscripciones están cerradas para este torneo.' });
  }

  const now = new Date();
  if (t.registration_opens_at) {
    const opensAt = new Date(t.registration_opens_at);
    if (now < opensAt) {
      return res.status(403).json({ error: `Las inscripciones abren el ${opensAt.toLocaleDateString()}` });
    }
  }
  if (t.registration_closes_at) {
    const closesAt = new Date(t.registration_closes_at);
    if (now > closesAt) {
      return res.status(403).json({ error: 'Las inscripciones han cerrado para este torneo.' });
    }
  }

  // ── Max players check ──
  if (t.max_players > 0) {
    const currentCount = await db.prepare(`
      SELECT COUNT(*) as c FROM tournament_players WHERE tournament_id = ?
    `).get(req.params.id).c;
    if (currentCount >= t.max_players) {
      return res.status(403).json({ error: `El torneo ha alcanzado el límite de ${t.max_players} jugadores.` });
    }
  }

  const { name, last_name, email, fide_id, fide_rating, federation, title, phone, notes, custom_data } = req.body;
  if (!name || name.trim().length === 0) return res.status(400).json({ error: 'El nombre es obligatorio' });

  // ── Duplicate check ──
  if (email || fide_id) {
    const dupes = await db.prepare(`
      SELECT COUNT(*) as c FROM registration_requests
      WHERE tournament_id = ? AND status IN ('pending','pending_payment','approved')
      AND (? != '' AND email = ?) OR (? != '' AND fide_id = ?)
    `).get(req.params.id, email || '', email || '', fide_id || '', fide_id || '');
    if (dupes.c > 0) {
      return res.status(409).json({ error: 'Ya tienes una solicitud activa para este torneo.' });
    }
    const enrolled = await db.prepare(`
      SELECT COUNT(*) as c FROM tournament_players tp
      JOIN players p ON tp.player_id = p.id
      WHERE tp.tournament_id = ? AND ((? != '' AND p.email = ?) OR (? != '' AND p.fide_id = ?))
    `).get(req.params.id, email || '', email || '', fide_id || '', fide_id || '');
    if (enrolled.c > 0) {
      return res.status(409).json({ error: 'Ya estás inscrito en este torneo.' });
    }
  }

  // Validate custom_data against tournament's custom_fields definition
  let customFields = [];
  try { customFields = JSON.parse(t.custom_fields || '[]'); } catch {}
  const validatedCustomData = {};
  if (custom_data && typeof custom_data === 'object') {
    for (const field of customFields) {
      const val = custom_data[field.key];
      if (field.required && !val && val !== false) {
        return res.status(400).json({ error: `El campo "${field.label}" es obligatorio` });
      }
      if (val !== undefined && val !== '') {
        validatedCustomData[field.key] = val;
      }
    }
  }

  const fee = t.registration_fee || 0;
  const needsPayment = fee > 0 && t.status !== 'finished';
  const status = needsPayment ? 'pending_payment' : 'pending';

  const result = await db.prepare(`
    INSERT INTO registration_requests (tournament_id, name, last_name, email, fide_id, fide_rating, federation, title, phone, notes, custom_data, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, name.trim(), last_name?.trim() ?? '', email?.trim() ?? '', fide_id?.trim() ?? '',
         fide_rating ?? 0, federation?.trim() ?? '', title?.trim() ?? '', phone?.trim() ?? '',
         notes?.trim() ?? '', JSON.stringify(validatedCustomData), status);

  const regId = result.lastInsertRowid;

  // Increment registered_count
  await db.prepare('UPDATE tournaments SET registered_count = registered_count + 1 WHERE id = ?').run(req.params.id);

  // Notify
  notifyRegistrationReceived(req.params.id, email, name);

  // If payment required, create Stripe Checkout Session
  if (needsPayment) {
    try {
      const { createRegistrationCheckoutSession, isStripeConfigured } = await import('../services/stripe.js');
      if (!isStripeConfigured()) throw new Error('Stripe no configurado');
      const checkout = await createRegistrationCheckoutSession({
        registrationId: regId,
        tournament: t,
        amount: fee,
        currency: t.registration_currency || 'usd',
        successUrl: `${config.publicUrl}/public/tournament/${t.id}/register?success=1&reg_id=${regId}`,
        cancelUrl: `${config.publicUrl}/public/tournament/${t.id}/register?reg_id=${regId}`,
      });

      await db.prepare('UPDATE registration_requests SET stripe_checkout_session_id = ? WHERE id = ?').run(checkout.sessionId, regId);

      return res.status(201).json({
        ok: true, requires_payment: true,
        checkout_url: checkout.url,
        registration_id: regId,
        message: 'Se requiere pago para completar la inscripción.',
      });
    } catch (err) {
      // Stripe not configured or error - create as pending without payment
      await db.prepare("UPDATE registration_requests SET status = 'pending' WHERE id = ?").run(regId);
      return res.status(201).json({
        ok: true, requires_payment: false,
        message: 'Solicitud de inscripción enviada. El organizador la revisará.',
      });
    }
  }

  res.status(201).json({ ok: true, message: 'Solicitud de inscripción enviada. El organizador la revisará.' });
});

export default router;

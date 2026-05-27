import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { PairingEngine } from '../../../src/engine/pairingEngine.js';
import { serializeTRF } from '../../../src/trf/trf.js';
import { applyRoundResults, buildStandings } from '../../../src/engine/dutch.js';
import { calculateTiebreak } from '../../../src/engine/tiebreaks.js';
import { DEFAULT_TIEBREAK_ORDER } from '../../../src/engine/types.js';
import { buildPlayerState, savePlayerState } from '../utils/roundUtils.js';
import { publish } from '../services/pubsub.js';
import { notifyRoundGenerated, notifyResultUpdated } from '../services/notifications.js';
import { dispatchWebhooks } from '../services/webhooks.js';
import { calculateRatingChanges } from '../services/ratingChange.js';

const router = Router();
const engine = new PairingEngine({ forceBackend: 'js', verbose: false });

// ── Routes ─────────────────────────────────────────────────────────

// GET /tournaments/:tid/rounds
router.get('/tournaments/:tid/rounds', authenticate, (req, res) => {
  const db = getDb();
  const rounds = db.prepare('SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC').all(req.params.tid);
  for (const r of rounds) {
    r.pairings = db.prepare(`
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

// POST /tournaments/:tid/rounds/generate — generar siguiente ronda
router.post('/tournaments/:tid/rounds/generate', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const lastRound = db.prepare('SELECT MAX(round_number) as max FROM rounds WHERE tournament_id = ?').get(req.params.tid);
    const nextRound = (lastRound?.max ?? 0) + 1;

    if (nextRound > tournament.n_rounds) {
      return res.status(400).json({ error: 'Todas las rondas ya fueron generadas' });
    }

    const players = buildPlayerState(db, req.params.tid);
    if (players.length < 2) return res.status(400).json({ error: 'Se necesitan al menos 2 jugadores' });

    const result = await engine.pairNextRound({
      players,
      round: nextRound,
      system: tournament.system,
    });

    // Crear ronda
    const round = db.prepare(
      'INSERT INTO rounds (tournament_id, round_number, status) VALUES (?, ?, ?)'
    ).run(req.params.tid, nextRound, 'generated');

    // Insertar pairings
    const insertPairing = db.prepare(
      'INSERT INTO pairings (round_id, board, white_id, black_id, result, is_bye) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const tpMap = {};
    for (const p of players) tpMap[p.id] = p;

    for (const pairing of result.pairings) {
      const whiteTp = players.find((p) => p.id === pairing.whiteId);
      const blackTp = !pairing.isBye ? players.find((p) => p.id === pairing.blackId) : null;
      if (whiteTp && pairing.isBye) {
        insertPairing.run(round.lastInsertRowid, pairing.board, parseInt(whiteTp.id), null, pairing.result, 1);
      } else if (whiteTp && blackTp) {
        insertPairing.run(round.lastInsertRowid, pairing.board, parseInt(whiteTp.id), parseInt(blackTp.id), pairing.result, 0);
      }
    }

    // Actualizar estado del torneo
    db.prepare("UPDATE tournaments SET status = 'active', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").run(req.params.tid);

    // Devolver la ronda creada
    const created = db.prepare('SELECT * FROM rounds WHERE id = ?').get(round.lastInsertRowid);
    created.pairings = db.prepare(`
      SELECT p.*, w.name as white_name, w.last_name as white_last, w.fide_rating as white_rating,
             b.name as black_name, b.last_name as black_last, b.fide_rating as black_rating
      FROM pairings p
      LEFT JOIN tournament_players tpw ON p.white_id = tpw.id LEFT JOIN players w ON tpw.player_id = w.id
      LEFT JOIN tournament_players tpb ON p.black_id = tpb.id LEFT JOIN players b ON tpb.player_id = b.id
      WHERE p.round_id = ? ORDER BY p.board ASC
    `).all(created.id);

    // Notificar SSE + Email + Webhooks
    publish(req.params.tid, 'round:generated', { round_number: nextRound });
    notifyRoundGenerated(created.id);
    dispatchWebhooks('round.generated', parseInt(req.params.tid), { round_number: nextRound });

    res.status(201).json({ round: created, warnings: result.warnings ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tournaments/:tid/rounds/:rid/pairings — añadir pairing manual
router.post('/tournaments/:tid/rounds/:rid/pairings', authenticate, (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

  const round = db.prepare('SELECT * FROM rounds WHERE id = ? AND tournament_id = ?').get(req.params.rid, req.params.tid);
  if (!round || round.status === 'closed') return res.status(400).json({ error: 'Ronda no disponible' });

  const { white_id, black_id, board } = req.body;
  if (!white_id) return res.status(400).json({ error: 'Jugador de blancas requerido' });

  const maxBoard = db.prepare('SELECT MAX(board) as max FROM pairings WHERE round_id = ?').get(round.id);
  const boardNum = board ?? (maxBoard?.max ?? 0) + 1;

  // Verificar que los jugadores no estén ya en esta ronda
  const existing = db.prepare('SELECT id FROM pairings WHERE round_id = ? AND (white_id = ? OR (black_id = ? AND black_id IS NOT NULL))').get(round.id, white_id, black_id || '');
  if (existing) return res.status(409).json({ error: 'Uno de los jugadores ya tiene pairing en esta ronda' });

  const result = db.prepare('INSERT INTO pairings (round_id, board, white_id, black_id, result, is_bye) VALUES (?, ?, ?, ?, ?, ?)').run(round.id, boardNum, white_id, black_id || null, '-', black_id ? 0 : 1);
  const pairing = db.prepare(`
    SELECT p.*, w.name as white_name, w.last_name as white_last, w.fide_rating as white_rating,
           b.name as black_name, b.last_name as black_last, b.fide_rating as black_rating
    FROM pairings p
    LEFT JOIN tournament_players tpw ON p.white_id = tpw.id LEFT JOIN players w ON tpw.player_id = w.id
    LEFT JOIN tournament_players tpb ON p.black_id = tpb.id LEFT JOIN players b ON tpb.player_id = b.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(pairing);
});

// DELETE /pairings/:id — eliminar pairing manual
router.delete('/pairings/:id', authenticate, (req, res) => {
  const db = getDb();
  const pairing = db.prepare(`
    SELECT p.* FROM pairings p
    JOIN rounds r ON p.round_id = r.id
    JOIN tournaments t ON r.tournament_id = t.id
    WHERE p.id = ? AND t.created_by = ?
  `).get(req.params.id, req.user.id);
  if (!pairing) return res.status(404).json({ error: 'Pairing no encontrado' });
  db.prepare('DELETE FROM pairings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PATCH /pairings/:id/swap — intercambiar colores de un pairing
router.patch('/pairings/:id/swap', authenticate, (req, res) => {
  const db = getDb();
  const pairing = db.prepare(`
    SELECT p.* FROM pairings p
    JOIN rounds r ON p.round_id = r.id
    JOIN tournaments t ON r.tournament_id = t.id
    WHERE p.id = ? AND t.created_by = ?
  `).get(req.params.id, req.user.id);
  if (!pairing || pairing.is_bye) return res.status(404).json({ error: 'Pairing no encontrado o es un bye' });
  if (!pairing.black_id) return res.status(400).json({ error: 'No hay oponente para intercambiar' });

  db.prepare('UPDATE pairings SET white_id = ?, black_id = ? WHERE id = ?').run(pairing.black_id, pairing.white_id, req.params.id);
  res.json({ ok: true });
});

// POST /rounds/:rid/publish — publicar ronda
router.post('/rounds/:rid/publish', authenticate, (req, res) => {
  const db = getDb();
  const round = db.prepare(`
    SELECT r.*, t.created_by FROM rounds r JOIN tournaments t ON r.tournament_id = t.id
    WHERE r.id = ? AND t.created_by = ?
  `).get(req.params.rid, req.user.id);
  if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });
  if (round.status !== 'generated') return res.status(400).json({ error: 'La ronda debe estar en estado generated' });

  db.prepare("UPDATE rounds SET status = 'published', published_at = datetime('now') WHERE id = ?").run(round.id);
  res.json({ ok: true });
});

// PATCH /rounds/:rid/schedule — establecer horario de una ronda
router.patch('/rounds/:rid/schedule', authenticate, (req, res) => {
  const db = getDb();
  const round = db.prepare(`
    SELECT r.*, t.created_by FROM rounds r JOIN tournaments t ON r.tournament_id = t.id
    WHERE r.id = ?
  `).get(req.params.rid);
  if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });
  if (round.created_by !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

  const { scheduled_at } = req.body;
  if (scheduled_at && isNaN(Date.parse(scheduled_at))) return res.status(400).json({ error: 'Fecha inválida' });

  db.prepare('UPDATE rounds SET scheduled_at = ? WHERE id = ?').run(scheduled_at || null, req.params.rid);
  res.json({ ok: true, scheduled_at });
});

// PATCH /rounds/:rid/result — guardar resultado de una partida
router.patch('/rounds/:rid/result', authenticate, (req, res) => {
  const db = getDb();
  const { pairing_id, result } = req.body;

  if (!['1','0','=','U','F','H','Z','-'].includes(result)) {
    return res.status(400).json({ error: 'Resultado inválido' });
  }

  const pairing = db.prepare('SELECT * FROM pairings WHERE id = ?').get(pairing_id);
  if (!pairing) return res.status(404).json({ error: 'Partida no encontrada' });

  db.prepare('UPDATE pairings SET result = ? WHERE id = ?').run(result, pairing_id);

  // Notificar SSE + Email + Webhooks
  const round = db.prepare('SELECT tournament_id FROM rounds WHERE id = ?').get(pairing.round_id);
  if (round) {
    publish(round.tournament_id, 'result:updated', { pairing_id, result });
    notifyResultUpdated(round.tournament_id);
    dispatchWebhooks('result.updated', round.tournament_id, { pairing_id, result });
  }

  res.json({ ok: true });
});

// POST /rounds/:rid/close — cerrar ronda y actualizar clasificación
router.post('/rounds/:rid/close', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const round = db.prepare(`
      SELECT r.*, t.created_by, t.system, t.n_rounds, t.tiebreaks, t.id as tournament_id
      FROM rounds r JOIN tournaments t ON r.tournament_id = t.id
      WHERE r.id = ?
    `).get(req.params.rid);

    if (!round) return res.status(404).json({ error: 'Ronda no encontrada' });
    if (round.created_by !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    if (round.status === 'closed') return res.status(400).json({ error: 'Ronda ya cerrada' });

    // Obtener pairings con resultados
    const pairings = db.prepare('SELECT * FROM pairings WHERE round_id = ?').all(round.id);
    const allResultsIn = pairings.every((p) => p.result !== '-');
    if (!allResultsIn) return res.status(400).json({ error: 'Faltan resultados por ingresar' });

    // Reconstruir estado y aplicar resultados
    let players = buildPlayerState(db, round.tournament_id);

    const enginePairings = pairings.map((p) => ({
      board: p.board,
      whiteId: String(p.white_id),
      blackId: p.black_id ? String(p.black_id) : '',
      result: p.result,
      isBye: !!p.is_bye,
    }));

    players = applyRoundResults(players, enginePairings);
    savePlayerState(db, round.tournament_id, players);

    // Cerrar ronda
    db.prepare("UPDATE rounds SET status = 'closed', closed_at = datetime('now') WHERE id = ?").run(round.id);

    // Notificar SSE + Webhooks
    publish(round.tournament_id, 'round:closed', { round_id: round.id, round_number: round.round_number });

    // Check if tournament is finished
    const lastRound = db.prepare("SELECT MAX(round_number) as max FROM rounds WHERE tournament_id = ? AND status = 'closed'").get(round.tournament_id);
    const tInfo = db.prepare('SELECT n_rounds FROM tournaments WHERE id = ?').get(round.tournament_id);
    if (lastRound?.max >= tInfo?.n_rounds) {
      dispatchWebhooks('tournament.finished', round.tournament_id, { round_number: round.round_number });
    }

    res.json({ ok: true, message: 'Ronda cerrada y clasificación actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tournaments/:tid/standings
router.get('/tournaments/:tid/standings', authenticate, (req, res) => {
  const db = getDb();
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  const players = buildPlayerState(db, req.params.tid);
  const totalRounds = db.prepare("SELECT MAX(round_number) as max FROM rounds WHERE tournament_id = ? AND status = 'closed'").get(req.params.tid)?.max ?? 0;
  const tiebreaks = tournament.tiebreaks ? tournament.tiebreaks.split(',') : DEFAULT_TIEBREAK_ORDER;

  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const withTb = players.map((player) => ({
    ...player,
    tiebreakValues: tiebreaks.map((tb) => calculateTiebreak(tb, player, playersById, totalRounds)),
  }));

  const standings = buildStandings(withTb);

  // Calcular variación de rating FIDE
  const closedRounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.tid);
  const roundPairings = closedRounds.map((r) => {
    const pairings = db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
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
      points: s.points,
      tiebreakValues: s.tiebreakValues,
      ratingChange: ratingChanges[s.id] ?? 0,
    })),
    ratingChanges,
    tiebreaks,
  });
});

// GET /tournaments/:tid/bulletin — boletín HTML del torneo
router.get('/tournaments/:tid/bulletin', authenticate, (req, res) => {
  const db = getDb();
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  const players = db.prepare(`
    SELECT tp.seed_rank, tp.current_points, tp.final_position,
           p.name, p.last_name, p.title, p.federation, p.fide_rating
    FROM tournament_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.tournament_id = ? ORDER BY tp.seed_rank ASC
  `).all(req.params.tid);

  const rounds = db.prepare('SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC').all(req.params.tid);
  const allPairings = {};
  for (const r of rounds) {
    const pairings = db.prepare(`
      SELECT p.board, p.result, p.is_bye,
             w.name as w_name, w.last_name as w_last, w.fide_rating as w_elo,
             b.name as b_name, b.last_name as b_last, b.fide_rating as b_elo
      FROM pairings p
      LEFT JOIN tournament_players tpw ON tpw.id = p.white_id
      LEFT JOIN tournament_players tpb ON tpb.id = p.black_id
      LEFT JOIN players w ON w.id = tpw.player_id
      LEFT JOIN players b ON b.id = tpb.player_id
      WHERE p.round_id = ? ORDER BY p.board ASC
    `).all(r.id);
    allPairings[r.round_number] = pairings;
  }

  const standings = db.prepare(`
    SELECT tp.seed_rank, tp.current_points, tp.final_position,
           p.name, p.last_name, p.title, p.federation, p.fide_rating,
           tp.color_diff, tp.received_bye, tp.withdrawn
    FROM tournament_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.tournament_id = ?
    ORDER BY tp.final_position IS NOT NULL DESC, tp.final_position ASC, tp.current_points DESC
  `).all(req.params.tid);

  const posMap = {};
  standings.forEach((s, i) => { posMap[s.seed_rank] = i + 1; });

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #222; }
  h1 { text-align: center; font-size: 18pt; margin-bottom: 2px; }
  .sub { text-align: center; color: #555; font-size: 10pt; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9pt; }
  th { background: #1a1a2e; color: #fff; padding: 5px 4px; text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 4px; border-bottom: 1px solid #ddd; }
  tr:nth-child(even) td { background: #f8f8f8; }
  .page-break { page-break-before: always; }
  .center { text-align: center; }
  .result { font-weight: bold; text-align: center; width: 30px; }
  .bye { color: #999; font-style: italic; }
  .header-info { text-align: center; font-size: 9pt; color: #666; margin: 4px 0 12px; }
  .round-title { font-size: 13pt; font-weight: bold; margin: 16px 0 6px; border-bottom: 2px solid #1a1a2e; padding-bottom: 3px; }
  .schedule { font-size: 8pt; color: #888; margin-left: 8px; font-weight: normal; }
</style></head><body>
<h1>${tournament.name}</h1>
<div class="header-info">
  ${tournament.city ? tournament.city + ' — ' : ''}${tournament.start_date || ''}${tournament.end_date ? ' → ' + tournament.end_date : ''}
  ${tournament.federation ? ' | ' + tournament.federation : ''}
  ${tournament.chief_arbiter ? ' | Árbitro: ' + tournament.chief_arbiter : ''}
  | Sistema: ${tournament.system} | ${tournament.n_rounds} rondas
  ${tournament.time_control ? ' | ' + tournament.time_control : ''}
</div>
`;

  // Standings
  html += `<h2 class="round-title">Clasificación Final</h2>
<table><thead><tr><th>#</th><th>Jugador</th><th>Título</th><th>Elo</th><th>Fed</th><th>Pts</th></tr></thead><tbody>`;
  standings.forEach((s, i) => {
    html += `<tr><td>${i + 1}</td><td><strong>${s.name} ${s.last_name || ''}</strong></td>
      <td>${s.title || ''}</td><td>${s.fide_rating || ''}</td>
      <td>${s.federation || ''}</td><td class="center"><strong>${s.current_points}</strong></td></tr>`;
  });
  html += `</tbody></table>`;

  // Pairings per round
  rounds.forEach((r) => {
    const pairings = allPairings[r.round_number];
    if (!pairings || pairings.length === 0) return;
    html += `<div class="page-break"></div>
<h2 class="round-title">Ronda ${r.round_number}
  ${r.scheduled_at ? `<span class="schedule">— ${new Date(r.scheduled_at).toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })}</span>` : ''}
  <span style="font-size:8pt;color:#888;font-weight:normal;margin-left:6px">(${r.status})</span>
</h2>
<table><thead><tr><th>Mesa</th><th>Blancas</th><th>Elo</th><th>Resultado</th><th>Negras</th><th>Elo</th></tr></thead><tbody>`;
    pairings.forEach((p) => {
      const isBye = p.is_bye || (!p.b_name && !p.b_last);
      html += `<tr><td class="center">${p.board}</td>
        <td>${p.w_name || ''} ${p.w_last || ''}</td>
        <td>${p.w_elo || ''}</td>
        <td class="result ${isBye ? 'bye' : ''}">${isBye ? 'BYE' : p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : p.result}</td>
        <td>${p.b_name || ''} ${p.b_last || ''}</td>
        <td>${p.b_elo || ''}</td></tr>`;
    });
    html += `</tbody></table>`;
  });

  html += `<div style="text-align:center;color:#999;font-size:8pt;margin-top:30px">Generado por Chess Organizers Pro — ${new Date().toISOString().slice(0, 10)}</div>`;
  html += `</body></html>`;

  res.set('Content-Type', 'text/html');
  res.set('Content-Disposition', `inline; filename="${tournament.name.replace(/\s+/g,'_')}_boletin.html"`);
  res.send(html);
});

// GET /tournaments/:tid/trf — exportar TRF
router.get('/tournaments/:tid/trf', authenticate, (req, res) => {
  const db = getDb();
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  const players = buildPlayerState(db, req.params.tid);
  const closedRounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.tid);

  const rounds = closedRounds.map((r) => {
    const pairings = db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
    return {
      number: r.round_number,
      published: r.status !== 'pending',
      closed: r.status === 'closed',
      pairings: pairings.map((p) => ({
        board: p.board, whiteId: String(p.white_id), blackId: p.black_id ? String(p.black_id) : '',
        result: p.result, isBye: !!p.is_bye,
      })),
    };
  });

  const config = {
    name: tournament.name, city: tournament.city, federation: tournament.federation,
    startDate: tournament.start_date, endDate: tournament.end_date,
    timeControl: tournament.time_control, tournamentTypeCode: tournament.tournament_type ?? 'S',
    chiefArbiter: tournament.chief_arbiter, nRounds: tournament.n_rounds,
    tiebreaks: tournament.tiebreaks ? tournament.tiebreaks.split(',') : DEFAULT_TIEBREAK_ORDER,
    extendedType: `IND SWISS ${tournament.n_rounds}R`,
  };

  const trf = serializeTRF(config, players, rounds);
  res.set('Content-Type', 'text/plain');
  res.set('Content-Disposition', `attachment; filename="${tournament.name.replace(/\s+/g,'_')}.trf"`);
  res.send(trf);
});

export default router;

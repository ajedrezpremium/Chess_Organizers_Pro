import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { buildPlayerState } from '../utils/roundUtils.js';
import { perRoundChanges, rawDelta } from '../../src/services/ratingChange.js';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────

function resultPoints(r) {
  if (r === '1') return 1;
  if (r === '0') return 0;
  if (r === '=') return 0.5;
  return null;
}

// ── GET /stats/:tid/crosstab ──────────────────────────────────────
// Matriz jugador × ronda: { playerId, name, ... , rounds: [{ opponent, result, color }] }
router.get('/:tid/crosstab', authenticate, (req, res) => {
  try {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const players = buildPlayerState(db, req.params.tid);
    const rounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC").all(req.params.tid);

    const pairingsByRound = {};
    for (const r of rounds) {
      pairingsByRound[r.round_number] = db.prepare(
        'SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC'
      ).all(r.id);
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
          result: pairing.result,
          color: isWhite ? 'W' : 'B',
          board: pairing.board,
          isBye: !!pairing.is_bye,
        });
      }

      return {
        id: player.id,
        name: player.name,
        lastName: player.lastName,
        rating: player.fideRating,
        title: player.title,
        federation: player.country,
        points: totalPoints,
        rounds: roundData,
      };
    });

    // Ordenar por puntos descendente, luego rating
    matrix.sort((a, b) => b.points - a.points || (b.rating || 0) - (a.rating || 0));

    res.json({ tournament: tournament.name, nRounds: tournament.n_rounds, players: matrix });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stats/:tid/performance ──────────────────────────────────
// TPR (Tournament Performance Rating) + ΔR (Elo change estimate) + per-round delta
router.get('/:tid/performance', authenticate, (req, res) => {
  try {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const players = buildPlayerState(db, req.params.tid);
    const rounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.tid);
    const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

    // Enrich rounds with pairings
    for (const r of rounds) {
      r.pairings = db.prepare(
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
        const pts = resultPoints(pairing.result);
        if (pts === null) continue;
        totalPts += pts;
        totalGames++;
        if (opp && opp.fideRating > 0) oppRatings.push({ rating: opp.fideRating, result: pts });
      }

      let tpr = null;
      if (totalGames > 0 && oppRatings.length > 0) {
        const avgOpp = Math.round(oppRatings.reduce((s, o) => s + o.rating, 0) / oppRatings.length);
        const scorePct = totalPts / totalGames;
        tpr = Math.round(avgOpp + 800 * (scorePct - 0.5));
      }

      const pchg = chg[player.id] || { total: null, rounds: [], kFactor: 40 };

      return {
        id: player.id, name: player.name, lastName: player.lastName,
        rating: player.fideRating, title: player.title, federation: player.country,
        points: totalPts, games: totalGames, tpr,
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

// ── GET /stats/:tid/progression ──────────────────────────────────
// Progresión de puntos por ronda para cada jugador + heat map data
router.get('/:tid/progression', authenticate, (req, res) => {
  try {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const players = buildPlayerState(db, req.params.tid);
    const rounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC").all(req.params.tid);
    const pairingsByRound = {};
    for (const r of rounds) {
      pairingsByRound[r.round_number] = db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
    }

    const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

    const progression = players.map((player) => {
      let cumulative = 0;
      const byRound = [];
      const heatColors = [];

      for (let rn = 1; rn <= tournament.n_rounds; rn++) {
        const pbs = pairingsByRound[rn] || [];
        const pairing = pbs.find((pb) => String(pb.white_id) === player.id || String(pb.black_id) === player.id);
        if (!pairing || pairing.result === '-') {
          byRound.push(cumulative);
          heatColors.push('pending');
          continue;
        }
        const isWhite = String(pairing.white_id) === player.id;
        const pts = pairing.is_bye ? 0.5 : resultPoints(pairing.result);
        const absPts = pts !== null ? (isWhite ? pts : (pts === 1 ? 0 : pts === 0 ? 1 : 0.5)) : 0;
        cumulative += absPts;
        byRound.push(cumulative);
        if (pairing.is_bye) heatColors.push('bye');
        else if (pairing.result === '=') heatColors.push('draw');
        else if ((isWhite && pairing.result === '1') || (!isWhite && pairing.result === '0')) heatColors.push('win');
        else if ((isWhite && pairing.result === '0') || (!isWhite && pairing.result === '1')) heatColors.push('loss');
        else heatColors.push('pending');
      }

      return {
        id: player.id, name: player.name, lastName: player.lastName,
        title: player.title, rating: player.fideRating,
        points: cumulative, byRound, heatColors, colorHistory: player.colorHistory,
      };
    });

    progression.sort((a, b) => b.points - a.points || (b.rating || 0) - (a.rating || 0));

    res.json({ nRounds: tournament.n_rounds, progression });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stats/:tid/head-to-head ─────────────────────────────────
router.get('/:tid/head-to-head', authenticate, (req, res) => {
  try {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const { p1, p2 } = req.query;
    if (!p1 || !p2) return res.status(400).json({ error: 'Se requieren p1 y p2 (player IDs)' });

    const players = buildPlayerState(db, req.params.tid);
    const rounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC").all(req.params.tid);

    const encounters = [];
    for (const r of rounds) {
      const pairings = db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
      const pairing = pairings.find((pb) => {
        const w = String(pb.white_id), bl = String(pb.black_id);
        return (w === p1 && bl === p2) || (w === p2 && bl === p1);
      });
      if (pairing) {
        const isWhiteP1 = String(pairing.white_id) === p1;
        encounters.push({
          round: r.round_number,
          board: pairing.board,
          p1Color: isWhiteP1 ? 'W' : 'B',
          result: pairing.result,
          isBye: !!pairing.is_bye,
        });
      }
    }

    const p1Data = players.find((p) => p.id === p1);
    const p2Data = players.find((p) => p.id === p2);

    res.json({
      player1: p1Data ? { id: p1Data.id, name: p1Data.name, lastName: p1Data.lastName, rating: p1Data.fideRating } : null,
      player2: p2Data ? { id: p2Data.id, name: p2Data.name, lastName: p2Data.lastName, rating: p2Data.fideRating } : null,
      encounters,
      totalEncounters: encounters.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stats/:tid/overview ──────────────────────────────────────
// Estadísticas generales del torneo
router.get('/:tid/overview', authenticate, (req, res) => {
  try {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const players = buildPlayerState(db, req.params.tid);
    const closedRounds = db.prepare("SELECT COUNT(*) as c FROM rounds WHERE tournament_id = ? AND status = 'closed'").get(req.params.tid).c;
    const totalRounds = tournament.n_rounds;

    // Federaciones
    const fedCount = {};
    for (const p of players) {
      const fed = p.country || '---';
      fedCount[fed] = (fedCount[fed] || 0) + 1;
    }
    const federations = Object.entries(fedCount)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    // Rating distribution
    const ratingRanges = [
      { label: '2700+', min: 2700 }, { label: '2600-2699', min: 2600, max: 2699 },
      { label: '2500-2599', min: 2500, max: 2599 }, { label: '2400-2499', min: 2400, max: 2499 },
      { label: '2300-2399', min: 2300, max: 2399 }, { label: '2200-2299', min: 2200, max: 2299 },
      { label: '<2200', max: 2199 },
    ];
    const ratingDist = ratingRanges.map((r) => ({
      ...r,
      count: players.filter((p) => p.fideRating > 0 &&
        (r.min === undefined || p.fideRating >= r.min) &&
        (r.max === undefined || p.fideRating <= r.max)).length,
    }));

    // Títulos
    const titleCount = {};
    for (const p of players) {
      const t = p.title || '-';
      titleCount[t] = (titleCount[t] || 0) + 1;
    }

    // Resultados por ronda
    const roundResults = [];
    for (let rn = 1; rn <= totalRounds; rn++) {
      const round = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND round_number = ?").get(req.params.tid, rn);
      if (!round) { roundResults.push({ round: rn, status: 'pending', whiteWins: 0, draws: 0, blackWins: 0, byes: 0, total: 0, whitePct: 0, drawPct: 0, blackPct: 0 }); continue; }
      const pairings = db.prepare('SELECT * FROM pairings WHERE round_id = ?').all(round.id);
      const stats = { whiteWins: 0, draws: 0, blackWins: 0, byes: 0 };
      for (const p of pairings) {
        if (p.is_bye) { stats.byes++; continue; }
        if (p.result === '1') stats.whiteWins++;
        else if (p.result === '0') stats.blackWins++;
        else if (p.result === '=') stats.draws++;
      }
      const total = stats.whiteWins + stats.draws + stats.blackWins;
      roundResults.push({
        round: rn, status: round.status, ...stats, total,
        whitePct: total > 0 ? Math.round(stats.whiteWins / total * 100) : 0,
        drawPct: total > 0 ? Math.round(stats.draws / total * 100) : 0,
        blackPct: total > 0 ? Math.round(stats.blackWins / total * 100) : 0,
      });
    }

    // Performance por color
    const colorPerf = players.map((player) => {
      let wGames = 0, wPts = 0, bGames = 0, bPts = 0;
      for (let rn = 1; rn <= totalRounds; rn++) {
        const round = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND round_number = ?").get(req.params.tid, rn);
        if (!round) continue;
        const pairings = db.prepare('SELECT * FROM pairings WHERE round_id = ?').all(round.id);
        const pairing = pairings.find((pb) => String(pb.white_id) === player.id || String(pb.black_id) === player.id);
        if (!pairing || pairing.result === '-' || pairing.is_bye) continue;
        const isWhite = String(pairing.white_id) === player.id;
        if (isWhite) { wGames++; if (pairing.result === '1') wPts += 1; else if (pairing.result === '=') wPts += 0.5; }
        else { bGames++; if (pairing.result === '0') bPts += 1; else if (pairing.result === '=') bPts += 0.5; }
      }
      return {
        id: player.id, name: player.name, lastName: player.lastName,
        title: player.title, rating: player.fideRating,
        white: { games: wGames, points: wPts, pct: wGames > 0 ? Math.round(wPts / wGames * 100) : 0 },
        black: { games: bGames, points: bPts, pct: bGames > 0 ? Math.round(bPts / bGames * 100) : 0 },
      };
    }).filter((p) => p.white.games > 0 || p.black.games > 0);
    colorPerf.sort((a, b) => (b.white.pct + b.black.pct) - (a.white.pct + a.black.pct));

    // Totals acumulados
    const totals = roundResults.reduce((acc, r) => {
      acc.whiteWins += r.whiteWins; acc.draws += r.draws; acc.blackWins += r.blackWins; acc.byes += r.byes;
      return acc;
    }, { whiteWins: 0, draws: 0, blackWins: 0, byes: 0 });
    const totalGames = totals.whiteWins + totals.draws + totals.blackWins;
    totals.whitePct = totalGames > 0 ? Math.round(totals.whiteWins / totalGames * 100) : 0;
    totals.drawPct = totalGames > 0 ? Math.round(totals.draws / totalGames * 100) : 0;
    totals.blackPct = totalGames > 0 ? Math.round(totals.blackWins / totalGames * 100) : 0;

    res.json({
      name: tournament.name, system: tournament.system,
      totalPlayers: players.length,
      closedRounds, totalRounds,
      federations,
      ratingDist,
      titles: Object.entries(titleCount).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count),
      roundResults,
      colorPerformance: colorPerf,
      totals,
      avgRating: players.length > 0
        ? Math.round(players.reduce((s, p) => s + (p.fideRating || 0), 0) / players.length)
        : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stats/:tid/rating-report ────────────────────────────────
// FIDE Rating Report (JSON + XML descargable)
router.get('/:tid/rating-report', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const ratingReport = await import('../services/ratingReport.js');
    const report = ratingReport.generateRatingReport(req.params.tid);

    if (req.query.format === 'xml') {
      const xml = ratingReport.generateRatingXML(report);
      res.set('Content-Type', 'application/xml');
      res.set('Content-Disposition', `attachment; filename="fide-rating-report-${req.params.tid}.xml"`);
      return res.send(xml);
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

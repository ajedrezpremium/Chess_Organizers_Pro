/**
 * ratingReport.js — Genera el Reporte de Rating FIDE
 *
 * Formato oficial para envío a FIDE (Rating Regulations C.02).
 * Incluye: datos del torneo, lista de jugadores con resultados,
 * cálculo de rating performance y cambio de rating.
 */

import { getDb } from '../db/index.js';

function resultPoints(r) {
  if (r === '1') return 1;
  if (r === '0') return 0;
  if (r === '=') return 0.5;
  return null;
}

/**
 * Genera el reporte completo de rating FIDE
 * @param {number} tournamentId
 * @returns {Object} Reporte estructurado
 */
export function generateRatingReport(tournamentId) {
  const db = getDb();
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) throw new Error('Torneo no encontrado');

  const players = db.prepare(`
    SELECT p.*, tp.seed_rank FROM players p
    JOIN tournament_players tp ON tp.player_id = p.id
    WHERE tp.tournament_id = ?
    ORDER BY tp.seed_rank ASC
  `).all(tournamentId);

  const rounds = db.prepare(`SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC`).all(tournamentId);

  const pairingsByRound = {};
  for (const r of rounds) {
    pairingsByRound[r.round_number] = db.prepare(`SELECT p.*, pl.fide_rating as opp_rating FROM pairings p
      LEFT JOIN players pl ON pl.id = CASE WHEN p.white_id = ? THEN p.black_id ELSE p.white_id END
      WHERE p.round_id = ?`).all(tournamentId, r.id);
  }

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  const playerResults = players.map((player) => {
    let totalScore = 0;
    let totalGames = 0;
    const opponents = [];
    let totalOppRating = 0;
    let ratedOpponents = 0;

    for (let rn = 1; rn <= tournament.n_rounds; rn++) {
      const pbs = pairingsByRound[rn] || [];
      const pairing = pbs.find((pb) => String(pb.white_id) === player.id || String(pb.black_id) === player.id);
      if (!pairing || pairing.result === '-') continue;

      const isWhite = String(pairing.white_id) === player.id;
      const oppId = isWhite ? String(pairing.black_id) : String(pairing.white_id);
      const opp = playerMap[oppId];
      const pts = pairing.is_bye ? null : resultPoints(pairing.result);
      const score = isWhite ? pairing.result === '1' ? 1 : pairing.result === '0' ? 0 : pairing.result === '=' ? 0.5 : null
                   : pairing.result === '0' ? 1 : pairing.result === '1' ? 0 : pairing.result === '=' ? 0.5 : null;

      if (pts !== null) {
        totalScore += pts;
        totalGames++;
      }

      if (opp && opp.fide_rating > 0 && !pairing.is_bye) {
        const actualScore = isWhite
          ? (pairing.result === '1' ? 1 : pairing.result === '0' ? 0 : 0.5)
          : (pairing.result === '0' ? 1 : pairing.result === '1' ? 0 : 0.5);
        ratedOpponents++;
        totalOppRating += opp.fide_rating;
        opponents.push({
          opponentId: opp.id,
          opponentName: `${opp.name} ${opp.last_name || ''}`.trim(),
          opponentRating: opp.fide_rating,
          result: pairing.result,
          color: isWhite ? 'W' : 'B',
          round: rn,
          score: actualScore,
        });
      }
    }

    const avgOppRating = ratedOpponents > 0 ? Math.round(totalOppRating / ratedOpponents) : 0;
    const scorePct = totalGames > 0 ? totalScore / totalGames : 0;
    const tpr = ratedOpponents > 0 ? Math.round(avgOppRating + 800 * (scorePct - 0.5)) : null;

    const K = player.fide_rating < 2100 ? 40 : player.fide_rating < 2400 ? 20 : 10;
    let expectedScore = 0;
    for (const o of opponents) {
      expectedScore += 1 / (1 + Math.pow(10, (o.opponentRating - player.fide_rating) / 400));
    }
    const ratingChg = ratedOpponents > 0 ? Math.round(K * (totalScore - expectedScore)) : 0;

    return {
      fideId: player.fide_id || '',
      name: player.name,
      lastName: player.last_name || '',
      title: player.title || '',
      federation: player.country || '',
      birthYear: player.birth_year || '',
      rating: player.fide_rating || 0,
      seed: player.seed_rank || 0,
      totalScore,
      totalGames,
      tpr,
      ratingChg,
      opponents,
    };
  });

  playerResults.sort((a, b) => b.totalScore - a.totalScore || (b.rating || 0) - (a.rating || 0));

  const closedRounds = rounds.filter((r) => r.status === 'closed').length;
  const hasFideIds = playerResults.some((p) => p.fideId);

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      federation: tournament.federation || '',
      city: tournament.city || '',
      system: tournament.system,
      startDate: tournament.start_date || '',
      endDate: tournament.end_date || '',
      nRounds: tournament.n_rounds,
      closedRounds,
      director: tournament.chief_arbiter || '',
      deputy: tournament.deputy_arbiter || '',
    },
    summary: {
      totalPlayers: players.length,
      totalRated: playerResults.filter((p) => p.rating > 0).length,
      totalWithFideId: playerResults.filter((p) => p.fideId).length,
      hasFideIds,
      averageRating: players.length > 0
        ? Math.round(players.reduce((s, p) => s + (p.fide_rating || 0), 0) / players.length)
        : 0,
    },
    players: playerResults,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Genera XML en formato FIDE (borrador estándar)
 */
export function generateRatingXML(report) {
  const { tournament, players } = report;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<FIDERatingReport>\n`;
  xml += `  <Tournament>\n`;
  xml += `    <Name>${escXml(tournament.name)}</Name>\n`;
  xml += `    <Federation>${escXml(tournament.federation)}</Federation>\n`;
  xml += `    <City>${escXml(tournament.city)}</City>\n`;
  xml += `    <System>${tournament.system}</System>\n`;
  xml += `    <Rounds>${tournament.nRounds}</Rounds>\n`;
  xml += `    <StartDate>${tournament.startDate}</StartDate>\n`;
  xml += `    <EndDate>${tournament.endDate}</EndDate>\n`;
  xml += `    <ChiefArbiter>${escXml(tournament.director)}</ChiefArbiter>\n`;
  xml += `  </Tournament>\n`;
  xml += `  <Players>\n`;

  for (const p of players) {
    xml += `    <Player>\n`;
    xml += `      <FIDEID>${escXml(p.fideId)}</FIDEID>\n`;
    xml += `      <Name>${escXml(p.name)}</Name>\n`;
    xml += `      <LastName>${escXml(p.lastName)}</LastName>\n`;
    xml += `      <Title>${escXml(p.title)}</Title>\n`;
    xml += `      <Federation>${escXml(p.federation)}</Federation>\n`;
    xml += `      <BirthYear>${p.birthYear}</BirthYear>\n`;
    xml += `      <Rating>${p.rating}</Rating>\n`;
    xml += `      <Seed>${p.seed}</Seed>\n`;
    xml += `      <Score>${p.totalScore}</Score>\n`;
    xml += `      <Games>${p.totalGames}</Games>\n`;
    xml += `      <TPR>${p.tpr ?? ''}</TPR>\n`;
    xml += `      <RatingChange>${p.ratingChg}</RatingChange>\n`;
    xml += `    </Player>\n`;
  }

  xml += `  </Players>\n`;
  xml += `</FIDERatingReport>\n`;
  return xml;
}

function escXml(s) {
  if (!s) return '';
  return String(s).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Cálculo de rating FIDE — conforme al reglamento FIDE Handbook (Tablas 8.1a, 8.1b)
 *
 * Referencia: https://handbook.fide.com/chapter/B022024
 */

// ── K-Factor (Regla FIDE completa) ──────────────────────────────────
export function getKFactor(rating, gamesPlayed, birthDate) {
  // Jugadores nuevos: K = 40 hasta completar 26 partidas
  if (gamesPlayed < 26) return 40;

  // Menores de 18 años: K = 40 hasta 30 partidas, luego K = 20
  if (birthDate) {
    const age = new Date().getFullYear() - new Date(birthDate).getFullYear();
    if (age < 18 && gamesPlayed < 30) return 40;
  }

  // Rating >= 2400: K = 10
  if (rating >= 2400) return 10;

  // Rating < 2400: K = 20
  return 20;
}

// ── Probabilidad esperada (fórmula Elo) ────────────────────────────
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// ── Delta por partida ─────────────────────────────────────────────
function rawDelta(ratingA, ratingB, score) {
  if (ratingA === 0 || ratingB === 0) return 0;
  const we = expectedScore(ratingA, ratingB);
  return score - we;
}

// ── dp (diferencia de rating desde porcentaje) — inverso de expectedScore
export function dpFromScore(score, total) {
  if (total === 0) return 0;
  const p = score / total;
  if (p >= 1) return 800;
  if (p <= 0) return -800;
  const dp = -400 * Math.log10(1 / p - 1);
  // Evitar -0
  return Object.is(dp, -0) ? 0 : Math.round(dp * 100) / 100;
}

// ── TPR (Tournament Performance Rating) — fórmula oficial FIDE
export function calculateTPR(playerRating, opponents, scores) {
  if (opponents.length === 0 || scores.length === 0) return null;

  // Filtrar oponentes sin rating
  const valid = [];
  for (let i = 0; i < opponents.length; i++) {
    if (opponents[i] && opponents[i] > 0) {
      valid.push({ rating: opponents[i], score: scores[i] || 0 });
    }
  }
  if (valid.length === 0) return null;

  const avgOpp = Math.round(valid.reduce((s, o) => s + o.rating, 0) / valid.length);
  const totalScore = valid.reduce((s, o) => s + o.score, 0);
  const dp = dpFromScore(totalScore, valid.length);

  return Math.round(avgOpp + dp);
}

// ── calculateRatingChanges (compatibilidad con API existente) ──────
export function calculateRatingChanges(players, pairings) {
  const results = {};
  for (const p of players) {
    let delta = 0;
    let count = 0;
    for (const pair of pairings) {
      if (String(pair.white_id) === p.id || String(pair.black_id) === p.id) {
        const isWhite = String(pair.white_id) === p.id;
        const opp = players.find((x) => x.id === (isWhite ? String(pair.black_id) : String(pair.white_id)));
        if (!opp) continue;
        let score = 0;
        if (pair.result === '1') score = isWhite ? 1 : 0;
        else if (pair.result === '=') score = 0.5;
        else if (pair.result === '0') score = isWhite ? 0 : 1;
        else continue;
        delta += rawDelta(p.fideRating, opp.fideRating, score);
        count++;
      }
    }
    const k = getKFactor(p.fideRating, count, p.birthDate);
    results[p.id] = Math.round(delta * k * 10) / 10;
  }
  return results;
}

// ── Cambio de rating total para un torneo (FIDE exacto) ────────────
export function totalRatingChange(player, opponents, results) {
  let totalDelta = 0;
  let gamesPlayed = 0;

  for (let i = 0; i < opponents.length; i++) {
    if (!opponents[i]) continue;
    const oppRating = opponents[i].fideRating ?? 0;
    if (oppRating === 0 || player.fideRating === 0) continue;
    let score = 0;
    if (results[i] === '1') score = 1;
    else if (results[i] === '=') score = 0.5;
    else if (results[i] === '0') score = 0;
    else continue;
    totalDelta += rawDelta(player.fideRating, oppRating, score);
    gamesPlayed++;
  }

  if (gamesPlayed === 0) return 0;

  const k = getKFactor(player.fideRating, gamesPlayed, player.birthDate);
  const change = Math.round(totalDelta * k * 10) / 10;

  // Rating floor: mínimo 1400 para rating FIDE estándar
  const newRating = player.fideRating + change;
  if (newRating < 1400 && player.fideRating >= 1400) {
    return 1400 - player.fideRating;
  }

  return change;
}

function mapResult(result, isWhite) {
  if (result === '-') return null;
  const whiteScore = result === '1' ? 1 : result === '=' ? 0.5 : result === '0' ? 0 : null;
  if (whiteScore === null) return null;
  return isWhite ? whiteScore : 1 - whiteScore;
}

// ── Cambios por ronda (para visualización) ─────────────────────────
export function perRoundChanges(players, rounds) {
  const results = {};

  for (const p of players) {
    results[p.id] = { rounds: [], kFactor: 40, opponentRatings: [], scores: [] };
  }

  for (const r of rounds) {
    const pairings = r.pairings || [];
    for (const p of pairings) {
      if (p.is_bye) {
        if (p.white_id && results[p.white_id]) {
          results[p.white_id].rounds.push(0);
        }
        continue;
      }
      if (p.white_id && p.black_id && results[p.white_id] && results[p.black_id]) {
        const wScore = mapResult(p.result, true);
        if (wScore !== null) {
          const wr = p.white_rating || 0;
          const br = p.black_rating || 0;
          const wDelta = rawDelta(wr, br, wScore);
          const bDelta = rawDelta(br, wr, 1 - wScore);
          results[p.white_id].rounds.push(wDelta);
          results[p.black_id].rounds.push(bDelta);
          results[p.white_id].opponentRatings.push(br);
          results[p.black_id].opponentRatings.push(wr);
          results[p.white_id].scores.push(wScore);
          results[p.black_id].scores.push(1 - wScore);
        } else {
          results[p.white_id].rounds.push(null);
          results[p.black_id].rounds.push(null);
        }
      }
    }

    for (const p of players) {
      if (results[p.id].rounds.length < r.round_number) {
        results[p.id].rounds.push(null);
      }
    }
  }

  for (const p of players) {
    const played = results[p.id].rounds.filter((v) => v !== null).length;
    results[p.id].kFactor = getKFactor(p.fideRating, played, p.birthDate);
    results[p.id].total = Math.round(
      results[p.id].rounds.reduce((s, v) => s + (v || 0), 0) * results[p.id].kFactor * 10
    ) / 10;

    // TPR
    results[p.id].tpr = calculateTPR(
      p.fideRating,
      results[p.id].opponentRatings,
      results[p.id].scores
    );
  }

  return results;
}

export { rawDelta, rawDelta as ratingChange };

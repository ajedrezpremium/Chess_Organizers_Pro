/**
 * tiebreaks.js
 *
 * Cálculo de todos los desempates obligatorios según FIDE Handbook C.04
 * y el documento "Mandatory Tie-Breaks" del TRF-2025.
 *
 * Sin dependencias externas. Puro JS.
 * Testeable de forma aislada con cualquier runner (Jest, Node assert…).
 */

import { Tiebreak, Result, RESULT_POINTS } from './types.js';

// ── Utilidades internas ───────────────────────────────────────────────────────

/**
 * Devuelve los puntos de un jugador en una ronda concreta.
 * Necesario para Buchholz virtual (rondas no jugadas = 0.5).
 */
function pointsInRound(player, roundIndex) {
  const pairing = player._roundPairings?.[roundIndex];
  if (!pairing) return 0;
  if (pairing.isBye) return RESULT_POINTS[pairing.result] ?? 0.5;
  if (pairing.whiteId === player.id) return RESULT_POINTS[pairing.result] ?? 0;
  if (pairing.blackId === player.id) {
    if (pairing.result === Result.WHITE_WIN)  return 0;
    if (pairing.result === Result.BLACK_WIN)  return 1;
    if (pairing.result === Result.DRAW)       return 0.5;
  }
  return 0;
}

/**
 * Score virtual de un rival: si un rival se retiró o no jugó todas las rondas,
 * FIDE sustituye sus puntos faltantes por el promedio de los puntos que sí obtuvo.
 * (Regla del Buchholz virtual — C.04.3 §13.15)
 */
function virtualScore(player, totalRounds) {
  if (!player) return 0;
  const roundsPlayed = player._roundPairings?.filter(Boolean).length ?? 0;
  if (roundsPlayed === 0) return player.points ?? 0;
  const avg = (player.points ?? 0) / roundsPlayed;
  return (player.points ?? 0) + avg * (totalRounds - roundsPlayed);
}

// ── Buchholz ──────────────────────────────────────────────────────────────────

/**
 * Buchholz completo: suma de los puntos virtuales de todos los rivales.
 */
export function buchholz(player, playersById, totalRounds) {
  return (player.opponents ?? []).reduce((sum, oppId) => {
    const opp = playersById[oppId];
    return sum + virtualScore(opp, totalRounds);
  }, 0);
}

/**
 * Buchholz con N recortes inferiores (elimina los N peores resultados de rivales).
 */
export function buchholzCut(player, playersById, totalRounds, cut = 1) {
  const scores = (player.opponents ?? [])
    .map((id) => virtualScore(playersById[id], totalRounds))
    .sort((a, b) => a - b); // ascendente — los peores primero
  return scores.slice(cut).reduce((s, v) => s + v, 0);
}

/**
 * Buchholz mediano: recorta el mejor Y el peor rival.
 */
export function medianBuchholz(player, playersById, totalRounds) {
  const scores = (player.opponents ?? [])
    .map((id) => virtualScore(playersById[id], totalRounds))
    .sort((a, b) => a - b);
  if (scores.length <= 2) return scores.reduce((s, v) => s + v, 0);
  return scores.slice(1, -1).reduce((s, v) => s + v, 0);
}

// ── Sonneborn-Berger ──────────────────────────────────────────────────────────

/**
 * Sonneborn-Berger: por cada rival derrotado suma sus puntos enteros;
 * por cada rival empatado suma la mitad de sus puntos.
 */
export function sonnebornBerger(player, playersById, totalRounds) {
  let sb = 0;
  const pairings = player._roundPairings ?? [];

  for (const pairing of pairings) {
    if (!pairing) continue;
    let personalResult, oppId;

    if (pairing.whiteId === player.id) {
      oppId = pairing.blackId;
      personalResult = pairing.result === Result.WHITE_WIN ? 1
        : pairing.result === Result.DRAW ? 0.5 : 0;
    } else {
      oppId = pairing.whiteId;
      personalResult = pairing.result === Result.BLACK_WIN ? 1
        : pairing.result === Result.DRAW ? 0.5 : 0;
    }

    const opp = playersById[oppId];
    if (!opp) continue;
    sb += personalResult * virtualScore(opp, totalRounds);
  }
  return sb;
}

// ── Average Rating of Opponents (ARO) ────────────────────────────────────────

export function aro(player, playersById, cut = 0) {
  const ratings = (player.opponents ?? [])
    .map((id) => playersById[id]?.fideRating ?? 0)
    .filter((r) => r > 0)
    .sort((a, b) => a - b);

  const trimmed = ratings.slice(cut);
  if (trimmed.length === 0) return 0;
  return trimmed.reduce((s, r) => s + r, 0) / trimmed.length;
}

// ── Encuentro directo ─────────────────────────────────────────────────────────

/**
 * Puntos obtenidos contra los demás jugadores empatados en la clasificación.
 * Requiere el subconjunto `tiedPlayerIds` como contexto.
 */
export function directEncounter(player, playersById, tiedPlayerIds) {
  const tiedSet = new Set(tiedPlayerIds);
  let points = 0;
  const pairings = player._roundPairings ?? [];

  for (const pairing of pairings) {
    if (!pairing) continue;
    const isWhite = pairing.whiteId === player.id;
    const oppId   = isWhite ? pairing.blackId : pairing.whiteId;

    if (!tiedSet.has(oppId)) continue;

    if (isWhite) {
      if (pairing.result === Result.WHITE_WIN) points += 1;
      if (pairing.result === Result.DRAW)      points += 0.5;
    } else {
      if (pairing.result === Result.BLACK_WIN) points += 1;
      if (pairing.result === Result.DRAW)      points += 0.5;
    }
  }
  return points;
}

// ── Puntuación progresiva ─────────────────────────────────────────────────────

/**
 * Suma de los puntos acumulados al final de cada ronda.
 * Un jugador con 1-0.5-1-1 tiene progresiva = 1+1.5+2.5+3.5 = 8.5
 */
export function progressive(player) {
  let cumulative = 0;
  let total = 0;
  const pairings = player._roundPairings ?? [];

  for (const pairing of pairings) {
    if (!pairing) {
      total += cumulative;
      continue;
    }
    const isWhite = pairing.whiteId === player.id;
    let pts = 0;
    if (pairing.isBye) {
      pts = RESULT_POINTS[pairing.result] ?? 0.5;
    } else if (isWhite) {
      pts = RESULT_POINTS[pairing.result] ?? 0;
    } else {
      if (pairing.result === Result.WHITE_WIN)  pts = 0;
      else if (pairing.result === Result.BLACK_WIN) pts = 1;
      else if (pairing.result === Result.DRAW)  pts = 0.5;
    }
    cumulative += pts;
    total      += cumulative;
  }
  return total;
}

// ── Victorias ─────────────────────────────────────────────────────────────────

export function wins(player) {
  return (player._roundPairings ?? []).filter((p) => {
    if (!p) return false;
    if (p.isBye && p.result === Result.FULL_BYE) return true;
    if (p.whiteId === player.id && p.result === Result.WHITE_WIN) return true;
    if (p.blackId === player.id && p.result === Result.BLACK_WIN) return true;
    return false;
  }).length;
}

export function winsWithBlack(player) {
  return (player._roundPairings ?? []).filter(
    (p) => p && p.blackId === player.id && p.result === Result.BLACK_WIN
  ).length;
}

export function gamesWithBlack(player) {
  return (player._roundPairings ?? []).filter(
    (p) => p && p.blackId === player.id && !p.isBye
  ).length;
}

// ── Rating Performance ────────────────────────────────────────────────────────

/**
 * Rendimiento ELO según tabla FIDE.
 * Performance = promedio ELO de rivales ± ajuste por porcentaje de puntos.
 */
export function ratingPerformance(player, playersById) {
  const opponents = (player.opponents ?? []).map((id) => playersById[id]).filter(Boolean);
  if (opponents.length === 0) return player.fideRating ?? 0;

  const avgOppRating = opponents.reduce((s, o) => s + (o.fideRating ?? 0), 0) / opponents.length;
  const percentage   = opponents.length > 0
    ? (player.points ?? 0) / opponents.length
    : 0.5;

  // Tabla FIDE de conversión porcentaje → diferencia (simplificada)
  const DP = fidePerformanceDelta(percentage);
  return Math.round(avgOppRating + DP);
}

/**
 * Conversión de porcentaje de puntos a diferencia de ELO (tabla FIDE C.02).
 * Interpolación lineal entre los valores de la tabla oficial.
 */
function fidePerformanceDelta(pct) {
  // [porcentaje, delta]
  const TABLE = [
    [1.00, 800], [0.99, 677], [0.98, 589], [0.97, 538], [0.96, 501],
    [0.95, 470], [0.94, 444], [0.93, 422], [0.92, 401], [0.91, 383],
    [0.90, 366], [0.89, 351], [0.88, 336], [0.87, 322], [0.86, 309],
    [0.85, 296], [0.84, 284], [0.83, 273], [0.82, 262], [0.81, 251],
    [0.80, 240], [0.75, 198], [0.70, 149], [0.65, 102], [0.60,  57],
    [0.55,  14], [0.50,   0], [0.45, -14], [0.40, -57], [0.35,-102],
    [0.30,-149], [0.25,-198], [0.20,-240], [0.15,-296], [0.10,-366],
    [0.05,-470], [0.01,-677], [0.00,-800],
  ];
  for (let i = 0; i < TABLE.length - 1; i++) {
    const [p1, d1] = TABLE[i];
    const [p2, d2] = TABLE[i + 1];
    if (pct >= p2 && pct <= p1) {
      const t = (pct - p2) / (p1 - p2);
      return Math.round(d2 + t * (d1 - d2));
    }
  }
  return pct >= 0.5 ? 800 : -800;
}

// ── Koya ──────────────────────────────────────────────────────────────────────

/**
 * Sistema Koya: puntos obtenidos contra los jugadores que alcanzaron
 * al menos el 50% de los puntos posibles.
 */
export function koya(player, playersById, totalRounds) {
  const threshold = totalRounds / 2;
  let score = 0;
  const pairings = player._roundPairings ?? [];

  for (const pairing of pairings) {
    if (!pairing || pairing.isBye) continue;
    const isWhite = pairing.whiteId === player.id;
    const oppId   = isWhite ? pairing.blackId : pairing.whiteId;
    const opp     = playersById[oppId];

    if (!opp || (opp.points ?? 0) < threshold) continue;

    if (isWhite) {
      if (pairing.result === Result.WHITE_WIN) score += 1;
      if (pairing.result === Result.DRAW)      score += 0.5;
    } else {
      if (pairing.result === Result.BLACK_WIN) score += 1;
      if (pairing.result === Result.DRAW)      score += 0.5;
    }
  }
  return score;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Calcula el valor de un desempate dado para un jugador.
 * Punto de entrada para el comparador de standings.
 *
 * @param {string}   tiebreak      — Valor de Tiebreak enum
 * @param {Player}   player
 * @param {Object}   playersById   — Mapa id → Player
 * @param {number}   totalRounds
 * @param {string[]} [tiedIds]     — Para directEncounter
 */
export function calculateTiebreak(tiebreak, player, playersById, totalRounds, tiedIds = []) {
  switch (tiebreak) {
    case Tiebreak.BUCHHOLZ:           return buchholz(player, playersById, totalRounds);
    case Tiebreak.BUCHHOLZ_CUT1:      return buchholzCut(player, playersById, totalRounds, 1);
    case Tiebreak.BUCHHOLZ_CUT2:      return buchholzCut(player, playersById, totalRounds, 2);
    case Tiebreak.MEDIAN_BUCHHOLZ:    return medianBuchholz(player, playersById, totalRounds);
    case Tiebreak.SONNEBORN_BERGER:   return sonnebornBerger(player, playersById, totalRounds);
    case Tiebreak.ARO:                return aro(player, playersById, 0);
    case Tiebreak.ARO_CUT1:           return aro(player, playersById, 1);
    case Tiebreak.DIRECT_ENCOUNTER:   return directEncounter(player, playersById, tiedIds);
    case Tiebreak.PROGRESSIVE:        return progressive(player);
    case Tiebreak.WINS:               return wins(player);
    case Tiebreak.WINS_WITH_BLACK:    return winsWithBlack(player);
    case Tiebreak.GAMES_WITH_BLACK:   return gamesWithBlack(player);
    case Tiebreak.RATING_PERFORMANCE: return ratingPerformance(player, playersById);
    case Tiebreak.KOYA:               return koya(player, playersById, totalRounds);
    default:
      console.warn(`[tiebreaks] Desempate desconocido: ${tiebreak}`);
      return 0;
  }
}

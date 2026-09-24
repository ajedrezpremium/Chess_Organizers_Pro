/**
 * tiebreaks.js
 *
 * Cálculo de todos los desempates obligatorios según FIDE Handbook C.04
 * y el documento "Mandatory Tie-Breaks" del TRF-2025.
 *
 * Sin dependencias externas. Puro JS.
 * Testeable de forma aislada con cualquier runner (Jest, Node assert…).
 */

import { Tiebreak, Result, RESULT_POINTS, RESULT_POINTS_BLACK } from './types.js';

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
    // Usar tabla BLACK para cubrir inusuales (A/B/C) y forfeits correctamente
    if (pairing.result in RESULT_POINTS_BLACK) return RESULT_POINTS_BLACK[pairing.result] ?? 0;
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
      personalResult = RESULT_POINTS[pairing.result] ?? 0;
      // Forfeits cuentan como victoria completa en SB (C.07); inusuales como 0.5/0
    } else {
      oppId = pairing.whiteId;
      personalResult = RESULT_POINTS_BLACK[pairing.result] ??
        (pairing.result === Result.BLACK_WIN ? 1
          : pairing.result === Result.DRAW ? 0.5 : 0);
    }

    const opp = playersById[oppId];
    if (!opp) continue;
    sb += personalResult * virtualScore(opp, totalRounds);
  }
  return sb;
}

// ── Ratings: soporte torneos >30 días (múltiples listas mensuales por ronda) ──
// Un jugador puede traer: fideRating (base), ratingsByRound: number[],
// ratingHistory: { [roundNumber]: number } o ratingsMonthly: number[].
// getEffectiveRating resuelve el rating aplicable a una ronda concreta (1-based).
export function getEffectiveRating(player, roundNumber = 1) {
  if (!player) return 0;
  if (Array.isArray(player.ratingsByRound) && player.ratingsByRound.length) {
    const v = player.ratingsByRound[Math.min(roundNumber - 1, player.ratingsByRound.length - 1)];
    if (Number.isFinite(v) && v > 0) return v;
  }
  if (player.ratingHistory && Number.isFinite(player.ratingHistory[roundNumber])) {
    return player.ratingHistory[roundNumber];
  }
  if (Array.isArray(player.ratingsMonthly) && player.ratingsMonthly.length) {
    // Aproximación: una lista mensual ≈ 4 rondas; redondear por bloque
    const idx = Math.min(Math.floor((roundNumber - 1) / 4), player.ratingsMonthly.length - 1);
    const v = player.ratingsMonthly[idx];
    if (Number.isFinite(v) && v > 0) return v;
  }
  return player.fideRating ?? 0;
}

// ── Average Rating of Opponents (ARO) ────────────────────────────────────────
// opts.unrated: 'exclude' (defecto C.07) | 'zero' | 'floor1400'
//   - exclude: ignora rivales sin elo (0) en el promedio
//   - zero: los cuenta como 0
//   - floor1400: aplica suelo FIDE 1400 (Marzo 2024) a unrated
export function aro(player, playersById, cut = 0, opts = {}) {
  const unrated = opts.unrated ?? 'exclude';
  let ratings = (player.opponents ?? [])
    .map((id, idx) => getEffectiveRating(playersById[id], idx + 1));

  if (unrated === 'exclude') ratings = ratings.filter((r) => r > 0);
  else if (unrated === 'floor1400') ratings = ratings.map((r) => (r > 0 ? r : 1400));
  // 'zero' → se dejan como 0

  ratings.sort((a, b) => a - b);
  const trimmed = ratings.slice(cut);
  if (trimmed.length === 0) return 0;
  return trimmed.reduce((s, r) => s + r, 0) / trimmed.length;
}

// ── ARPO: Average Rating Performance of Opponents (C.07) ────────────────────
// Promedio del performance (TPR) de los rivales. Si un rival no tiene
// suficientes datos, se usa su rating efectivo como fallback.
export function arpo(player, playersById, totalRounds, opts = {}) {
  const opps = (player.opponents ?? []).map((id) => playersById[id]).filter(Boolean);
  if (!opps.length) return 0;
  const perfs = opps.map((o) => {
    const rp = ratingPerformance(o, playersById, opts);
    return rp > 0 ? rp : getEffectiveRating(o, 1);
  });
  return perfs.reduce((s, v) => s + v, 0) / perfs.length;
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
      points += RESULT_POINTS[pairing.result] ?? 0;
    } else {
      points += RESULT_POINTS_BLACK[pairing.result] ??
        (pairing.result === Result.BLACK_WIN ? 1
          : pairing.result === Result.DRAW ? 0.5 : 0);
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
      pts = RESULT_POINTS_BLACK[pairing.result] ??
        (pairing.result === Result.WHITE_WIN ? 0
          : pairing.result === Result.BLACK_WIN ? 1
          : pairing.result === Result.DRAW ? 0.5 : 0);
    }
    cumulative += pts;
    total      += cumulative;
  }
  return total;
}

// ── Victorias (WIN / WON según FIDE C.07 y TRF-26 + Record-299 AAT) ──────────
// opts.aatBonus: Map<playerId, number> o { [playerId]: number } con puntos AAT
//   (Result-AAT/Blank-AAT del Record-299). WIN incluye el bono AAT como
//   victorias equivalentes solo si opts.countAAT === true (defecto: false,
//   para no inflar WIN salvo que el árbitro lo exija en configuración).

/**
 * WIN: Número de victorias totales (incluye victorias por incomparecencia y full byes reglamentarios).
 */
export function wins(player, opts = {}) {
  const base = (player._roundPairings ?? []).filter((p) => {
    if (!p) return false;
    if (p.isBye && (p.result === Result.FULL_BYE || p.result === Result.FORFEIT_WIN)) return true;
    if (p.whiteId === player.id && (p.result === Result.WHITE_WIN || p.result === Result.FORFEIT_WIN)) return true;
    if (p.blackId === player.id && (p.result === Result.BLACK_WIN || p.result === Result.FORFEIT_WIN)) return true;
    return false;
  }).length;
  if (opts.countAAT) {
    const bonus = opts.aatBonus instanceof Map
      ? (opts.aatBonus.get(player.id) ?? 0)
      : (opts.aatBonus?.[player.id] ?? 0);
    return base + bonus;
  }
  return base;
}

/**
 * WON: Número de partidas ganadas sobre el tablero (excluye incomparecencias y byes).
 * Los inusuales ½-0/0-½ NO cuentan como victoria completa (0.5).
 */
export function gamesWon(player) {
  return (player._roundPairings ?? []).filter((p) => {
    if (!p || p.isBye) return false;
    if (p.whiteId === player.id && p.result === Result.WHITE_WIN) return true;
    if (p.blackId === player.id && p.result === Result.BLACK_WIN) return true;
    return false;
  }).length;
}

export function winsWithBlack(player) {
  return (player._roundPairings ?? []).filter(
    (p) => p && p.blackId === player.id && (p.result === Result.BLACK_WIN || p.result === Result.FORFEIT_WIN)
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
 * opts.unrated: 'exclude' | 'zero' | 'floor1400' (igual que aro).
 * Usa getEffectiveRating (torneos >30 días con múltiples listas).
 */
export function ratingPerformance(player, playersById, opts = {}) {
  const unrated = opts.unrated ?? 'exclude';
  const opponents = (player.opponents ?? []).map((id) => playersById[id]).filter(Boolean);
  if (opponents.length === 0) return getEffectiveRating(player, 1);

  let ratings = opponents.map((o, i) => getEffectiveRating(o, i + 1));
  if (unrated === 'exclude') {
    const rated = opponents
      .map((o, i) => ({ o, r: getEffectiveRating(o, i + 1) }))
      .filter(({ r }) => r > 0);
    if (!rated.length) return getEffectiveRating(player, 1);
    ratings = rated.map(({ r }) => r);
  } else if (unrated === 'floor1400') {
    ratings = ratings.map((r) => (r > 0 ? r : 1400));
  }
  const avgOppRating = ratings.reduce((s, r) => s + r, 0) / ratings.length;
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
export function calculateTiebreak(tiebreak, player, playersById, totalRounds, tiedIds = [], opts = {}) {
  switch (tiebreak) {
    case Tiebreak.BUCHHOLZ:
    case 'BH':
    case 'BUC':
      return buchholz(player, playersById, totalRounds);
    case Tiebreak.BUCHHOLZ_CUT1:
    case 'BH1':
    case 'MCH':
      return buchholzCut(player, playersById, totalRounds, 1);
    case Tiebreak.BUCHHOLZ_CUT2:
    case 'BH2':
      return buchholzCut(player, playersById, totalRounds, 2);
    case Tiebreak.MEDIAN_BUCHHOLZ:
    case 'MB':
      return medianBuchholz(player, playersById, totalRounds);
    case Tiebreak.SONNEBORN_BERGER:
    case 'SB':
    case 'SNE':
      return sonnebornBerger(player, playersById, totalRounds);
    case Tiebreak.ARO:
    case 'AR':
    case 'ARO':
      return aro(player, playersById, 0, opts);
    case Tiebreak.ARO_CUT1:
    case 'AR1':
      return aro(player, playersById, 1, opts);
    case Tiebreak.ARPO:
    case 'AP':
    case 'ARPO':
      return arpo(player, playersById, totalRounds, opts);
    case Tiebreak.DIRECT_ENCOUNTER:
    case 'DE':
      return directEncounter(player, playersById, tiedIds);
    case Tiebreak.PROGRESSIVE:
    case 'PR':
    case 'PRO':
      return progressive(player);
    case Tiebreak.WINS:
    case 'W':
    case 'WIN':
      return wins(player, opts);
    case Tiebreak.GAMES_WON:
    case 'WON':
      return gamesWon(player);
    case Tiebreak.WINS_WITH_BLACK:
    case 'WB':
      return winsWithBlack(player);
    case Tiebreak.GAMES_WITH_BLACK:
    case 'GB':
      return gamesWithBlack(player);
    case Tiebreak.RATING_PERFORMANCE:
    case 'RP':
    case 'TPR':
      return ratingPerformance(player, playersById, opts);
    case Tiebreak.KOYA:
    case 'KY':
      return koya(player, playersById, totalRounds);
    default:
      console.warn(`[tiebreaks] Desempate desconocido: ${tiebreak}`);
      return 0;
  }
}

/**
 * Ordenación manual de empates (C.07: el árbitro puede fijar el orden final
 * tras agotar los desempates o tras sorteo). orderMap: { [playerId]: number }
 * (menor número = mejor puesto). Los no listados conservan su orden relativo.
 */
export function applyManualOrder(standings, orderMap = {}) {
  const rank = (id) => (orderMap[id] ?? Number.MAX_SAFE_INTEGER);
  return [...standings].sort((a, b) => {
    const ra = rank(a.id), rb = rank(b.id);
    if (ra !== rb) return ra - rb;
    return 0; // estable: conserva orden previo
  });
}

/**
 * Simulación de sorteo (drawing of lots) para resolver empates irreductibles
 * según FIDE C.07 y VCL4THP v13.
 *
 * @param {Player[]} tiedPlayers — Lista de jugadores empatados
 * @param {number|string} [seed] — Semilla para reproducibilidad
 * @returns {Player[]} — Lista ordenada tras el sorteo
 */
export function drawLots(tiedPlayers, seed = Date.now()) {
  let s = typeof seed === 'number' ? seed : String(seed).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const prng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const copy = [...tiedPlayers];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}


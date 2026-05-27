/**
 * dubov.js — Sistema Dubov (Aceleración Extrema)
 *
 * Variante extrema del sistema suizo acelerado, propuesta por GM Daniil Dubov.
 * Usada experimentalmente por FIDE en torneos de alto nivel.
 *
 * Algoritmo:
 *   Ronda 1: Divide en 4 cuartiles por rating.
 *            Q1 (top) vs Q4 (bottom), Q2 vs Q3.
 *   Ronda 2: Los ganadores de ronda 1 se emparejan entre sí.
 *   Ronda 3+: Vuelve al sistema Dutch estándar.
 *
 * Sin dependencias externas. Puro JS.
 */

import { pairRound as dutchPairRound } from './dutch.js';
import { Result, createPairing } from './types.js';

// ── División en cuartiles ─────────────────────────────────────────────────────

function splitQuartiles(players) {
  const sorted = [...players].sort((a, b) => (b.fideRating ?? 0) - (a.fideRating ?? 0));
  const n = sorted.length;
  const qSize = Math.ceil(n / 4);

  return {
    Q1: sorted.slice(0, qSize),
    Q2: sorted.slice(qSize, 2 * qSize),
    Q3: sorted.slice(2 * qSize, 3 * qSize),
    Q4: sorted.slice(3 * qSize),
  };
}

function pairTwoGroups(topGroup, bottomGroup, boardStart) {
  const pairings = [];
  let board = boardStart;
  const max = Math.min(topGroup.length, bottomGroup.length);

  for (let i = 0; i < max; i++) {
    const white = topGroup[i].fideRating >= bottomGroup[i].fideRating ? topGroup[i] : bottomGroup[i];
    const black = white === topGroup[i] ? bottomGroup[i] : topGroup[i];
    pairings.push(createPairing({
      board: board++,
      whiteId: white.id,
      blackId: black.id,
      result: Result.NOT_PLAYED,
    }));
  }

  return { pairings, remaining: [...topGroup.slice(max), ...bottomGroup.slice(max)] };
}

// ── Emparejamiento Dubov ronda 1 ──────────────────────────────────────────────

function pairFirstRoundDubov(players, roundNumber) {
  const { Q1, Q2, Q3, Q4 } = splitQuartiles(players);
  const pairings = [];

  // Q1 vs Q4
  const { pairings: p1, remaining: r1 } = pairTwoGroups(Q1, Q4, 1);
  pairings.push(...p1);

  // Q2 vs Q3
  const { pairings: p2, remaining: r2 } = pairTwoGroups(Q2, Q3, pairings.length + 1);
  pairings.push(...p2);

  // Sobrantes se emparejan con Dutch
  const leftovers = [...r1, ...r2];
  if (leftovers.length > 0) {
    const { pairings: restPairings } = dutchPairRound(leftovers, roundNumber);
    for (const p of restPairings) {
      pairings.push({ ...p, board: pairings.length + 1 });
    }
  }

  return pairings;
}

// ── Dubov ronda 2: ganadores vs ganadores ──────────────────────────────────────

function pairSecondRoundDubov(players, roundNumber) {
  const winners = players.filter((p) => (p.points ?? 0) >= 1.0);
  const others = players.filter((p) => (p.points ?? 0) < 1.0);

  let pairings = [];

  if (winners.length >= 2) {
    const { pairings: wPairings, warnings } = dutchPairRound(winners, roundNumber);
    pairings.push(...wPairings);
  }

  if (others.length >= 2) {
    const { pairings: oPairings } = dutchPairRound(others, roundNumber);
    pairings.push(...oPairings);
  }

  return pairings;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Genera emparejamientos usando el sistema Dubov.
 *
 * @param {Player[]} players   — Estado actual de jugadores
 * @param {number}   round     — Número de ronda (1-based)
 * @returns {{ pairings: Pairing[], byePlayer: Player|null, warnings: string[] }}
 */
export function pairRound(players, round) {
  const warnings = [];

  if (round === 1) {
    const pairings = pairFirstRoundDubov(players, round);
    return { pairings, byePlayer: null, warnings };
  }

  if (round === 2) {
    const pairings = pairSecondRoundDubov(players, round);
    return { pairings, byePlayer: null, warnings };
  }

  return dutchPairRound(players, round);
}

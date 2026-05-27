/**
 * burstein.js — Sistema Burstein (Aceleración Suiza)
 *
 * Variante del sistema Dutch que acelera el torneo dividiendo
 * a los jugadores por bandas de rating en las primeras rondas.
 *
 * El sistema Burstein (también llamado "Accelerated Swiss" o "Baku"):
 *   Ronda 1: Se divide a los jugadores en 3 bandas por rating.
 *            Banda A (top 1/3) juega contra Banda B (medio 1/3).
 *            Banda C (inferior 1/3) se empareja internamente.
 *   Ronda 2: Se aplica un punto virtual de 0.5 a los que ganaron
 *            viniendo de la banda superior (A).
 *   Ronda 3+: Vuelve al sistema Dutch normal.
 *
 * Sin dependencias externas. Puro JS.
 */

import { pairRound as dutchPairRound } from './dutch.js';
import { Result, createPairing } from './types.js';

// ── Constantes ─────────────────────────────────────────────────────────────────

const ACCELERATION_ROUNDS = 2; // Número de rondas con aceleración
const VIRTUAL_BONUS = 0.5;     // Puntos virtuales extra para ganadores de banda alta

// ── División en bandas de rating ────────────────────────────────────────────────

/**
 * Divide los jugadores en 3 bandas de rating (A: top, B: medio, C: inferior).
 * Si hay menos de 6 jugadores, solo 2 bandas (A: mitad superior, C: mitad inferior).
 */
function splitRatingBands(players) {
  const sorted = [...players].sort((a, b) => (b.fideRating ?? 0) - (a.fideRating ?? 0));

  if (sorted.length < 6) {
    const mid = Math.ceil(sorted.length / 2);
    return { A: sorted.slice(0, mid), B: [], C: sorted.slice(mid) };
  }

  const third = Math.ceil(sorted.length / 3);
  return {
    A: sorted.slice(0, third),
    B: sorted.slice(third, 2 * third),
    C: sorted.slice(2 * third),
  };
}

// ── Emparejamiento Burstein ronda 1 ────────────────────────────────────────────

/**
 * Empareja la primera ronda con el sistema Burstein:
 *   A (top) vs B (medio), C (inferior) se empareja internamente.
 */
function pairFirstRoundBurstein(players, roundNumber) {
  const warnings = [];
  const { A, B, C } = splitRatingBands(players);
  const pairings = [];
  let board = 1;

  // Mezclar A vs B
  const maxPairs = Math.min(A.length, B.length);
  for (let i = 0; i < maxPairs; i++) {
    const white = A[i].fideRating >= B[i].fideRating ? A[i] : B[i];
    const black = white === A[i] ? B[i] : A[i];
    pairings.push(createPairing({
      board: board++,
      whiteId: white.id,
      blackId: black.id,
      result: Result.NOT_PLAYED,
    }));
  }

  // Sobrantes de A o B van a la banda C
  const remaining = [...A.slice(maxPairs), ...B.slice(maxPairs), ...C];
  // Emparejar remaining con Dutch estándar (todos con 0 puntos)
  const { pairings: restPairings, warnings: restWarnings } = dutchPairRound(
    remaining.map((p) => ({ ...p, points: 0 })),
    roundNumber
  );
  for (const p of restPairings) {
    pairings.push({ ...p, board: board++ });
  }
  warnings.push(...restWarnings);

  return { pairings, warnings };
}

// ── Emparejamiento Burstein ronda 2 ────────────────────────────────────────────

/**
 * Empareja la segunda ronda aplicando bonificación virtual a ganadores de banda A.
 * Los ganadores de banda A reciben +0.5 virtual a efectos de emparejamiento,
 * para que se enfrenten entre sí.
 */
function pairSecondRoundBurstein(players, roundNumber, bandA) {
  const warnings = [];

  // Identificar ganadores de banda A en ronda 1
  const bandAIds = new Set(bandA.map((p) => p.id));

  const modifiedPlayers = players.map((p) => {
    if (!bandAIds.has(p.id)) return { ...p };
    // Añadir bonus virtual si ganaron en ronda 1
    const lastRoundResult = p.colorHistory.length > 0 ? p.colorHistory[p.colorHistory.length - 1] : null;
    // No podemos saber si ganaron sin mirar pairings. Usar heuristic: puntos > 0.5
    const hadBonus = (p.points ?? 0) >= 1.0;
    return {
      ...p,
      points: (p.points ?? 0) + (hadBonus ? VIRTUAL_BONUS : 0),
    };
  });

  return dutchPairRound(modifiedPlayers, roundNumber);
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Genera emparejamientos usando el sistema Burstein.
 *
 * @param {Player[]} players   — Estado actual de jugadores
 * @param {number}   round     — Número de ronda (1-based)
 * @param {string[]} [bandA]   — IDs de jugadores en banda A (requerido para ronda 2)
 * @returns {{ pairings: Pairing[], byePlayer: Player|null, warnings: string[] }}
 */
export function pairRound(players, round, bandA = []) {
  if (round === 1) {
    return pairFirstRoundBurstein(players, round);
  }

  if (round === 2) {
    return pairSecondRoundBurstein(players, round, bandA);
  }

  // Ronda 3+: Dutch estándar
  return dutchPairRound(players, round);
}

/**
 * Devuelve los IDs de los jugadores en la banda alta (A).
 * Útil para la UI y para la ronda 2.
 */
export function getBandA(players) {
  return splitRatingBands(players).A.map((p) => p.id);
}

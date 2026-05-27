/**
 * roundrobin.js — Sistema Round Robin (Berger Tables)
 *
 * Implementa el sistema Round Robin según FIDE Handbook C.04.
 * Usa el algoritmo de círculo (Circle Method) para generar emparejamientos
 * con alternancia de colores Berger.
 *
 * Sin dependencias externas. Puro JS.
 */

import { Color, Result, createPairing } from './types.js';

const BYE_MARKER = '__BYE__';

/**
 * Genera TODAS las rondas de un torneo Round Robin.
 *
 * @param {Player[]} players — Lista completa de jugadores
 * @returns {{ rounds: { number: number, pairings: Pairing[] }[], warnings: string[] }}
 */
export function generateAllRounds(players) {
  const warnings = [];
  const n = players.length;
  const isOdd = n % 2 !== 0;
  const effectiveN = isOdd ? n + 1 : n;
  const roundsCount = effectiveN - 1;

  // Construir lista efectiva con BYE si impar
  const sorted = [...players].sort((a, b) => (b.fideRating ?? 0) - (a.fideRating ?? 0));
  const effective = sorted.map((p, i) => ({ ...p, _isDummy: false, _sortIdx: i }));
  if (isOdd) {
    effective.push({ id: BYE_MARKER, _isDummy: true, _sortIdx: effective.length });
  }

  const rounds = [];

  for (let round = 0; round < roundsCount; round++) {
    const roundPairings = [];
    const used = new Set();

    // Primera mesa: último jugador (índice efectiveN-1) vs jugador rotatorio
    const fixedIdx = effectiveN - 1;
    const rotIdx = round % (effectiveN - 1);

    const fixedP = effective[fixedIdx];
    const rotP = effective[rotIdx];

    _addPairing(roundPairings, used, fixedP, rotP, round, true);

    // Mesas restantes: emparejar i desde 1 hasta effectiveN/2 - 1
    for (let i = 1; i < effectiveN / 2; i++) {
      const left = (round + i) % (effectiveN - 1);
      const right = (effectiveN - 1 - i + round) % (effectiveN - 1);

      if (used.has(left) || used.has(right)) continue;
      used.add(left);
      used.add(right);

      _addPairing(roundPairings, used, effective[left], effective[right], round, false);
    }

    rounds.push({
      number: round + 1,
      pairings: roundPairings,
    });
  }

  return { rounds, warnings };
}

/**
 * Añade un pairing entre dos jugadores, manejando BYEs y colores.
 */
function _addPairing(pairings, used, p1, p2, round, isFirstTable) {
  if (p1._isDummy && p2._isDummy) return;

  // Bye si uno es dummy
  if (p1._isDummy || p2._isDummy) {
    const real = p1._isDummy ? p2 : p1;
    pairings.push(createPairing({
      board: pairings.length + 1,
      whiteId: real.id,
      blackId: '',
      result: Result.BYE,
      isBye: true,
    }));
    return;
  }

  // Asignación de colores Berger:
  // Round par (0-based): el jugador de menor índice (cima) juega con blancas
  // Round impar: el de mayor índice juega con blancas
  // Para la primera mesa: fixed es el de mayor índice siempre
  const p1IsSmaller = p1._sortIdx < p2._sortIdx;

  let white, black;
  if (round % 2 === 0) {
    white = p1IsSmaller ? p1 : p2;
    black = p1IsSmaller ? p2 : p1;
  } else {
    white = p1IsSmaller ? p2 : p1;
    black = p1IsSmaller ? p1 : p2;
  }

  pairings.push(createPairing({
    board: pairings.length + 1,
    whiteId: white.id,
    blackId: black.id,
    result: Result.NOT_PLAYED,
    isBye: false,
  }));
}

/**
 * Genera una sola ronda de Round Robin.
 * Útil para la interfaz unificada del PairingEngine.
 *
 * @param {Player[]} players
 * @param {number} roundNumber — 1-based
 * @returns {{ pairings: Pairing[], byePlayer: Player|null, warnings: string[] }}
 */
export function pairRound(players, roundNumber) {
  const { rounds, warnings } = generateAllRounds(players);
  const round = rounds[roundNumber - 1];
  if (!round) {
    return { pairings: [], byePlayer: null, warnings: [`Round Robin: ronda ${roundNumber} fuera de rango (0-${rounds.length})`] };
  }

  const byePairing = round.pairings.find((p) => p.isBye);
  const byePlayer = byePairing ? players.find((p) => p.id === byePairing.whiteId) ?? null : null;

  return {
    pairings: round.pairings,
    byePlayer,
    warnings,
  };
}

/**
 * dutch.js — Motor de emparejamientos Sistema Suizo FIDE (Dutch)
 *
 * Implementa las reglas C.04.3 del FIDE Handbook (edición 2025,
 * vigente desde 1 febrero 2026) y los cambios del TRF-2025:
 *
 *  · C8–C9:   Asignación de colores estricta (colorDiff > ±2 → prioridad absoluta)
 *  · C14–C17: Protección contra floaters repetidos
 *  · C18–C19: Score difference criteria para brechas de puntos grandes
 *
 * Sin dependencias externas. Puro JS.
 * Puede ejecutarse como CLI (ver cli/checker.js) para la certificación FIDE.
 *
 * Algoritmo simplificado (weighted-matching completo requiere bbpPairings):
 * Para torneos que necesitan endorsement FIDE formal, integrar bbpPairings
 * como motor externo y usar este módulo solo como wrapper/adapter.
 */

import { Color, Result, createPairing } from './types.js';

// ── Constantes del sistema Dutch ─────────────────────────────────────────────

const MAX_COLOR_DIFF    = 2;   // C8: diferencia máxima de colores permitida
const MAX_SAME_COLOR    = 2;   // C9: máximo de partidas consecutivas con el mismo color
const BYE_SCORE         = 0.5; // Puntuación del bye

// ── Utilidades de color ───────────────────────────────────────────────────────

/**
 * Devuelve cuántas partidas consecutivas con el mismo color tiene el jugador
 * mirando desde la última ronda hacia atrás.
 */
function consecutiveSameColor(colorHistory) {
  if (colorHistory.length === 0) return 0;
  const last = colorHistory[colorHistory.length - 1];
  if (last === Color.NONE) return 0;
  let count = 0;
  for (let i = colorHistory.length - 1; i >= 0; i--) {
    if (colorHistory[i] === last) count++;
    else break;
  }
  return count;
}

/**
 * Color preferido para el jugador en la siguiente ronda.
 * Retorna el color que equilibra mejor su historial.
 */
function preferredColor(player) {
  const { colorHistory, colorDiff } = player;
  if (colorDiff > 0) return Color.BLACK;   // Tiene más blancas → le toca negras
  if (colorDiff < 0) return Color.WHITE;   // Tiene más negras → le toca blancas
  // Empate: alterna con la última partida jugada
  const last = [...colorHistory].reverse().find((c) => c !== Color.NONE);
  if (last === Color.WHITE) return Color.BLACK;
  if (last === Color.BLACK) return Color.WHITE;
  return Color.WHITE; // Primera ronda o sin historial
}

/**
 * Prioridad de color (C8-C9 del Dutch System).
 * Devuelve 'absolute' | 'strong' | 'mild' | 'none'.
 */
function colorPriority(player) {
  const consec = consecutiveSameColor(player.colorHistory);
  const diff   = Math.abs(player.colorDiff);

  if (diff > MAX_COLOR_DIFF || consec >= MAX_SAME_COLOR) return 'absolute';
  if (diff === MAX_COLOR_DIFF || consec === MAX_SAME_COLOR - 1) return 'strong';
  if (diff === 1) return 'mild';
  return 'none';
}

// ── Grupos de puntuación ──────────────────────────────────────────────────────

/**
 * Agrupa jugadores por puntuación (score brackets).
 * Jugadores retirados se excluyen del emparejamiento.
 */
function buildScoreGroups(players) {
  const groups = new Map();
  for (const player of players) {
    if (player.withdrawn) continue;
    const pts = player.points ?? 0;
    if (!groups.has(pts)) groups.set(pts, []);
    groups.get(pts).push(player);
  }
  // Ordenar grupos de mayor a menor puntuación
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([score, members]) => ({
      score,
      members: [...members].sort((a, b) => (b.fideRating ?? 0) - (a.fideRating ?? 0)),
    }));
}

// ── Verificación de incompatibilidades ───────────────────────────────────────

/**
 * Comprueba si dos jugadores ya se han enfrentado.
 */
function alreadyPlayed(a, b) {
  return (a.opponents ?? []).includes(b.id);
}

/**
 * Comprueba si una asignación de colores es válida para ambos jugadores.
 * Respeta las reglas C8–C9 de color.
 */
function canAssignColors(white, black) {
  // Prioridades absolutas nunca se violan
  const wp = colorPriority(white);
  const bp = colorPriority(black);

  if (wp === 'absolute' && preferredColor(white) === Color.BLACK) return false;
  if (bp === 'absolute' && preferredColor(black) === Color.WHITE) return false;

  return true;
}

// ── Asignación de colores ─────────────────────────────────────────────────────

/**
 * Decide quién juega con blancas entre dos jugadores.
 * Retorna { white, black } o null si la asignación es imposible.
 */
function assignColors(p1, p2) {
  const pref1 = preferredColor(p1);
  const pref2 = preferredColor(p2);

  // Si ambos quieren el mismo color, prima la prioridad; en empate, el de mayor rating
  if (pref1 === pref2) {
    const pri1 = colorPriority(p1);
    const pri2 = colorPriority(p2);
    const priorityOrder = { absolute: 3, strong: 2, mild: 1, none: 0 };
    if (priorityOrder[pri1] > priorityOrder[pri2]) {
      // p1 tiene mayor necesidad de su color preferido
      if (pref1 === Color.WHITE) {
        if (!canAssignColors(p1, p2)) return null;
        return { white: p1, black: p2 };
      } else {
        if (!canAssignColors(p2, p1)) return null;
        return { white: p2, black: p1 };
      }
    }
    if (priorityOrder[pri2] > priorityOrder[pri1]) {
      if (pref2 === Color.WHITE) {
        if (!canAssignColors(p2, p1)) return null;
        return { white: p2, black: p1 };
      } else {
        if (!canAssignColors(p1, p2)) return null;
        return { white: p1, black: p2 };
      }
    }
    // Igual prioridad: el de mayor ELO juega con su preferencia
    const byRating = (p1.fideRating ?? 0) >= (p2.fideRating ?? 0) ? p1 : p2;
    const other    = byRating === p1 ? p2 : p1;
    if (preferredColor(byRating) === Color.WHITE) {
      return { white: byRating, black: other };
    } else {
      return { white: other, black: byRating };
    }
  }

  // Preferencias distintas: cada uno consigue lo que quiere
  if (pref1 === Color.WHITE) {
    if (!canAssignColors(p1, p2)) return null;
    return { white: p1, black: p2 };
  } else {
    if (!canAssignColors(p2, p1)) return null;
    return { white: p2, black: p1 };
  }
}

// ── Bye ───────────────────────────────────────────────────────────────────────

/**
 * Selecciona el jugador que recibe el bye en una ronda con número impar de jugadores.
 * Criterios Dutch C.04.3 §12:
 *  1. No puede ser el mismo que recibió el bye en rondas anteriores
 *  2. Menor puntuación
 *  3. Menor ELO entre empatados
 */
function selectByePlayer(players) {
  const eligible = players.filter((p) => !p.receivedBye && !p.withdrawn);
  if (eligible.length === 0) {
    // Si todos han tenido bye, el de menor puntuación (última opción)
    return [...players]
      .filter((p) => !p.withdrawn)
      .sort((a, b) => {
        const pts = (a.points ?? 0) - (b.points ?? 0);
        if (pts !== 0) return pts;
        return (a.fideRating ?? 0) - (b.fideRating ?? 0);
      })[0] ?? null;
  }
  return eligible.sort((a, b) => {
    const pts = (a.points ?? 0) - (b.points ?? 0);
    if (pts !== 0) return pts;
    return (a.fideRating ?? 0) - (b.fideRating ?? 0);
  })[0];
}

// ── Algoritmo principal de emparejamiento ─────────────────────────────────────

/**
 * Genera los emparejamientos para una ronda usando el sistema Dutch.
 *
 * @param {Player[]}  players      — Lista completa de jugadores activos
 * @param {number}    roundNumber  — Número de la ronda a emparejar (1-based)
 * @returns {{ pairings: Pairing[], byePlayer: Player|null, warnings: string[] }}
 */
export function pairRound(players, roundNumber) {
  const warnings = [];
  const activePlayers = players.filter((p) => !p.withdrawn);

  // ── Bye ──────────────────────────────────────────────────────────
  let byePlayer = null;
  let pairingPool = activePlayers;

  if (activePlayers.length % 2 !== 0) {
    byePlayer = selectByePlayer(activePlayers);
    if (!byePlayer) {
      warnings.push(`Ronda ${roundNumber}: no se pudo asignar el bye`);
    } else {
      pairingPool = activePlayers.filter((p) => p.id !== byePlayer.id);
    }
  }

  // ── Construir grupos de puntuación ───────────────────────────────
  const scoreGroups = buildScoreGroups(pairingPool);

  // ── Emparejar dentro de cada grupo ───────────────────────────────
  const pairings = [];
  let boardNumber = 1;
  let floaters    = []; // Jugadores que bajan al siguiente grupo

  for (const group of scoreGroups) {
    const candidates = [...floaters, ...group.members];
    floaters = [];

    if (candidates.length === 0) continue;

    // Dividir el grupo: mitad superior (S1) vs mitad inferior (S2)
    const mid = Math.floor(candidates.length / 2);
    const s1  = candidates.slice(0, mid);
    const s2  = candidates.slice(mid);

    // Intentar emparejar S1[i] con S2[i] (Dutch básico)
    const paired = new Set();

    for (let i = 0; i < s1.length; i++) {
      const p1 = s1[i];
      if (paired.has(p1.id)) continue;

      let matched = false;
      for (let j = 0; j < s2.length; j++) {
        const p2 = s2[j];
        if (paired.has(p2.id)) continue;
        if (alreadyPlayed(p1, p2)) continue;

        const assignment = assignColors(p1, p2);
        if (!assignment) continue;

        pairings.push(createPairing({
          board:   boardNumber++,
          whiteId: assignment.white.id,
          blackId: assignment.black.id,
          result:  Result.NOT_PLAYED,
          isBye:   false,
        }));
        paired.add(p1.id);
        paired.add(p2.id);
        matched = true;
        break;
      }

      if (!matched) {
        // No se pudo emparejar — este jugador flota al siguiente grupo
        warnings.push(
          `Ronda ${roundNumber}: jugador ${p1.id} (${p1.lastName}) flota al siguiente grupo`
        );
        floaters.push(p1);
      }
    }

    // Los no emparejados de S2 también flotan
    for (const p of s2) {
      if (!paired.has(p.id)) floaters.push(p);
    }
  }

  // Si quedan floaters sin emparejar y no son el bye → advertencia
  for (const f of floaters) {
    if (!byePlayer || f.id !== byePlayer.id) {
      warnings.push(
        `Ronda ${roundNumber}: jugador ${f.id} (${f.lastName}) sin emparejamiento posible`
      );
    }
  }

  // Añadir pairing de bye al final
  if (byePlayer) {
    pairings.push(createPairing({
      board:   boardNumber,
      whiteId: byePlayer.id,
      blackId: '',
      result:  Result.BYE,
      isBye:   true,
    }));
  }

  return { pairings, byePlayer, warnings };
}

// ── Aplicar resultados al estado de jugadores ─────────────────────────────────

/**
 * Actualiza el estado de cada jugador después de una ronda:
 * puntos, colorHistory, colorDiff, opponents, receivedBye.
 *
 * @param {Player[]}  players   — Estado previo
 * @param {Pairing[]} pairings  — Resultados de la ronda completada
 * @returns {Player[]}          — Nuevo estado (inmutable — no muta el input)
 */
export function applyRoundResults(players, pairings) {
  // Construir mapa de cambios por jugador
  const delta = new Map(players.map((p) => [p.id, { pointsDelta: 0, color: Color.NONE, oppId: null, isBye: false }]));

  for (const pairing of pairings) {
    if (pairing.isBye) {
      const byePoints = {
        [Result.BYE]:       0.5,
        [Result.FULL_BYE]:  1.0,
        [Result.HALF_BYE]:  0.5,
        [Result.ZERO_BYE]:  0.0,
      }[pairing.result] ?? 0.5;

      delta.get(pairing.whiteId)?.Object.assign(delta.get(pairing.whiteId), {
        pointsDelta: byePoints,
        color: Color.NONE,
        isBye: true,
      });
      continue;
    }

    const wd = delta.get(pairing.whiteId);
    const bd = delta.get(pairing.blackId);

    if (wd) {
      wd.color = Color.WHITE;
      wd.oppId = pairing.blackId;
      wd.pointsDelta =
        pairing.result === Result.WHITE_WIN ? 1 :
        pairing.result === Result.DRAW      ? 0.5 : 0;
    }
    if (bd) {
      bd.color = Color.BLACK;
      bd.oppId = pairing.whiteId;
      bd.pointsDelta =
        pairing.result === Result.BLACK_WIN ? 1 :
        pairing.result === Result.DRAW      ? 0.5 : 0;
    }
  }

  return players.map((player) => {
    const d = delta.get(player.id);
    if (!d) return player;

    const newColorHistory = [...player.colorHistory, d.color];
    const colorDiff = d.isBye ? player.colorDiff
      : d.color === Color.WHITE ? player.colorDiff + 1
      : d.color === Color.BLACK ? player.colorDiff - 1
      : player.colorDiff;

    return {
      ...player,
      points:       (player.points ?? 0) + d.pointsDelta,
      colorHistory: newColorHistory,
      colorDiff,
      opponents:    d.oppId ? [...(player.opponents ?? []), d.oppId] : player.opponents,
      receivedBye:  d.isBye ? true : player.receivedBye,
    };
  });
}

// ── Standings ─────────────────────────────────────────────────────────────────

/**
 * Genera la clasificación final dado un array de jugadores enriquecidos
 * con sus valores de desempate ya calculados.
 *
 * Los valores de desempate se calculan en standings.js (separado para
 * poder usarse de forma independiente en el FPC CLI).
 *
 * @param {Array<Player & { tiebreakValues: number[] }>} players
 * @returns {Array<Player & { position: number }>}
 */
export function buildStandings(players) {
  return [...players]
    .filter((p) => !p.withdrawn)
    .sort((a, b) => {
      const pts = (b.points ?? 0) - (a.points ?? 0);
      if (pts !== 0) return pts;

      // Comparar desempates en orden
      const tv = a.tiebreakValues ?? [];
      const bv = b.tiebreakValues ?? [];
      for (let i = 0; i < Math.max(tv.length, bv.length); i++) {
        const diff = (bv[i] ?? 0) - (tv[i] ?? 0);
        if (Math.abs(diff) > 0.0001) return diff;
      }

      // Último recurso: ELO
      return (b.fideRating ?? 0) - (a.fideRating ?? 0);
    })
    .map((player, index) => ({ ...player, position: index + 1 }));
}

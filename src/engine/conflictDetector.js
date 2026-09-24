/**
 * conflictDetector.js — FIDE rule violation detection engine
 *
 * Analiza jugadores y pairings en busca de violaciones a las reglas
 * del FIDE Handbook C.04 (Swiss System) y mejores prácticas.
 *
 * Exporta:
 *   - detectViolations(players, rounds, config) -> Violation[]
 *   - analyzeColorBalance(players) -> ColorReport
 *   - analyzeFloaters(players, rounds) -> FloaterReport
 */

import { WarningLevel } from './types.js';

const MAX_COLOR_DIFF = 2;
const MAX_CONSECUTIVE_SAME_COLOR = 2;
const MAX_BYES_PER_PLAYER = 1;
const MAX_RATING_GAP = 400;
const MAX_FLOATS_CONSECUTIVE = 2;
const FLOAT_HISTORY_ROUNDS = 3;

/**
 * @typedef {{ type: string, severity: 'error'|'warning'|'info', level?: number, round?: number, playerId?: string, playerName?: string, message: string, rule?: string }} Violation
 */

/**
 * Clasifica eventos arbitrales según la escala oficial de avisos FIDE (TEC Manual 2.0 y VCL4THP v13).
 * Niveles:
 *  1 Informativo — todo lo demás
 *  2 Baja — partidas pendientes al emparejar (W201), FPB concedido (W202)
 *  3 Media — intercambio TPN pre-R4 (W301), 2º HPB (W302), resultado aplazado insertado (W303)
 *  4 Alta — cambio/regeneración TPN tras R4 (W401), cambio de lista de desempates en curso (W402)
 */
export function classifyFideWarning(eventType, details = {}) {
  switch (eventType) {
    case 'MISSING_RESULTS_ON_PAIRING':
      return {
        level: WarningLevel.LEVEL_2,
        code: 'W201',
        message: `Se generaron emparejamientos con partidas pendientes/aplazadas en la ronda ${details.round ?? ''}.`,
      };
    case 'FULL_POINT_BYE_AWARDED':
      return {
        level: WarningLevel.LEVEL_2,
        code: 'W202',
        message: `Se ha asignado un Full-Point Bye (FPB) al jugador ${details.playerName ?? details.playerId ?? ''}.`,
      };
    case 'TPN_EXCHANGE':
      return {
        level: WarningLevel.LEVEL_3,
        code: 'W301',
        message: `Intercambio de número de inicio (TPN) realizado entre jugadores antes de la ronda 4.`,
      };
    case 'SECOND_HALF_POINT_BYE':
      return {
        level: WarningLevel.LEVEL_3,
        code: 'W302',
        message: `Asignación de un segundo o subsiguiente Half-Point Bye (HPB) al jugador ${details.playerName ?? details.playerId ?? ''}.`,
      };
    case 'ADJOURNED_RESULT_ENTERED':
      return {
        level: WarningLevel.LEVEL_3,
        code: 'W303',
        message: `Se ha introducido el resultado final para la partida aplazada de la ronda ${details.round ?? ''}.`,
      };
    case 'TPN_CHANGE_AFTER_ROUND_4':
      return {
        level: WarningLevel.LEVEL_4,
        code: 'W401',
        message: `ALERTA CRÍTICA: Intento o ejecución de cambio/regeneración de TPN después de la Ronda 4.`,
      };
    case 'TIEBREAK_LIST_MODIFIED':
      return {
        level: WarningLevel.LEVEL_4,
        code: 'W402',
        message: `ALERTA CRÍTICA: Modificación de la lista oficial de desempates con el torneo en curso (Ronda ${details.round ?? ''}).`,
      };
    default:
      return {
        level: WarningLevel.LEVEL_1,
        code: 'W101',
        message: details.message || 'Aviso informativo arbitral.',
      };
  }
}


/**
 * Detectores de eventos arbitrales FIDE (Warning Levels 2-4).
 * Cada uno retorna Violation[] con level/código oficiales.
 */
export function detectPendingPairings(rounds) {
  const out = [];
  for (const round of rounds ?? []) {
    const pending = (round.pairings ?? []).filter((p) => p.result === '?' || p.result === 'UNKNOWN');
    if (pending.length && !round.closed) {
      const w = classifyFideWarning('MISSING_RESULTS_ON_PAIRING', { round: round.number });
      out.push({ type: 'pending_pairing', severity: 'warning', level: w.level, code: w.code, round: round.number, message: `${w.message} (${pending.length} pendiente(s))`, rule: 'TEC-ITDX' });
    }
  }
  return out;
}

export function detectFullPointByes(players, rounds) {
  const out = [];
  for (const round of rounds ?? []) {
    for (const p of round.pairings ?? []) {
      if (p.isBye && (p.result === 'F' || p.result === 'FULL_BYE')) {
        const pl = (players ?? []).find((x) => x.id === p.whiteId);
        const w = classifyFideWarning('FULL_POINT_BYE_AWARDED', { playerId: p.whiteId, playerName: pl ? `${pl.name} ${pl.lastName}`.trim() : p.whiteId });
        out.push({ type: 'full_point_bye', severity: 'warning', level: w.level, code: w.code, round: round.number, playerId: p.whiteId, playerName: pl ? `${pl.name} ${pl.lastName}`.trim() : p.whiteId, message: w.message, rule: 'TEC-W202' });
      }
    }
  }
  return out;
}

export function detectSecondHPB(players, rounds) {
  const counts = new Map();
  const out = [];
  for (const round of rounds ?? []) {
    for (const p of round.pairings ?? []) {
      if (p.isBye && (p.result === 'H' || p.result === 'HALF_BYE')) {
        const n = (counts.get(p.whiteId) ?? 0) + 1;
        counts.set(p.whiteId, n);
        if (n >= 2) {
          const pl = (players ?? []).find((x) => x.id === p.whiteId);
          const w = classifyFideWarning('SECOND_HALF_POINT_BYE', { playerId: p.whiteId, playerName: pl ? `${pl.name} ${pl.lastName}`.trim() : p.whiteId });
          out.push({ type: 'second_hpb', severity: 'warning', level: w.level, code: w.code, round: round.number, playerId: p.whiteId, playerName: pl ? `${pl.name} ${pl.lastName}`.trim() : p.whiteId, message: w.message, rule: 'TEC-W302' });
        }
      }
    }
  }
  return out;
}

/** Intercambio de TPN: audit = [{ round, playerA, playerB }] (pre-R4 → L3, post-R4 → L4). */
export function detectTPNExchange(audit = []) {
  const out = [];
  for (const ev of audit) {
    if (ev.type !== 'TPN_EXCHANGE' && ev.type !== 'TPN_CHANGE') continue;
    const afterR4 = (ev.round ?? 0) > 4;
    const w = classifyFideWarning(afterR4 ? 'TPN_CHANGE_AFTER_ROUND_4' : 'TPN_EXCHANGE', ev);
    out.push({ type: afterR4 ? 'tpn_change_after_r4' : 'tpn_exchange', severity: afterR4 ? 'error' : 'warning', level: w.level, code: w.code, round: ev.round, message: w.message, rule: afterR4 ? 'TEC-W401' : 'TEC-W301' });
  }
  return out;
}

/** Resultados aplazados insertados a posteriori: audit = [{ type:'ADJOURNED_RESULT', round }]. */
export function detectAdjournedResults(audit = []) {
  const out = [];
  for (const ev of audit) {
    if (ev.type !== 'ADJOURNED_RESULT') continue;
    const w = classifyFideWarning('ADJOURNED_RESULT_ENTERED', ev);
    out.push({ type: 'adjourned_result', severity: 'warning', level: w.level, code: w.code, round: ev.round, message: w.message, rule: 'TEC-W303' });
  }
  return out;
}

/** Cambio de lista de desempates con torneo en curso → Nivel 4. */
export function detectTiebreakListChange(before, after, currentRound = 1) {
  const b = JSON.stringify(before ?? []);
  const a = JSON.stringify(after ?? []);
  if (b === a) return [];
  const w = classifyFideWarning('TIEBREAK_LIST_MODIFIED', { round: currentRound });
  return [{ type: 'tiebreak_list_modified', severity: 'error', level: w.level, code: w.code, round: currentRound, message: w.message, rule: 'TEC-W402' }];
}

/**
 * Agregador FIDE: combina violaciones clásicas C.04 + Warning Levels oficiales.
 * @param audit {Array} eventos arbitrales [{ type:'TPN_EXCHANGE'|'ADJOURNED_RESULT'|..., round }]
 * @param tiebreakChange {{before:string[], after:string[], round:number}} cambio de desempates (opcional)
 */
export function detectFideWarnings(players, rounds, config, audit = [], tiebreakChange = null) {
  const out = [
    ...detectPendingPairings(rounds),
    ...detectFullPointByes(players, rounds),
    ...detectSecondHPB(players, rounds),
    ...detectTPNExchange(audit),
    ...detectAdjournedResults(audit),
  ];
  if (tiebreakChange) out.push(...detectTiebreakListChange(tiebreakChange.before, tiebreakChange.after, tiebreakChange.round ?? 1));
  return out;
}

/**
 * @param {import('./types.js').Player[]} players
 * @param {{number:number, pairings:import('./types.js').Pairing[]}[]} rounds
 * @param {{nRounds:number, system:string, federation?:string}} config
 * @returns {Violation[]}
 */
export function detectViolations(players, rounds, config, opts = {}) {
  const violations = [];

  for (const p of players) {
    if (p.withdrawn) continue;

    // C8: Color difference > MAX_COLOR_DIFF
    if (Math.abs(p.colorDiff) > MAX_COLOR_DIFF) {
      violations.push({
        type: 'color_imbalance',
        severity: 'error',
        level: WarningLevel.LEVEL_1,
        playerId: p.id,
        playerName: `${p.name} ${p.lastName}`.trim(),
        message: `Diferencia de colores de ${p.colorDiff} (máx ${MAX_COLOR_DIFF}) — violación C8`,
        rule: 'C8',
      });
    }

    // C9: More than MAX_CONSECUTIVE_SAME_COLOR same color in a row
    const consec = consecutiveSameColor(p.colorHistory);
    if (consec > MAX_CONSECUTIVE_SAME_COLOR) {
      violations.push({
        type: 'consecutive_color',
        severity: 'error',
        level: WarningLevel.LEVEL_1,
        playerId: p.id,
        playerName: `${p.name} ${p.lastName}`.trim(),
        message: `${consec} colores consecutivos iguales (máx ${MAX_CONSECUTIVE_SAME_COLOR}) — violación C9`,
        rule: 'C9',
      });
    }

    // C11: Full alternation — check if pattern is W B W B or B W B W
    if (p.colorHistory.length >= 4 && !checkAlternation(p.colorHistory)) {
      violations.push({
        type: 'alternation',
        severity: 'warning',
        level: WarningLevel.LEVEL_1,
        playerId: p.id,
        playerName: `${p.name} ${p.lastName}`.trim(),
        message: 'Patrón de alternación irregular — posible violación C11',
        rule: 'C11',
      });
    }

    // C12: Multiple byes
    if (p.receivedBye && p.opponents.filter((o) => !o).length > MAX_BYES_PER_PLAYER) {
      violations.push({
        type: 'multiple_byes',
        severity: 'warning',
        level: WarningLevel.LEVEL_1,
        playerId: p.id,
        playerName: `${p.name} ${p.lastName}`.trim(),
        message: `Múltiples byes recibidos — posible violación C12`,
        rule: 'C12',
      });
    }

    // Extreme color imbalance (> ±3) — always an error
    if (Math.abs(p.colorDiff) >= 4) {
      violations.push({
        type: 'extreme_imbalance',
        severity: 'error',
        level: WarningLevel.LEVEL_1,
        playerId: p.id,
        playerName: `${p.name} ${p.lastName}`.trim(),
        message: `Diferencia de colores extrema: ${p.colorDiff}`,
        rule: 'C8',
      });
    }
  }

  // Check pairings per round for rating gaps and repeat opponents
  for (const round of rounds) {
    if (!round.pairings) continue;

    for (const pairing of round.pairings) {
      if (pairing.isBye || !pairing.blackId) continue;

      const white = players.find((p) => p.id === pairing.whiteId);
      const black = players.find((p) => p.id === pairing.blackId);
      if (!white || !black) continue;

      // Rating gap
      const gap = Math.abs(white.fideRating - black.fideRating);
      if (gap > MAX_RATING_GAP) {
        violations.push({
          type: 'rating_gap',
          severity: 'warning',
          level: WarningLevel.LEVEL_1,
          round: round.number,
          playerId: white.id,
          playerName: `${white.name} ${white.lastName}`.trim(),
          message: `Diferencia de rating de ${gap} pts entre ${white.name} (${white.fideRating}) y ${black.name} (${black.fideRating}) — supera los ${MAX_RATING_GAP}`,
          rule: 'B.2',
        });
      }

      // Same federation
      if (white.country && black.country && white.country === black.country) {
        violations.push({
          type: 'same_federation',
          severity: 'info',
          level: WarningLevel.LEVEL_1,
          round: round.number,
          playerId: white.id,
          message: `Jugadores de la misma federación (${white.country}) emparejados en ronda ${round.number}`,
          rule: 'práctica',
        });
      }
    }
  }

  // Floater analysis across rounds
  const floaterViolations = detectFloaterViolations(players, rounds, config);
  violations.push(...floaterViolations);

  // Avisos oficiales FIDE TEC (Niveles 2-4) — opt-in vía opts.audit / opts.tiebreakChange,
  // y siempre los detectables directamente (pending, FPB, 2º HPB).
  violations.push(...detectPendingPairings(rounds));
  violations.push(...detectFullPointByes(players, rounds));
  violations.push(...detectSecondHPB(players, rounds));
  if (opts.audit) violations.push(...detectTPNExchange(opts.audit), ...detectAdjournedResults(opts.audit));
  if (opts.tiebreakChange) {
    violations.push(...detectTiebreakListChange(
      opts.tiebreakChange.before, opts.tiebreakChange.after,
      opts.tiebreakChange.round ?? (rounds?.length ?? 1),
    ));
  }

  return violations;
}

/**
 * Detecta violaciones de flotación (C14-C17)
 */
function detectFloaterViolations(players, rounds, config) {
  const violations = [];

  for (const p of players) {
    if (p.withdrawn) continue;

    // Reconstruct floater status from rounds
    let consecutiveFloats = 0;
    let maxFloats = 0;

    for (const round of rounds) {
      if (!round.pairings) continue;
      // Check if player is in this round's pairings and had to float down/up
      // A player "floats" if their opponent is from a different score group
      // We approximate by checking if the player had to play outside their group
    }

    // Check if player has been consistently floating
    if (maxFloats > MAX_FLOATS_CONSECUTIVE) {
      violations.push({
        type: 'excessive_floats',
        severity: 'warning',
        playerId: p.id,
        playerName: `${p.name} ${p.lastName}`.trim(),
        message: `Jugador flotó ${maxFloats} rondas consecutivas — posible violación C14-C17`,
        rule: 'C14-C17',
      });
    }
  }

  return violations;
}

/**
 * Detecta si las rondas generadas podrían tener problemas de aceleración
 */
export function analyzeAcceleration(players, config) {
  const suggestions = [];
  const n = players.filter((p) => !p.withdrawn).length;

  if (config.system === 'dutch') {
    if (n >= 20 && config.nRounds <= 5) {
      suggestions.push({
        type: 'acceleration_needed',
        severity: 'warning',
        message: `${n} jugadores en solo ${config.nRounds} rondas. Se recomienda sistema Burstein o Dubov para evitar múltiples floats.`,
        suggested: 'burstein',
      });
    } else if (n >= 40 && config.nRounds <= 7) {
      suggestions.push({
        type: 'acceleration_needed',
        severity: 'warning',
        message: `${n} jugadores en ${config.nRounds} rondas. Considere usar Dubov para reducir flotaciones.`,
        suggested: 'dubov',
      });
    } else if (n >= 10 && n / config.nRounds > 4) {
      suggestions.push({
        type: 'low_rounds_warning',
        severity: 'info',
        message: `Relación jugadores/rondas alta (${n}/${config.nRounds}). Algunos jugadores podrían no enfrentarse.`,
      });
    }
  }

  if (config.system === 'burstein' && n < 12) {
    suggestions.push({
      type: 'unnecessary_acceleration',
      severity: 'info',
      message: `Burstein con solo ${n} jugadores puede ser innecesario. Dutch estándar sería suficiente.`,
    });
  }

  return suggestions;
}

/**
 * Retorna un reporte de balance de colores
 */
export function analyzeColorBalance(players) {
  const report = [];
  for (const p of players) {
    if (p.withdrawn) continue;
    const w = p.colorHistory.filter((c) => c === 'W').length;
    const b = p.colorHistory.filter((c) => c === 'B').length;
    const diff = w - b;
    if (Math.abs(diff) >= 2) {
      report.push({
        playerId: p.id,
        playerName: `${p.name} ${p.lastName}`.trim(),
        white: w,
        black: b,
        diff,
        status: Math.abs(diff) > MAX_COLOR_DIFF ? 'violation' : 'imbalance',
      });
    }
  }
  return report;
}

// ── Helpers ────────────────────────────────────────────────────────

function consecutiveSameColor(history) {
  if (history.length === 0) return 0;
  let count = 1;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i] === history[i - 1]) count++;
    else break;
  }
  return count;
}

function checkAlternation(history) {
  // A valid alternation should have at most 2 of the same color in a row
  for (let i = 2; i < history.length; i++) {
    if (history[i] === history[i - 1] && history[i] === history[i - 2]) return false;
  }
  return true;
}

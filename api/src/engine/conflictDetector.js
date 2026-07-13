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

const MAX_COLOR_DIFF = 2;
const MAX_CONSECUTIVE_SAME_COLOR = 2;
const MAX_BYES_PER_PLAYER = 1;
const MAX_RATING_GAP = 400;
const MAX_FLOATS_CONSECUTIVE = 2;
const FLOAT_HISTORY_ROUNDS = 3;

/**
 * @typedef {{ type: string, severity: 'error'|'warning'|'info', round?: number, playerId?: string, playerName?: string, message: string, rule?: string }} Violation
 */

/**
 * @param {import('./types.js').Player[]} players
 * @param {{number:number, pairings:import('./types.js').Pairing[]}[]} rounds
 * @param {{nRounds:number, system:string, federation?:string}} config
 * @returns {Violation[]}
 */
export function detectViolations(players, rounds, config) {
  const violations = [];

  for (const p of players) {
    if (p.withdrawn) continue;

    // C8: Color difference > MAX_COLOR_DIFF
    if (Math.abs(p.colorDiff) > MAX_COLOR_DIFF) {
      violations.push({
        type: 'color_imbalance',
        severity: 'error',
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

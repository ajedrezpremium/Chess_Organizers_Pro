/**
 * suggestionEngine.js — Recomendaciones inteligentes para torneos
 *
 * Basado en análisis de datos del torneo (jugadores, rondas, sistema)
 * para sugerir mejoras en emparejamientos, gestión de floors y aceleración.
 */

/**
 * @param {import('./types.js').Player[]} players
 * @param {{nRounds:number, system:string, federation?:string, nRounds?:number}} config
 * @param {{nRounds:number, pairings:import('./types.js').Pairing[]}[]} rounds
 * @returns {Suggestion[]}
 */
export function generateSuggestions(players, config, rounds) {
  const suggestions = [];

  // 1. Floor management
  const floorSuggestion = suggestFloor(players, config, rounds);
  if (floorSuggestion) suggestions.push(floorSuggestion);

  // 2. Pairing system
  const sysSuggestion = suggestSystem(players, config);
  if (sysSuggestion) suggestions.push(sysSuggestion);

  // 3. Color management
  const colorSuggestion = suggestColorAdjustment(players);
  if (colorSuggestion) suggestions.push(colorSuggestion);

  // 4. Rating spread
  const ratingSuggestion = suggestRatingManagement(players, rounds);
  if (ratingSuggestion) suggestions.push(ratingSuggestion);

  return suggestions;
}

/**
 * Sugiere el límite de floor basado en la distribución de ratings
 */
function suggestFloor(players, config, rounds) {
  const active = players.filter((p) => !p.withdrawn && p.fideRating > 0);
  if (active.length < 4) return null;

  const ratings = active.map((p) => p.fideRating).sort((a, b) => a - b);
  const q1 = ratings[Math.floor(ratings.length * 0.25)];
  const median = ratings[Math.floor(ratings.length * 0.5)];

  // If bottom 25% are >300 points below median, suggest a floor
  if (median - q1 > 300) {
    const suggestedFloor = Math.round(median / 100) * 100 - 200;
    return {
      type: 'floor',
      severity: 'info',
      message: `Amplia dispersión de ratings (Q1=${q1}, mediana=${median}). Considere floor de ${suggestedFloor} para emparejamientos más justos.`,
      suggestedFloor,
      lowCount: ratings.filter((r) => r < suggestedFloor).length,
    };
  }

  return null;
}

/**
 * Sugiere cambio de sistema si es apropiado
 */
function suggestSystem(players, config) {
  const n = players.filter((p) => !p.withdrawn).length;
  if (!config.system) return null;

  if (config.system !== 'burstein' && n >= 30 && config.nRounds <= 6) {
    return {
      type: 'system_change',
      severity: 'info',
      message: `${n} jugadores en ${config.nRounds} rondas. Sistema Burstein/Dubov daría menos flotaciones que ${config.system}.`,
      suggestedSystem: 'burstein',
    };
  }

  if (config.system === 'roundrobin' && n > 20) {
    return {
      type: 'system_change',
      severity: 'warning',
      message: `Round Robin con ${n} jugadores requiere ${n - 1} rondas. Considere Swiss (${config.system}).`,
      suggestedSystem: 'dutch',
    };
  }

  return null;
}

/**
 * Sugiere asignación manual de colores para balance
 */
function suggestColorAdjustment(players) {
  const imbalanced = players.filter((p) => Math.abs(p.colorDiff) >= 2 && !p.withdrawn);
  if (imbalanced.length === 0) return null;

  const worst = imbalanced.sort((a, b) => Math.abs(b.colorDiff) - Math.abs(a.colorDiff))[0];
  const needColor = worst.colorDiff > 0 ? 'negras' : 'blancas';

  return {
    type: 'color_adjustment',
    severity: 'warning',
    message: `${imbalanced.length} jugador(es) con desbalance de color ≥2. ${worst.name} necesita ${needColor} urgentemente.`,
    count: imbalanced.length,
    worstPlayer: worst.name,
  };
}

/**
 * Sugiere gestión de ratings extremos
 */
function suggestRatingManagement(players, rounds) {
  const active = players.filter((p) => !p.withdrawn);
  if (active.length < 4) return null;

  const ratings = active.map((p) => p.fideRating || 0);
  const max = Math.max(...ratings);
  const min = Math.min(...ratings);
  const range = max - min;
  const median = ratings.sort((a, b) => a - b)[Math.floor(ratings.length / 2)];

  if (range > 1000 && active.length < 20) {
    return {
      type: 'rating_range',
      severity: 'warning',
      message: `Rango de ratings extremo: ${min}-${max} (${range} pts). Considere separar en grupos por rating.`,
      range,
      minRating: min,
      maxRating: max,
      medianRating: median,
    };
  }

  if (range > 600) {
    return {
      type: 'rating_range',
      severity: 'info',
      message: `Rango amplio: ${min}-${max}. Revise que los floors estén configurados correctamente.`,
      range,
    };
  }

  return null;
}

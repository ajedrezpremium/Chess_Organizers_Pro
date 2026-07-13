/**
 * ratingCalculator.js
 * 
 * Calcula la variación de ELO FIDE esperada tras una partida.
 */

import { Result, RESULT_POINTS } from './types.js';

/**
 * Obtiene el K-Factor aplicable a un jugador según las reglas de la FIDE.
 * @param {Object} player
 * @returns {number}
 */
export function getKFactor(player) {
  // Reglas simplificadas de la FIDE para el factor de desarrollo (K)
  // K=40 para jugadores nuevos (menos de 30 partidas) o menores de 18 (asumido si no hay datos y rating bajo).
  // K=20 por defecto.
  // K=10 para jugadores que han alcanzado los 2400 de ELO.
  
  if (player.gamesPlayed !== undefined && player.gamesPlayed < 30) {
    return 40;
  }
  if (player.fideRating >= 2400 || (player.peakRating && player.peakRating >= 2400)) {
    return 10;
  }
  return 20; // Default FIDE K-factor for established players under 2400
}

/**
 * Calcula la puntuación esperada (We) basado en la diferencia de rating.
 * @param {number} ratingA 
 * @param {number} ratingB 
 * @returns {number}
 */
export function getExpectedScore(ratingA, ratingB) {
  // La diferencia de ELO se limita a 400 por regulaciones FIDE.
  let diff = ratingB - ratingA;
  if (diff > 400) diff = 400;
  if (diff < -400) diff = -400;
  
  return 1 / (1 + Math.pow(10, diff / 400));
}

/**
 * Calcula el cambio de ELO esperado para un jugador contra un oponente dado su resultado.
 * @param {number} playerRating 
 * @param {number} opponentRating 
 * @param {number} actualScore (1.0 = Win, 0.5 = Draw, 0.0 = Loss)
 * @param {number} kFactor 
 * @returns {number} Variación de ELO (positiva o negativa)
 */
export function calculateRatingChange(playerRating, opponentRating, actualScore, kFactor = 20) {
  if (!playerRating || !opponentRating) return 0; // Contra unrated, el cálculo básico estándar no aplica cambios (requiere bloque provisional)
  
  const expectedScore = getExpectedScore(playerRating, opponentRating);
  const change = kFactor * (actualScore - expectedScore);
  
  // Redondear a 1 decimal
  return Math.round(change * 10) / 10;
}

/**
 * Calcula los cambios de rating para un emparejamiento específico
 * @param {Object} player Blanca
 * @param {Object} opponent Negra
 * @param {string} result Result string enum
 * @returns {Object} { whiteChange, blackChange }
 */
export function getPairingRatingChange(player, opponent, result) {
  if (!player || !opponent || result === Result.BYE || result === Result.FULL_BYE || result === Result.HALF_BYE || result === Result.ZERO_BYE || result === Result.NOT_PLAYED) {
    return { whiteChange: 0, blackChange: 0 };
  }
  
  const whiteScore = RESULT_POINTS[result];
  if (whiteScore === undefined) return { whiteChange: 0, blackChange: 0 };
  
  const blackScore = 1.0 - whiteScore;
  
  const whiteK = getKFactor(player);
  const blackK = getKFactor(opponent);
  
  const whiteChange = calculateRatingChange(player.fideRating, opponent.fideRating, whiteScore, whiteK);
  const blackChange = calculateRatingChange(opponent.fideRating, player.fideRating, blackScore, blackK);
  
  return { whiteChange, blackChange };
}

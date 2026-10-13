/**
 * chess960.js — Generador de posiciones Chess960 (Fischer Random Chess)
 *
 * Implementa el algoritmo estándar para generar las 960 posiciones válidas:
 * - Rey entre las dos torres
 * - Alfiles en casillas de colores opuestos
 * - Caballos y reinas en las casillas restantes
 *
 * Basado en el algoritmo de Reinhard Scharnagl.
 */

// Piezas: R=Rey, T=Torres, A=Alfiles, C=Caballos, D=Dama
const PIECES = ['R', 'T', 'T', 'A', 'A', 'C', 'C', 'D'];

/**
 * Genera una posición Chess960 aleatoria (una de las 960 válidas)
 * @returns {string} Posición en notación FEN (solo primera fila, ej: "RNBQKBNR")
 */
export function generateChess960Position() {
  // Algoritmo de Scharnagl para generar una de las 960 posiciones uniformemente
  let position = [];

  // 1. Colocar los alfiles en casillas de colores opuestos
  // Casillas pares (0,2,4,6) = color claro, impares (1,3,5,7) = color oscuro
  const lightSquares = [0, 2, 4, 6];
  const darkSquares = [1, 3, 5, 7];

  const bishopLight = lightSquares[Math.floor(Math.random() * 4)];
  const bishopDark = darkSquares[Math.floor(Math.random() * 4)];

  position[bishopLight] = 'A';
  position[bishopDark] = 'A';

  // 2. Colocar la dama en una casilla vacía
  const emptySquares = position.map((p, i) => p ? null : i).filter((v) => v !== null);
  const queenPos = emptySquares[Math.floor(Math.random() * emptySquares.length)];
  position[queenPos] = 'D';

  // 3. Colocar los dos caballos en casillas vacías
  const emptyAfterQueen = position.map((p, i) => p ? null : i).filter((v) => v !== null);
  const knight1Pos = emptyAfterQueen[Math.floor(Math.random() * emptyAfterQueen.length)];
  position[knight1Pos] = 'C';

  const emptyAfterKnight1 = position.map((p, i) => p ? null : i).filter((v) => v !== null);
  const knight2Pos = emptyAfterKnight1[Math.floor(Math.random() * emptyAfterKnight1.length)];
  position[knight2Pos] = 'C';

  // 4. Colocar Rey y Torres: Rey DEBE estar entre las dos torres
  // Encontrar las 3 casillas vacías restantes
  const remainingEmpty = position.map((p, i) => p ? null : i).filter((v) => v !== null);
  remainingEmpty.sort((a, b) => a - b);

  // El rey va en la casilla del medio, torres en los extremos
  const kingPos = remainingEmpty[1];
  const rook1Pos = remainingEmpty[0];
  const rook2Pos = remainingEmpty[2];

  position[kingPos] = 'R';
  position[rook1Pos] = 'T';
  position[rook2Pos] = 'T';

  // Convertir a notación FEN estándar (R=King, Q=Queen, R=Rook, B=Bishop, N=Knight)
  const fenMap = { 'R': 'K', 'D': 'Q', 'T': 'R', 'A': 'B', 'C': 'N' };
  return position.map(p => fenMap[p]).join('');
}

/**
 * Obtiene una posición Chess960 específica por índice (0-959)
 * @param {number} index - Índice 0-959
 * @returns {string} Posición FEN
 */
export function getChess960PositionByIndex(index) {
  if (index < 0 || index > 959) throw new Error('Índice debe estar entre 0 y 959');

  // Tabla precalculada de las 960 posiciones (generada una vez)
  if (!getChess960PositionByIndex._cache) {
    getChess960PositionByIndex._cache = generateAllChess960Positions();
  }
  return getChess960PositionByIndex._cache[index];
}

/**
 * Genera todas las 960 posiciones Chess960 válidas (para caché)
 * @returns {string[]} Array de 960 posiciones FEN
 */
function generateAllChess960Positions() {
  const positions = [];

  // Generar todas las combinaciones válidas sistemáticamente
  // Alfiles: 4 casillas claras × 4 casillas oscuras = 16
  const lightSquares = [0, 2, 4, 6];
  const darkSquares = [1, 3, 5, 7];

  for (const bLight of lightSquares) {
    for (const bDark of darkSquares) {
      // Dama: 6 casillas restantes
      const occupied = [bLight, bDark];
      const emptyAfterBishops = [0,1,2,3,4,5,6,7].filter(i => !occupied.includes(i));

      for (const qPos of emptyAfterBishops) {
        const occupied2 = [...occupied, qPos];
        const emptyAfterQueen = [0,1,2,3,4,5,6,7].filter(i => !occupied2.includes(i));

        // Caballos: elegir 2 de 5 casillas = 10 combinaciones
        for (let i = 0; i < emptyAfterQueen.length; i++) {
          for (let j = i + 1; j < emptyAfterQueen.length; j++) {
            const k1 = emptyAfterQueen[i];
            const k2 = emptyAfterQueen[j];
            const occupied3 = [...occupied2, k1, k2];
            const remaining = [0,1,2,3,4,5,6,7].filter(x => !occupied3.includes(x));
            remaining.sort((a, b) => a - b);

            // Rey en medio, torres en extremos
            const kingPos = remaining[1];
            const rook1 = remaining[0];
            const rook2 = remaining[2];

            const pos = new Array(8);
            pos[bLight] = 'A'; pos[bDark] = 'A';
            pos[qPos] = 'D';
            pos[k1] = 'C'; pos[k2] = 'C';
            pos[kingPos] = 'R'; pos[rook1] = 'T'; pos[rook2] = 'T';

            const fenMap = { 'R': 'K', 'D': 'Q', 'T': 'R', 'A': 'B', 'C': 'N' };
            positions.push(pos.map(p => fenMap[p]).join(''));
          }
        }
      }
    }
  }

  // Verificar que tenemos exactamente 960
  if (positions.length !== 960) {
    throw new Error(`Se esperaban 960 posiciones, generadas: ${positions.length}`);
  }

  return positions;
}

/**
 * Convierte una posición Chess960 a notación completa FEN inicial
 * @param {string} position960 - Posición primera fila (ej: "RNBQKBNR")
 * @returns {string} FEN completo
 */
export function chess960ToFullFEN(position960) {
  // Peones blancos en fila 2, peones negros en fila 7
  return `${position960.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${position960} w KQkq - 0 1`;
}

/**
 * Obtiene información legible de una posición Chess960
 * @param {string} position960
 * @returns {Object} { index, position, fen }
 */
export function getChess960Info(position960) {
  const all = generateAllChess960Positions();
  const index = all.indexOf(position960);
  return {
    index: index >= 0 ? index : null,
    position: position960,
    fen: chess960ToFullFEN(position960),
    isStandard: position960 === 'RNBQKBNR'
  };
}

/**
 * Valida si una posición es Chess960 válida
 * @param {string} position
 * @returns {boolean}
 */
export function isValidChess960(position) {
  if (!position || position.length !== 8) return false;
  const counts = { K: 0, Q: 0, R: 0, B: 0, N: 0 };
  for (const c of position) {
    if (!counts.hasOwnProperty(c)) return false;
    counts[c]++;
  }
  if (counts.K !== 1 || counts.Q !== 1 || counts.R !== 2 || counts.B !== 2 || counts.N !== 2) return false;

  // Rey entre torres
  const k = position.indexOf('K');
  const r1 = position.indexOf('R');
  const r2 = position.lastIndexOf('R');
  if (!(r1 < k && k < r2)) return false;

  // Alfiles en colores opuestos
  const b1 = position.indexOf('B');
  const b2 = position.lastIndexOf('B');
  if ((b1 % 2) === (b2 % 2)) return false;

  return true;
}

export default {
  generateChess960Position,
  getChess960PositionByIndex,
  generateAllChess960Positions,
  chess960ToFullFEN,
  getChess960Info,
  isValidChess960
};
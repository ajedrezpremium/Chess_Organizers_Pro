/**
 * types.js
 *
 * Definiciones de tipos para el motor de emparejamientos.
 * Sin dependencias externas — puro JS.
 *
 * Estas estructuras son el contrato entre:
 *   - El motor de pairings (puro, sin React)
 *   - El componente React <Pairings> (UI)
 *   - El CLI (Free Pairings Checker y RTG para FIDE)
 *   - El formato TRF-2025
 */

// ── Colores ───────────────────────────────────────────────────────────────────

/** @enum {string} */
export const Color = {
  WHITE: 'W',
  BLACK: 'B',
  NONE:  '-',  // bye / no color
};

// ── Resultados ────────────────────────────────────────────────────────────────

/** @enum {string} */
export const Result = {
  WHITE_WIN:  '1',   // 1-0
  BLACK_WIN:  '0',   // 0-1
  DRAW:       '=',   // ½-½
  BYE:        'U',   // bye (½ punto)
  FULL_BYE:   'F',   // full-point bye (1 punto, por incomparecencia rival)
  HALF_BYE:   'H',   // half-point bye solicitado
  ZERO_BYE:   'Z',   // cero-point bye
  NOT_PLAYED: '-',   // no jugada (forfeit sin punto)
};

/** Puntos que otorga cada resultado al jugador con color WHITE (o al jugador 1 en un bye) */
export const RESULT_POINTS = {
  [Result.WHITE_WIN]:  1.0,
  [Result.BLACK_WIN]:  0.0,
  [Result.DRAW]:       0.5,
  [Result.BYE]:        0.5,
  [Result.FULL_BYE]:   1.0,
  [Result.HALF_BYE]:   0.5,
  [Result.ZERO_BYE]:   0.0,
  [Result.NOT_PLAYED]: 0.0,
};

/** Puntos que otorga cada resultado al jugador con color BLACK */
export const RESULT_POINTS_BLACK = {
  [Result.WHITE_WIN]:  0.0,
  [Result.BLACK_WIN]:  1.0,
  [Result.DRAW]:       0.5,
};

// ── Jugador ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Player
 * @property {string}   id          — ID único (igual al usado en Firestore)
 * @property {string}   name        — Nombre
 * @property {string}   lastName    — Apellido
 * @property {number}   fideRating  — ELO FIDE (0 si no tiene)
 * @property {string}   title       — GM | IM | WGM | FM | WIM | CM | WFM | NM | ''
 * @property {string}   country     — Código ISO 3166-1 alpha-3 (NOR, ESP, USA…)
 * @property {string}   fideid      — ID FIDE (puede ser vacío)
 * @property {number}   points      — Puntos acumulados (calculado, no persiste)
 * @property {number}   colorDiff   — Diferencia de colores acumulada (B-W)
 * @property {Color[]}  colorHistory — Color jugado en cada ronda
 * @property {string[]} opponents   — IDs de rivales en orden de rondas
 * @property {boolean}  withdrawn   — Si se ha retirado del torneo
 * @property {boolean}  receivedBye — Si ya ha recibido un bye
 */

/**
 * Crea un jugador con valores por defecto seguros.
 * @param {Partial<Player>} data
 * @returns {Player}
 */
export function createPlayer(data) {
  return {
    id:           data.id           ?? '',
    name:         data.name         ?? '',
    lastName:     data.lastName     ?? '',
    fideRating:   data.fideRating   ?? 0,
    title:        data.title        ?? '',
    country:      data.country      ?? '',
    fideid:       data.fideid        ?? '',
    points:       data.points       ?? 0,
    colorDiff:    data.colorDiff    ?? 0,
    colorHistory: data.colorHistory ?? [],
    opponents:    data.opponents    ?? [],
    withdrawn:    data.withdrawn    ?? false,
    receivedBye:  data.receivedBye  ?? false,
    ...Object.fromEntries(
      Object.entries(data).filter(([k]) => ![
        'id','name','lastName','fideRating','title','country',
        'fideid','points','colorDiff','colorHistory','opponents',
        'withdrawn','receivedBye'
      ].includes(k))
    ),
  };
}

// ── Partida (pairing individual) ──────────────────────────────────────────────

/**
 * @typedef {Object} Pairing
 * @property {number}  board      — Número de tablero (1-based)
 * @property {string}  whiteId    — ID del jugador con blancas
 * @property {string}  blackId    — ID del jugador con negras ('' si es bye)
 * @property {Result}  result     — Resultado de la partida
 * @property {boolean} isBye      — true si es un bye (número impar de jugadores)
 */

/**
 * @param {Partial<Pairing>} data
 * @returns {Pairing}
 */
export function createPairing(data) {
  return {
    board:   data.board   ?? 0,
    whiteId: data.whiteId ?? '',
    blackId: data.blackId ?? '',
    result:  data.result  ?? Result.NOT_PLAYED,
    isBye:   data.isBye   ?? false,
  };
}

// ── Ronda ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Round
 * @property {number}    number    — Número de ronda (1-based)
 * @property {Pairing[]} pairings  — Lista de partidas
 * @property {boolean}   published — Si los emparejamientos están publicados
 * @property {boolean}   closed    — Si la ronda está cerrada (todos los resultados)
 */

/**
 * @param {Partial<Round>} data
 * @returns {Round}
 */
export function createRound(data) {
  return {
    number:    data.number    ?? 0,
    pairings:  data.pairings  ?? [],
    published: data.published ?? false,
    closed:    data.closed    ?? false,
  };
}

// ── Torneo ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TournamentConfig
 * @property {string}  id
 * @property {string}  name
 * @property {string}  system        — 'dutch' | 'dubov' | 'burstein' | 'roundrobin'
 * @property {number}  nRounds
 * @property {string}  timeControl
 * @property {boolean} rated
 * @property {string}  federation    — Código de federación (ESP, USA…)
 * @property {string}  startDate     — ISO 8601
 * @property {string}  endDate       — ISO 8601
 * @property {string}  arbiter       — Nombre del árbitro principal
 * @property {string[]} tiebreaks    — Orden de desempates aplicados
 */

// ── Desempates FIDE (obligatorios en TRF-2025) ───────────────────────────────

/** @enum {string} */
export const Tiebreak = {
  BUCHHOLZ:            'BH',   // Buchholz completo
  BUCHHOLZ_CUT1:       'BH1',  // Buchholz menos el peor resultado
  BUCHHOLZ_CUT2:       'BH2',
  MEDIAN_BUCHHOLZ:     'MB',   // Buchholz mediano (recorta mejor y peor)
  SONNEBORN_BERGER:    'SB',   // Sonneborn-Berger
  ARO:                 'AR',   // Average Rating of Opponents
  ARO_CUT1:            'AR1',
  DIRECT_ENCOUNTER:    'DE',   // Resultado directo entre empatados
  PROGRESSIVE:         'PR',   // Puntuación progresiva (suma de puntos ronda a ronda)
  KOYA:                'KY',   // Sistema Koya
  WINS:                'W',    // Número de victorias
  WINS_WITH_BLACK:     'WB',   // Victorias con negras
  GAMES_WITH_BLACK:    'GB',   // Partidas con negras
  RATING_PERFORMANCE:  'RP',   // Rendimiento ELO
};

// Orden de desempates por defecto según FIDE Handbook C.04 (2025)
export const DEFAULT_TIEBREAK_ORDER = [
  Tiebreak.BUCHHOLZ_CUT1,
  Tiebreak.BUCHHOLZ,
  Tiebreak.SONNEBORN_BERGER,
  Tiebreak.DIRECT_ENCOUNTER,
  Tiebreak.PROGRESSIVE,
  Tiebreak.KOYA,
  Tiebreak.ARO,
  Tiebreak.WINS,
  Tiebreak.WINS_WITH_BLACK,
];

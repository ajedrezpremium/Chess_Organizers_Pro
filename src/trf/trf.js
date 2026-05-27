/**
 * trf.js — Parser y serializador del formato TRF-2025
 *
 * Implementa la especificación TRF16 (base) más las extensiones TRF-2025
 * definidas por la Comisión Técnica FIDE (tec.fide.com):
 *
 *   Código 012  — Nombre del torneo
 *   Código 013  — Tipo de torneo (sustituido por 310 en TRF-2025)
 *   Código 022  — Ciudad
 *   Código 032  — Federación
 *   Código 042  — Fecha inicio
 *   Código 052  — Fecha fin
 *   Código 062  — Número de jugadores
 *   Código 072  — Número de árbitros evaluados
 *   Código 082  — Tiempo de juego
 *   Código 092  — Tipo de torneo (NUEVO TRF-2025: código de tipo)
 *   Código 102  — Árbitro jefe
 *   Código 112  — Árbitro adjunto
 *   Código 122  — Director del equipo (torneos por equipos)
 *   Código 132  — Rondas
 *   Código 202  — Lista de desempates (NUEVO TRF-2025)
 *   Código 212  — Lista de desempates alternativos (NUEVO TRF-2025)
 *   Código 250  — Aceleración Baku (NUEVO TRF-2025)
 *   Código 310  — Tipo de torneo extendido (reemplaza 013, NUEVO TRF-2025)
 *   Código 001  — Datos de jugador
 *   Código 0XX  — Líneas de jugador con resultados
 *
 * Sin dependencias externas. Puro JS.
 */

import { Color, Result, createPlayer, createPairing, createRound } from '../engine/types.js';

// ── Constantes de formato TRF ─────────────────────────────────────────────────

const LINE_LENGTH = 89; // Ancho mínimo de línea TRF16

// Mapa de códigos TRF → colores
const TRF_COLOR_MAP = { w: Color.WHITE, b: Color.BLACK, '-': Color.NONE, '': Color.NONE };
const COLOR_TO_TRF  = { [Color.WHITE]: 'w', [Color.BLACK]: 'b', [Color.NONE]: '-' };

// Mapa de resultados TRF → Result enum
const TRF_RESULT_MAP = {
  '1': Result.WHITE_WIN, '0': Result.BLACK_WIN, '=': Result.DRAW,
  'U': Result.BYE,       'F': Result.FULL_BYE,  'H': Result.HALF_BYE,
  'Z': Result.ZERO_BYE,  '-': Result.NOT_PLAYED, '+': Result.FULL_BYE,
};
const RESULT_TO_TRF = {
  [Result.WHITE_WIN]:  '1', [Result.BLACK_WIN]:  '0', [Result.DRAW]:       '=',
  [Result.BYE]:        'U', [Result.FULL_BYE]:   'F', [Result.HALF_BYE]:   'H',
  [Result.ZERO_BYE]:   'Z', [Result.NOT_PLAYED]: '-',
};

// ── Utilidades de texto ───────────────────────────────────────────────────────

function pad(str, length, align = 'left') {
  const s = String(str ?? '');
  if (align === 'right') return s.padStart(length);
  return s.padEnd(length);
}

function parseField(line, start, length) {
  return (line.substring(start, start + length) ?? '').trim();
}

// ── Parse TRF → modelo interno ────────────────────────────────────────────────

/**
 * Parsea un archivo TRF completo (string) y retorna el modelo interno.
 *
 * @param {string} content — Contenido del archivo TRF
 * @returns {{ config: object, players: Player[], rounds: Round[], warnings: string[] }}
 */
export function parseTRF(content) {
  const lines    = content.split(/\r?\n/);
  const config   = {};
  const warnings = [];
  const playerMap = new Map();   // startRank → datos parciales
  let   nRounds  = 0;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const code = rawLine.substring(0, 3).trim();
    const data = rawLine.substring(4).trimEnd();

    switch (code) {
      case '012': config.name        = data; break;
      case '022': config.city        = data; break;
      case '032': config.federation  = data; break;
      case '042': config.startDate   = data; break;
      case '052': config.endDate     = data; break;
      case '062': config.playerCount = parseInt(data, 10); break;
      case '082': config.timeControl = data; break;
      case '092': config.tournamentTypeCode = data.trim(); break;  // TRF-2025
      case '102': config.chiefArbiter      = data; break;
      case '112': config.deputyArbiter     = data; break;
      case '132': nRounds = parseInt(data, 10); config.nRounds = nRounds; break;

      // TRF-2025: lista de desempates
      case '202':
        config.tiebreaks = data.trim().split(/\s+/).filter(Boolean);
        break;
      case '212':
        config.altTiebreaks = data.trim().split(/\s+/).filter(Boolean);
        break;

      // TRF-2025: aceleración Baku
      case '250':
        config.acceleration = parseAcceleration(data);
        break;

      // TRF-2025: tipo de torneo extendido
      case '310':
        config.extendedType = data.trim();
        break;

      // Datos de jugador
      case '001': {
        const player = parsePlayerLine(rawLine, warnings);
        if (player) playerMap.set(player._startRank, player);
        break;
      }

      default:
        if (/^\d{3}$/.test(code)) {
          warnings.push(`Código TRF desconocido: ${code}`);
        }
    }
  }

  // Reconstruir rondas desde los datos de jugador
  const players = [...playerMap.values()];
  const rounds  = buildRoundsFromPlayers(players, nRounds, warnings);

  // Limpiar campo interno
  for (const p of players) delete p._startRank;

  return { config, players, rounds, warnings };
}

// ── Parse de línea de jugador ─────────────────────────────────────────────────

/**
 * Parsea una línea de jugador TRF16/TRF-2025.
 *
 * Formato (columnas 1-based):
 *  Col  1–  3 : código "001"
 *  Col  5–  8 : número de inicio (startRank)
 *  Col  9     : sexo
 *  Col 10– 13 : título
 *  Col 15– 47 : nombre (apellido, nombre)
 *  Col 49– 52 : rating FIDE
 *  Col 54– 56 : federación
 *  Col 58– 68 : ID FIDE
 *  Col 70– 79 : fecha de nacimiento
 *  Col 81– 84 : puntos
 *  Col 85– 88 : posición en el ranking
 *  Col 91+    : resultados de rondas (grupos de 8 columnas)
 *
 * Nota: los índices JS son 0-based.
 */
function parsePlayerLine(line, warnings) {
  if (!line || line.substring(0, 3) !== '001') return null;

  const startRank  = parseInt(parseField(line, 4, 4), 10);
  const title      = parseField(line, 9, 3);
  const fullName   = parseField(line, 14, 33);
  const [lastName, firstName] = fullName.includes(',')
    ? fullName.split(',').map((s) => s.trim())
    : [fullName, ''];
  const fideRating = parseInt(parseField(line, 48, 4), 10) || 0;
  const country    = parseField(line, 53, 3);
  const fideid     = parseField(line, 57, 11);
  const points     = parseFloat(parseField(line, 80, 4)) || 0;

  // Resultados de rondas (a partir de col 91, grupos de 8 columnas)
      const roundResults = [];
      let col = 90; // índice 0-based (col 91 1-based según TRF16)
      while (col + 9 <= line.length) {
        const chunk     = line.substring(col, col + 9);
        const oppRank   = parseInt(chunk.substring(1, 5).trim(), 10) || null;
        const colorChar = chunk[6]?.toLowerCase() ?? '-';
        const resultChar = chunk[8] ?? '-';

        roundResults.push({
          opponentStartRank: oppRank,
          color:  TRF_COLOR_MAP[colorChar]  ?? Color.NONE,
          result: TRF_RESULT_MAP[resultChar] ?? Result.NOT_PLAYED,
        });
        col += 9;
      }

  return {
    id:           fideid || String(startRank),
    name:         firstName,
    lastName,
    fideRating,
    title,
    country,
    fideid,
    points,
    colorHistory: roundResults.map((r) => r.color),
    colorDiff:    roundResults.reduce((d, r) => {
      if (r.color === Color.WHITE) return d + 1;
      if (r.color === Color.BLACK) return d - 1;
      return d;
    }, 0),
    opponents:    [],  // se resuelve en buildRoundsFromPlayers
    receivedBye:  roundResults.some((r) =>
      r.result === Result.BYE ||
      r.result === Result.FULL_BYE ||
      r.result === Result.HALF_BYE
    ),
    withdrawn:    false,
    _startRank:   startRank,
    _roundResults: roundResults,
  };
}

// ── Reconstrucción de rondas ──────────────────────────────────────────────────

function buildRoundsFromPlayers(players, nRounds, warnings) {
  const startRankToPlayer = new Map(players.map((p) => [p._startRank, p]));
  const rounds = [];

  for (let r = 0; r < nRounds; r++) {
    const pairingsInRound = [];
    const seenPairs = new Set();

    for (const player of players) {
      const rr = player._roundResults?.[r];
      if (!rr || rr.color === Color.NONE) continue;

      // Solo procesar blancas para no duplicar la partida
      if (rr.color !== Color.WHITE) continue;

      const opp = rr.opponentStartRank
        ? startRankToPlayer.get(rr.opponentStartRank)
        : null;

      const pairKey = [player._startRank, rr.opponentStartRank ?? 0].sort().join('-');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      // Resolver IDs de oponentes
      if (opp) {
        player.opponents.push(opp.id);
        opp.opponents.push(player.id);
      }

      pairingsInRound.push(createPairing({
        board:   pairingsInRound.length + 1,
        whiteId: player.id,
        blackId: opp?.id ?? '',
        result:  rr.result,
        isBye:   !opp,
      }));
    }

    // Añadir byes explícitos (negras con resultado U/F/H/Z)
    for (const player of players) {
      const rr = player._roundResults?.[r];
      if (!rr) continue;
      if ([Result.BYE, Result.FULL_BYE, Result.HALF_BYE, Result.ZERO_BYE].includes(rr.result)) {
        const alreadyAdded = pairingsInRound.some((p) => p.whiteId === player.id);
        if (!alreadyAdded) {
          pairingsInRound.push(createPairing({
            board:   pairingsInRound.length + 1,
            whiteId: player.id,
            blackId: '',
            result:  rr.result,
            isBye:   true,
          }));
        }
      }
    }

    rounds.push(createRound({
      number:    r + 1,
      pairings:  pairingsInRound,
      published: true,
      closed:    true,
    }));
  }

  // Limpiar campo interno
  for (const p of players) delete p._roundResults;

  return rounds;
}

// ── Parse de aceleración ──────────────────────────────────────────────────────

function parseAcceleration(data) {
  // Formato: "ROUND:THRESHOLD ROUND:THRESHOLD ..."
  return data.trim().split(/\s+/).map((chunk) => {
    const [round, threshold] = chunk.split(':').map(Number);
    return { round, threshold };
  }).filter((a) => !isNaN(a.round) && !isNaN(a.threshold));
}

// ── Serializar → TRF ─────────────────────────────────────────────────────────

/**
 * Serializa el modelo interno a formato TRF-2025.
 *
 * @param {object}   config    — TournamentConfig
 * @param {Player[]} players   — Jugadores con historial completo
 * @param {Round[]}  rounds    — Rondas completadas
 * @returns {string}           — Contenido del archivo TRF
 */
export function serializeTRF(config, players, rounds) {
  const lines = [];

  // ── Cabecera ─────────────────────────────────────────────────────
  if (config.name)         lines.push(`012 ${config.name}`);
  if (config.city)         lines.push(`022 ${config.city}`);
  if (config.federation)   lines.push(`032 ${config.federation}`);
  if (config.startDate)    lines.push(`042 ${config.startDate}`);
  if (config.endDate)      lines.push(`052 ${config.endDate}`);
  lines.push(`062 ${players.length}`);
  if (config.timeControl)  lines.push(`082 ${config.timeControl}`);

  // TRF-2025: código de tipo de torneo
  if (config.tournamentTypeCode) lines.push(`092 ${config.tournamentTypeCode}`);

  if (config.chiefArbiter)  lines.push(`102 ${config.chiefArbiter}`);
  if (config.deputyArbiter) lines.push(`112 ${config.deputyArbiter}`);
  lines.push(`132 ${rounds.length}`);

  // TRF-2025: desempates (obligatorio si se solicita endorsement)
  if (config.tiebreaks?.length) {
    lines.push(`202 ${config.tiebreaks.join(' ')}`);
  }
  if (config.altTiebreaks?.length) {
    lines.push(`212 ${config.altTiebreaks.join(' ')}`);
  }

  // TRF-2025: aceleración Baku
  if (config.acceleration?.length) {
    const accStr = config.acceleration
      .map((a) => `${a.round}:${a.threshold}`)
      .join(' ');
    lines.push(`250 ${accStr}`);
  }

  // TRF-2025: tipo extendido
  if (config.extendedType) {
    lines.push(`310 ${config.extendedType}`);
  }

  // ── Líneas de jugadores ───────────────────────────────────────────
  // Construir mapa startRank: ordenados por ELO desc para asignar ranks
  const sortedPlayers = [...players].sort(
    (a, b) => (b.fideRating ?? 0) - (a.fideRating ?? 0)
  );
  const startRankMap = new Map(sortedPlayers.map((p, i) => [p.id, i + 1]));

  // Construir mapa de resultados por jugador y ronda
  const resultsByPlayerRound = new Map();
  for (const [ri, round] of rounds.entries()) {
    for (const pairing of round.pairings) {
      if (!resultsByPlayerRound.has(pairing.whiteId)) {
        resultsByPlayerRound.set(pairing.whiteId, []);
      }
      if (!resultsByPlayerRound.has(pairing.blackId)) {
        resultsByPlayerRound.set(pairing.blackId, []);
      }
      resultsByPlayerRound.get(pairing.whiteId)[ri] = {
        color: Color.WHITE, result: pairing.result,
        oppId: pairing.blackId, isBye: pairing.isBye,
      };
      if (!pairing.isBye) {
        resultsByPlayerRound.get(pairing.blackId)[ri] = {
          color: Color.BLACK,
          result: pairing.result === Result.WHITE_WIN ? Result.BLACK_WIN
                : pairing.result === Result.BLACK_WIN ? Result.WHITE_WIN
                : pairing.result,
          oppId: pairing.whiteId, isBye: false,
        };
      }
    }
  }

  for (const [playerRank, player] of sortedPlayers.entries()) {
    const rank   = playerRank + 1;
    const name   = player.lastName
      ? `${player.lastName}, ${player.name}`.substring(0, 33)
      : player.name.substring(0, 33);
    const rating = pad(player.fideRating || '', 4, 'right');
    const fed    = pad(player.country || '', 3);
    const fideid = pad(player.fideid || '', 11);
    const pts    = pad((player.points ?? 0).toFixed(1), 4, 'right');
    const rankStr = pad(rank, 4, 'right');

    // Construir resultados de rondas
    let roundStr = '';
    const playerResults = resultsByPlayerRound.get(player.id) ?? [];
    for (let ri = 0; ri < rounds.length; ri++) {
      const rr = playerResults[ri];
      if (!rr) {
        roundStr += '         '; // 9 espacios = ronda no jugada
        continue;
      }
      const oppRank = rr.isBye ? '0000' : pad(startRankMap.get(rr.oppId) ?? 0, 4, 'right');
      const colorC  = COLOR_TO_TRF[rr.color] ?? '-';
      const resultC = RESULT_TO_TRF[rr.result] ?? '-';
      // Formato: " RRRR c R" (space + 4 rank + space + color + space + result)
      roundStr += ` ${oppRank} ${colorC} ${resultC}`;
    }

    // Línea TRF16 completa (columnas 1-based según standard FIDE)
    const line = [
      '001',                     // col 1-3
      ' ',                       // col 4
      pad(rank, 4, 'right'),     // col 5-8  (start rank)
      ' ',                       // col 9    (sexo)
      pad(player.title || '', 4),// col 10-13 (título, 4 chars)
      ' ',                       // col 14
      pad(name, 33),             // col 15-47 (nombre)
      ' ',                       // col 48
      rating,                    // col 49-52 (rating)
      ' ',                       // col 53
      fed,                       // col 54-56 (federación)
      ' ',                       // col 57
      fideid,                    // col 58-68 (FIDE ID)
      ' ',                       // col 69
      pad('', 10),               // col 70-79 (fecha nacimiento)
      ' ',                       // col 80
      pts,                       // col 81-84 (puntos)
      ' ',                       // col 85
      rankStr,                   // col 86-89 (posición)
      ' ',                       // col 90
      roundStr,                  // col 91+
    ].join('');

    lines.push(line);
  }

  return lines.join('\n') + '\n';
}

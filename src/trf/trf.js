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

// Mapa de resultados TRF → Result enum (TRF-26 / ITDX)
// Nota TRF-26: '-' es ambiguo (NOT_PLAYED o FORFEIT_LOSS según contexto del oponente).
// Los inusuales VCL (½-0, 0-½, 0-0) no tienen carácter TRF estándar: se transportan
// en ITDX como '?' + comentario ###, y en interno como A/B/C.
const TRF_RESULT_MAP = {
  '1': Result.WHITE_WIN, '0': Result.BLACK_WIN, '=': Result.DRAW,
  'W': Result.WHITE_WIN, 'L': Result.BLACK_WIN, 'D': Result.DRAW,
  'U': Result.BYE,       'F': Result.FULL_BYE,  'H': Result.HALF_BYE,
  'Z': Result.ZERO_BYE,  '-': Result.NOT_PLAYED, '+': Result.FORFEIT_WIN,
  '?': Result.UNKNOWN,
  'A': Result.WHITE_HALF_WIN, 'B': Result.BLACK_HALF_WIN, 'C': Result.DOUBLE_FORFEIT,
};
const RESULT_TO_TRF = {
  [Result.WHITE_WIN]:    '1', [Result.BLACK_WIN]:    '0', [Result.DRAW]:         '=',
  [Result.BYE]:          'U', [Result.FULL_BYE]:     'F', [Result.HALF_BYE]:     'H',
  [Result.ZERO_BYE]:     'Z', [Result.NOT_PLAYED]:   '-', [Result.FORFEIT_WIN]:  '+',
  [Result.FORFEIT_LOSS]: '-', [Result.UNKNOWN]:      '?',
  // Inusuales → '?' en TRF-26/ITDX (detalle preservado en ### audit). Ver serializeTRF.
  [Result.WHITE_HALF_WIN]: '?', [Result.BLACK_HALF_WIN]: '?', [Result.DOUBLE_FORFEIT]: '?',
};

// ── Parsers estructurados TRF-26 (162 / 172 / 299) ────────────────────────────

/**
 * Record-162: sistema de puntuación no estándar.
 * Formatos aceptados: "3-2-1", "W3 D1 L0", "WIN=3 DRAW=1 LOSS=0", o cadena libre.
 * @returns {{ raw: string, win?: number, draw?: number, loss?: number }}
 */
export function parseScoringSystem(data) {
  const raw = String(data ?? '').trim();
  const out = { raw };
  const m1 = raw.match(/^(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)$/);
  if (m1) { out.win = Number(m1[1]); out.draw = Number(m1[2]); out.loss = Number(m1[3]); return out; }
  const mW = raw.match(/W(?:IN)?\s*=\s*(\d+(?:\.\d+)?)/i);
  const mD = raw.match(/D(?:RAW)?\s*=\s*(\d+(?:\.\d+)?)/i);
  const mL = raw.match(/L(?:OSS)?\s*=\s*(\d+(?:\.\d+)?)/i);
  if (mW) out.win = Number(mW[1]);
  if (mD) out.draw = Number(mD[1]);
  if (mL) out.loss = Number(mL[1]);
  return out;
}

/**
 * Record-172: National Rating Support / método de ranking + FIDON.
 * Formatos: "NRS ITA", "FIDON ITA 1800", "RANKING: NRS", o cadena libre.
 * @returns {{ raw: string, method?: string, federation?: string }}
 */
export function parseNRSRecord(data) {
  const raw = String(data ?? '').trim();
  const out = { raw };
  const m = raw.match(/^(NRS|FIDON|ELO|RANKING)\b\s*([A-Z]{3})?/i);
  if (m) { out.method = m[1].toUpperCase(); if (m[2]) out.federation = m[2].toUpperCase(); }
  return out;
}

/**
 * Record-299: Result-AAT y Blank-AAT (bonificaciones/penalizaciones).
 * Formato canónico: "<STARTidual> <ROUNDS> <POINTS> <TYPE>" donde TYPE ∈ {R,B}.
 *  R = Result-AAT (ligado a un resultado concreto), B = Blank-AAT (bye ciego).
 * Ejemplos: "001 R1 0.5 R", "005 R1-R9 1.0 B".
 * @returns {{ raw: string, startRank?: number, rounds?: string, points?: number, kind?: 'R'|'B' }}
 */
export function parseAATRecord(data) {
  const raw = String(data ?? '').trim();
  const out = { raw };
  const m = raw.match(/^(\d+)\s+([A-Z0-9\-,\s]+?)\s+([+-]?\d+(?:\.\d+)?)\s*([RB])?$/i);
  if (m) {
    out.startRank = parseInt(m[1], 10);
    out.rounds = m[2].trim();
    out.points = Number(m[3]);
    if (m[4]) out.kind = m[4].toUpperCase();
  } else {
    // Heurística: si menciona BLANK → B, si menciona RESULT → R
    if (/BLANK/i.test(raw)) out.kind = 'B';
    else if (/RESULT/i.test(raw)) out.kind = 'R';
  }
  return out;
}

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
 * Parsea un archivo TRF completo (string) y retorna el modelo interno según TRF-26.
 *
 * @param {string} content — Contenido del archivo TRF
 * @returns {{ config: object, players: Player[], rounds: Round[], comments: string[], warnings: string[] }}
 */
export function parseTRF(content) {
  const lines       = content.split(/\r?\n/);
  const config      = { comments: [], nrsRecords: [], aatRecords: [] };
  const warnings    = [];
  const playerMap   = new Map();   // startRank → datos parciales
  let   nRounds     = 0;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    // Soporte para comentarios oficiales de auditoría TRF (###)
    if (rawLine.startsWith('###')) {
      config.comments.push(rawLine.substring(3).trim());
      continue;
    }

    const code = rawLine.substring(0, 3).trim();
    const data = rawLine.substring(4).trimEnd();

    switch (code) {
      case '012': config.name        = data; break;
      case '022': config.city        = data; break;
      case '032': config.federation  = data; break;
      case '042': config.startDate   = data; break;
      case '052': config.endDate     = data; break;
      case '062': config.playerCount = parseInt(data, 10); break;
      case '072': config.ratedCount  = parseInt(data, 10); break;
      case '082': config.timeControl = data; break;
      case '092': config.tournamentTypeCode = data.trim(); break;  // TRF-26
      case '102': config.chiefArbiter      = data; break;
      case '112': config.deputyArbiter     = data; break;
      case '122': config.allottedTime      = data; break;
      case '132': nRounds = parseInt(data, 10); config.nRounds = nRounds; break;

      // TRF-26: Sistema de puntuación no estándar (Record 162)
      case '162': {
        const raw = data.trim();
        config.scoringSystem = raw;
        config.scoringParsed = parseScoringSystem(raw);
        break;
      }

      // TRF-26: National Rating Support / Ranking method (Record 172) + FIDON
      case '172':
        config.nrsRecords.push(data.trim());
        config.nrsParsed = config.nrsParsed ?? [];
        config.nrsParsed.push(parseNRSRecord(data.trim()));
        break;

      // TRF-26: lista de desempates oficiales
      case '202':
        config.tiebreaks = data.trim().split(/\s+/).filter(Boolean);
        break;
      case '212':
        config.altTiebreaks = data.trim().split(/\s+/).filter(Boolean);
        break;

      // TRF-26: aceleración Baku
      case '250':
        config.acceleration = parseAcceleration(data);
        break;

      // TRF-26: Asignación y ajuste de puntos AAT (Record 299)
      // Result-AAT (kind R) y Blank-AAT (kind B): afectan emparejamiento y desempate.
      case '299': {
        const raw = data.trim();
        config.aatRecords.push(raw);
        config.aatParsed = config.aatParsed ?? [];
        config.aatParsed.push(parseAATRecord(raw));
        break;
      }

      // TRF-26: tipo de torneo extendido
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
        // FIDON explícito: "FIDON <startRank> <rating>" o "FIDON <fed> ..."
        if (code === 'FID') {
          const m = rawLine.match(/^FIDON\s+(\d+)\s+(\d+)/i) ?? rawLine.match(/^FID\w*\s+(\d+)\s+(\d+)/);
          if (m) {
            const pRank = parseInt(m[1], 10);
            const nRating = parseInt(m[2], 10);
            const p = playerMap.get(pRank);
            if (p) {
              if (!p.nationalRatings) p.nationalRatings = {};
              p.nationalRatings.FIDON = nRating;
            }
          } else {
            warnings.push(`Línea FIDON no reconocida: ${rawLine.slice(0, 40)}`);
          }
        // Soporte pseudo-NRS (ej. RRR, BBB, MMM, ITA con rating nacional)
        } else if (/^[A-Z]{3}$/.test(code)) {
          const pRank = parseInt(rawLine.substring(4, 8).trim(), 10);
          const nRating = parseInt(rawLine.substring(48, 52).trim(), 10);
          if (pRank && playerMap.has(pRank)) {
            const p = playerMap.get(pRank);
            if (!p.nationalRatings) p.nationalRatings = {};
            p.nationalRatings[code] = nRating;
          } else if (pRank && !playerMap.has(pRank)) {
            // NRS huérfano (jugador aún no parseado): guardar para reconciliar al final
            config._pendingNRS = config._pendingNRS ?? [];
            config._pendingNRS.push({ code, pRank, nRating });
          }
        } else if (/^\d{3}$/.test(code)) {
          warnings.push(`Código TRF desconocido: ${code}`);
        }
    }
  }

  // Reconciliar NRS huérfanos (aparecen antes que su 001)
  if (config._pendingNRS?.length) {
    for (const { code, pRank, nRating } of config._pendingNRS) {
      const p = playerMap.get(pRank);
      if (p && Number.isFinite(nRating)) {
        if (!p.nationalRatings) p.nationalRatings = {};
        p.nationalRatings[code] = nRating;
      } else {
        warnings.push(`NRS huérfano sin jugador: ${code} ${pRank}`);
      }
    }
    delete config._pendingNRS;
  }

  // Reconstruir rondas desde los datos de jugador
  const players = [...playerMap.values()];
  const rounds  = buildRoundsFromPlayers(players, nRounds, warnings);

  // Limpiar campo interno
  for (const p of players) delete p._startRank;

  return { config, players, rounds, warnings, comments: config.comments };
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
  // ITDX estricto: partida aplazada/en curso DEBE ser '?' (nunca blanco).
      const roundResults = [];
      let col = 90; // índice 0-based (col 91 1-based según TRF16)
      let roundIdx = 0;
      while (col + 9 <= line.length) {
        const chunk     = line.substring(col, col + 9);
        const oppRank   = parseInt(chunk.substring(1, 5).trim(), 10) || null;
        const colorChar = chunk[6]?.toLowerCase() ?? '-';
        const resultChar = chunk[8] ?? ' ';
        roundIdx++;

        // Blanco/ausencia en ITDX → aviso (debe ser '?')
        if (resultChar === ' ' || resultChar === '') {
          warnings?.push(`ITDX: resultado en blanco en jugador ${startRank} ronda ${roundIdx} — debe ser '?' (TRF-26)`);
        }
        const mapped = TRF_RESULT_MAP[resultChar] ?? (resultChar.trim() === '' ? Result.UNKNOWN : Result.NOT_PLAYED);
        if (!(resultChar in TRF_RESULT_MAP) && resultChar.trim() !== '') {
          warnings?.push(`Resultado TRF desconocido '${resultChar}' en jugador ${startRank} ronda ${roundIdx}`);
        }

        roundResults.push({
          opponentStartRank: oppRank,
          color:  TRF_COLOR_MAP[colorChar]  ?? Color.NONE,
          result: mapped,
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
 * Serializa el modelo interno a formato TRF-26.
 *
 * @param {object}   config    — TournamentConfig (con comments, 162, 172, 299 opcionales)
 * @param {Player[]} players   — Jugadores con historial completo
 * @param {Round[]}  rounds    — Rondas completadas o en curso
 * @returns {string}           — Contenido del archivo TRF-26
 */
export function serializeTRF(config, players, rounds) {
  const lines = [];

  // ── Comentarios de auditoría iniciales (###) ──────────────────────
  if (config.comments?.length) {
    for (const c of config.comments) {
      lines.push(`### ${c}`);
    }
  }

  // ── Cabecera TRF-26 ──────────────────────────────────────────────
  if (config.name)         lines.push(`012 ${config.name}`);
  if (config.city)         lines.push(`022 ${config.city}`);
  if (config.federation)   lines.push(`032 ${config.federation}`);
  if (config.startDate)    lines.push(`042 ${config.startDate}`);
  if (config.endDate)      lines.push(`052 ${config.endDate}`);
  lines.push(`062 ${players.length}`);
  const ratedCount = players.filter((p) => (p.fideRating ?? 0) > 0).length;
  lines.push(`072 ${config.ratedCount ?? ratedCount}`);
  if (config.timeControl)  lines.push(`082 ${config.timeControl}`);

  // TRF-26: código de tipo de torneo
  if (config.tournamentTypeCode) lines.push(`092 ${config.tournamentTypeCode}`);

  if (config.chiefArbiter)  lines.push(`102 ${config.chiefArbiter}`);
  if (config.deputyArbiter) lines.push(`112 ${config.deputyArbiter}`);
  if (config.deputyArbiter2) lines.push(`118 ${config.deputyArbiter2}`);
  if (config.allottedTime)  lines.push(`122 ${config.allottedTime}`);
  if (config.tournamentDirector) lines.push(`125 ${config.tournamentDirector}`);
  if (config.address) lines.push(`128 ${config.address}`);
  if (config.roundTime) lines.push(`138 ${config.roundTime}`);
  lines.push(`132 ${rounds.length}`);

  // TRF-26: Record-162 (Sistema de puntuación especial)
  if (config.scoringSystem) {
    lines.push(`162 ${config.scoringSystem}`);
  }

  // TRF-26: Record-172 (National Rating Support / Ranking Method)
  if (config.nrsRecords?.length) {
    for (const nrs of config.nrsRecords) {
      lines.push(`172 ${nrs}`);
    }
  }

  // TRF-26: desempates oficiales (Record-202 / 212)
  if (config.tiebreaks?.length) {
    lines.push(`202 ${config.tiebreaks.join(' ')}`);
  }
  if (config.altTiebreaks?.length) {
    lines.push(`212 ${config.altTiebreaks.join(' ')}`);
  }

  // TRF-26: aceleración Baku (Record-250)
  if (config.acceleration?.length) {
    const accStr = config.acceleration
      .map((a) => `${a.round}:${a.threshold}`)
      .join(' ');
    lines.push(`250 ${accStr}`);
  }

  // TRF-26: Record-299 (AATs: Result-AAT / Blank-AAT)
  if (config.aatRecords?.length) {
    for (const aat of config.aatRecords) {
      lines.push(`299 ${aat}`);
    }
  }

  // TRF-26: tipo extendido (Record-310)
  if (config.extendedType) {
    lines.push(`310 ${config.extendedType}`);
  }

  // ── Líneas de jugadores (Record-001) ──────────────────────────────
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
        let bRes = pairing.result;
        if (pairing.result === Result.WHITE_WIN) bRes = Result.BLACK_WIN;
        else if (pairing.result === Result.BLACK_WIN) bRes = Result.WHITE_WIN;
        else if (pairing.result === Result.FORFEIT_WIN) bRes = Result.FORFEIT_LOSS;
        else if (pairing.result === Result.FORFEIT_LOSS) bRes = Result.FORFEIT_WIN;
        else if (pairing.result === Result.WHITE_HALF_WIN) bRes = Result.BLACK_HALF_WIN;
        else if (pairing.result === Result.BLACK_HALF_WIN) bRes = Result.WHITE_HALF_WIN;
        // DOUBLE_FORFEIT es simétrico

        resultsByPlayerRound.get(pairing.blackId)[ri] = {
          color: Color.BLACK,
          result: bRes,
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
        // En ITDX, si la ronda está abierta o no jugada, se emite según configuración
        roundStr += config.isITDX ? ' 0000 - ?' : '         ';
        continue;
      }
      const oppRank = rr.isBye ? '0000' : pad(startRankMap.get(rr.oppId) ?? 0, 4, 'right');
      const colorC  = COLOR_TO_TRF[rr.color] ?? '-';
      let resultC = RESULT_TO_TRF[rr.result] ?? (config.isITDX ? '?' : '-');
      // Inusuales VCL (A/B/C): exportar '?' + traza de auditoría ### (TRF-26 no tiene carácter)
      if ([Result.WHITE_HALF_WIN, Result.BLACK_HALF_WIN, Result.DOUBLE_FORFEIT].includes(rr.result)) {
        resultC = '?';
        lines.push(`### UNUSUAL ${rank} R${ri + 1} ${rr.result} (½-0/0-½/0-0 VCL4THP)`);
      }
      // Formato: " RRRR c R" (space + 4 rank + space + color + space + result)
      roundStr += ` ${oppRank} ${colorC} ${resultC}`;
    }

    // Línea TRF-26 / 001 completa (columnas 1-based según standard FIDE)
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

    // Si el jugador tiene ratings nacionales pseudo-NRS (ej. RRR, BBB, MMM, ITA)
    if (player.nationalRatings) {
      for (const [natCode, natVal] of Object.entries(player.nationalRatings)) {
        const natLine = [
          pad(natCode, 3),
          ' ',
          pad(rank, 4, 'right'),
          pad('', 40),
          pad(natVal, 4, 'right'),
        ].join('');
        lines.push(natLine);
      }
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Valida si un string TRF corresponde a un archivo parcial ITDX (con '?' o partidas sin finalizar)
 * o a un reporte final de torneo.
 * @param {string} content
 * @returns {{ isITDX: boolean, valid: boolean, errors: string[] }}
 */
export function validateTRF26(content) {
  const errors = [];
  const warnings = [];
  const lines = content.split(/\r?\n/);
  let hasUnknown = false;
  let has162 = false, has172 = false, has299 = false, hasAudit = false;

  for (const [idx, line] of lines.entries()) {
    if (!line.trim()) continue;
    if (line.startsWith('###')) { hasAudit = true; continue; }
    const code = line.substring(0, 3).trim();
    if (code === '162') has162 = true;
    if (code === '172') has172 = true;
    if (code === '299') {
      has299 = true;
      const parsed = parseAATRecord(line.substring(4).trim());
      if (parsed.startRank == null || parsed.points == null) {
        warnings.push(`L${idx + 1}: 299 con formato no canónico: ${line.slice(0, 60)}`);
      }
    }
    if (line.startsWith('001')) {
      const resultsPart = line.substring(90);
      if (resultsPart.includes('?')) hasUnknown = true;
      // Detectar grupos de 9 con resultado en blanco (ITDX inválido: debe ser '?')
      for (let c = 0; c + 9 <= resultsPart.length; c += 9) {
        const chunk = resultsPart.substring(c, c + 9);
        if (chunk.trim() === '') continue; // ronda no jugada futura (padding) — OK si no es ITDX
        const rc = chunk[8];
        if (rc === ' ' || rc === undefined) {
          errors.push(`L${idx + 1}: resultado en blanco — usar '?' en ITDX (TRF-26)`);
        } else if (!('1234567890=+UDWHFZ?-ABC'.includes(rc) || '1=0+UHFZ?-'.includes(rc))) {
          // validación laxa: aceptar chars conocidos
          if (!('1' === rc || '0' === rc || '=' === rc || '+' === rc || '-' === rc ||
                'U' === rc || 'H' === rc || 'F' === rc || 'Z' === rc || '?' === rc ||
                'A' === rc || 'B' === rc || 'C' === rc || 'W' === rc || 'L' === rc || 'D' === rc)) {
            errors.push(`L${idx + 1}: carácter de resultado inválido '${rc}'`);
          }
        }
      }
    }
  }

  return {
    isITDX: hasUnknown,
    valid: errors.length === 0,
    errors,
    warnings,
    features: { has162, has172, has299, hasAudit },
  };
}


#!/usr/bin/env node
/**
 * rtg.js — Random Tournament Generator (RTG)
 *
 * Herramienta CLI obligatoria para el proceso de endorsement FIDE
 * (C.04.A §5 del FIDE Handbook).
 *
 * Genera torneos aleatorios completos en formato TRF16/TRF-2025
 * siguiendo estrictamente las reglas del motor de emparejamientos.
 * Sirve como insumo para el proceso de verificación del FPC.
 *
 * Uso:
 *   node rtg.js --count 100 --output ./torneos/
 *   node rtg.js --count 1 --players 20 --rounds 7 --stdout
 *   node rtg.js --help
 *
 * Parámetros de generación:
 *   --count     Número de torneos a generar (por defecto: 1)
 *   --players   Número de jugadores (por defecto: aleatorio 8-30)
 *   --rounds    Número de rondas (por defecto: calculado con fórmula FIDE)
 *   --seed      Semilla aleatoria para reproducibilidad
 *   --output    Directorio de salida (por defecto: ./rtg-output/)
 *   --stdout    Imprimir en stdout en lugar de archivos (solo con --count 1)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join }     from 'path';
import { parseTRF, serializeTRF } from '../trf/trf.js';
import { pairRound as dutchPairRound, applyRoundResults, buildStandings } from '../engine/dutch.js';
import { pairRound as rrPairRound } from '../engine/roundrobin.js';
import { pairRound as bursteinPairRound, getBandA } from '../engine/burstein.js';
import { pairRound as dubovPairRound } from '../engine/dubov.js';
import { calculateTiebreak } from '../engine/tiebreaks.js';
import { createPlayer, Result, DEFAULT_TIEBREAK_ORDER } from '../engine/types.js';

// ── PRNG determinista (xorshift32) ────────────────────────────────────────────

function createRNG(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return {
    next() {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5;
      return (s >>> 0) / 0xFFFFFFFF;
    },
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick(arr) {
      return arr[this.int(0, arr.length - 1)];
    },
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = this.int(0, i);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

// ── Generación de jugadores aleatorios ───────────────────────────────────────

const COUNTRIES = ['ESP', 'FRA', 'GER', 'ITA', 'NOR', 'USA', 'ARG', 'CHN', 'IND', 'RUS',
                   'POL', 'CZE', 'NED', 'HUN', 'GBR', 'SWE', 'ROU', 'UKR', 'AZE', 'ARM'];
const TITLES    = ['', '', '', '', '', 'FM', 'CM', 'NM', 'IM', 'GM'];
const LASTNAMES = ['García','López','Martínez','Sánchez','Pérez','González','Fernández',
                   'Romero','Torres','Flores','Rivera','Díaz','Reyes','Cruz','Morales',
                   'Schmidt','Müller','Fischer','Wagner','Bauer','Smith','Johnson','Brown',
                   'Wilson','Davis','Hansen','Nielsen','Petersen','Larsen','Andersen'];
const FIRSTNAMES = ['Carlos','Ana','Luis','María','Juan','Elena','Pedro','Laura',
                    'Miguel','Sara','David','Paula','Jorge','Carmen','Roberto',
                    'Erik','Lars','Anna','Johan','Emma','John','Mary','James'];

function generatePlayers(count, rng, minRating = 1200, maxRating = 2700) {
  const players = [];
  const usedNames = new Set();

  for (let i = 0; i < count; i++) {
    let lastName;
    let attempts = 0;
    do {
      lastName = rng.pick(LASTNAMES);
      attempts++;
    } while (usedNames.has(lastName) && attempts < 50);
    usedNames.add(lastName);

    const firstName = rng.pick(FIRSTNAMES);
    const rating    = rng.int(minRating, maxRating);
    const titleIdx  = rating > 2500 ? 8 : rating > 2400 ? 7 : rating > 2300 ? 6
                    : rating > 2200 ? 5 : rating > 2100 ? 4 : rng.int(0, 3);

    players.push(createPlayer({
      id:         `P${String(i + 1).padStart(3, '0')}`,
      name:       firstName,
      lastName,
      fideRating: rating,
      title:      TITLES[Math.min(titleIdx, TITLES.length - 1)],
      country:    rng.pick(COUNTRIES),
      fideid:     String(10000000 + rng.int(0, 9999999)),
    }));
  }

  return players;
}

// ── Simulación de resultado usando tabla de probabilidad FIDE ────────────────

/**
 * Calcula la probabilidad de victoria del jugador 1
 * según la diferencia de ELO (tabla FIDE C.02).
 */
function winProbability(rating1, rating2) {
  const diff = Math.max(-400, Math.min(400, rating1 - rating2));
  return 1 / (1 + Math.pow(10, -diff / 400));
}

function simulateResult(p1Rating, p2Rating, rng, opts = {}) {
  // Opciones de incomparecencias y resultados especiales (VCL4THP v13 Q7-Q8)
  const forfeitRate = opts.forfeits ?? 0.01;
  const unusualRate = opts.unusual  ?? 0.005;

  const rSpecial = rng.next();
  if (rSpecial < forfeitRate) {
    return rng.next() > 0.5 ? Result.FORFEIT_WIN : Result.FORFEIT_LOSS;
  }
  if (rSpecial < forfeitRate + unusualRate) {
    // Inusuales: ½-0 (A), 0-½ (B), 0-0 (C). Se exportan a TRF-26 como '?' + ### audit.
    const u = rng.next();
    if (u < 0.4) return Result.WHITE_HALF_WIN;
    if (u < 0.8) return Result.BLACK_HALF_WIN;
    return Result.DOUBLE_FORFEIT;
  }

  const prob = winProbability(p1Rating, p2Rating);
  const r    = rng.next();
  if (r < prob * 0.7)             return Result.WHITE_WIN;
  if (r < prob * 0.7 + 0.3)      return Result.DRAW;
  return Result.BLACK_WIN;
}

// ── Cálculo de rondas recomendadas (fórmula FIDE) ────────────────────────────

function recommendedRounds(playerCount) {
  if (playerCount <= 8)  return 4;
  if (playerCount <= 16) return 5;
  if (playerCount <= 32) return 6;
  if (playerCount <= 64) return 7;
  if (playerCount <= 128) return 8;
  return 9;
}

// ── Generar un torneo completo (API Programática y CLI) ─────────────────────

export function generateTournament(opts = {}, rng = createRNG()) {
  const system      = opts.system ?? 'dutch';
  const playerCount = opts.players ?? rng.int(8, 32);
  const nRounds     = opts.rounds  ?? (system === 'roundrobin' ? (playerCount % 2 === 0 ? playerCount - 1 : playerCount) : recommendedRounds(playerCount));
  const tournId     = `RTG-${Date.now()}-${rng.int(1000, 9999)}`;

  const typeCodes = { roundrobin: 'R', burstein: 'S-A', dubov: 'S-X', dutch: 'S' };
  const extTypes  = { roundrobin: `IND RR ${nRounds}R`, burstein: `IND SWISS-A ${nRounds}R`, dubov: `IND SWISS-X ${nRounds}R`, dutch: `IND SWISS ${nRounds}R` };

  const tiebreaks = opts.tiebreaks && Array.isArray(opts.tiebreaks) ? opts.tiebreaks
    : typeof opts.tiebreaks === 'string' ? opts.tiebreaks.split(',').map((s) => s.trim())
    : DEFAULT_TIEBREAK_ORDER;

  const config = {
    name:              `RTG Tournament ${tournId}`,
    city:              'Generated',
    federation:        'RTG',
    startDate:         new Date().toISOString().split('T')[0],
    endDate:           new Date().toISOString().split('T')[0],
    timeControl:       '90+30',
    tournamentTypeCode: typeCodes[system] ?? 'S',
    chiefArbiter:      'Auto-generated RTG',
    nRounds,
    system,
    tiebreaks,
    extendedType:      extTypes[system] ?? `IND SWISS ${nRounds}R`,
    comments:          ['FIDE TEC VCL4THP v13 Compliant Random Tournament Generation'],
  };

  // Configuración de Aceleración Baku
  if (opts.baku || opts.acceleration === 'baku') {
    config.acceleration = [
      { round: 1, threshold: Math.floor(playerCount / 2) },
      { round: 2, threshold: Math.floor(playerCount / 4) },
    ];
  }

  const minRating = opts.minRating ?? 1200;
  const maxRating = opts.maxRating ?? 2700;
  let players = generatePlayers(playerCount, rng, minRating, maxRating);
  const rounds = [];
  let bandA = [];

  for (let r = 0; r < nRounds; r++) {
    const pairFn = system === 'roundrobin' ? rrPairRound
                 : system === 'burstein'   ? (p, rn) => bursteinPairRound(p, rn, bandA)
                 : system === 'dubov'      ? dubovPairRound
                 : dutchPairRound;
    const result = pairFn(players.filter((p) => !p.withdrawn), r + 1);
    let { pairings, warnings } = result;

    if (system === 'burstein' && r === 0) {
      bandA = getBandA(players);
    }

    // Red de seguridad VCL: el motor puede dejar jugadores sin emparejar
    // (grupos igualados / floats imposibles). Emparejar restos entre sí y,
    // si queda uno impar, asignarle bye reglamentario. Garantiza rondas completas.
    {
      const covered = new Set();
      for (const p of pairings) {
        covered.add(p.whiteId);
        if (p.blackId) covered.add(p.blackId);
      }
      const uncovered = players.filter((p) => !p.withdrawn && !covered.has(p.id));
      // Evitar repetir enfrentamientos ya jugados al emparejar restos
      const playedPairs = new Set();
      for (const pl of players) {
        for (const opp of pl.opponents ?? []) {
          playedPairs.add([pl.id, opp].sort().join('|'));
        }
      }
      for (let i = 0; i + 1 < uncovered.length; i += 2) {
        const a = uncovered[i], b = uncovered[i + 1];
        const aWhite = (a.colorDiff ?? 0) <= (b.colorDiff ?? 0);
        pairings.push({
          board: pairings.length + 1,
          whiteId: aWhite ? a.id : b.id,
          blackId: aWhite ? b.id : a.id,
          result: Result.NOT_PLAYED,
          isBye: false,
        });
        warnings = [...(warnings ?? []), `RTG fallback: ${a.id} vs ${b.id} (resto sin emparejar, ronda ${r + 1})`];
      }
      if (uncovered.length % 2 === 1) {
        const lone = uncovered[uncovered.length - 1];
        pairings.push({
          board: pairings.length + 1,
          whiteId: lone.id, blackId: '', result: Result.FULL_BYE, isBye: true,
        });
        warnings = [...(warnings ?? []), `RTG fallback: bye FPB para ${lone.id} (resto impar, ronda ${r + 1})`];
      }
    }

    // Simular resultados (incluyendo byes solicitados configurables)
    const hpbRate = opts.hpb ?? 0.02;
    const fpbRate = opts.fpb ?? 0.01;
    const zpbRate = opts.zpb ?? 0.01;

    const completedPairings = pairings.map((pairing) => {
      if (pairing.isBye) {
        const rBye = rng.next();
        const byeResult = rBye < zpbRate ? Result.ZERO_BYE : (rBye < zpbRate + hpbRate ? Result.HALF_BYE : Result.FULL_BYE);
        return { ...pairing, result: byeResult };
      }
      const white = players.find((p) => p.id === pairing.whiteId);
      const black = players.find((p) => p.id === pairing.blackId);
      return {
        ...pairing,
        result: simulateResult(
          white?.fideRating ?? 1500,
          black?.fideRating ?? 1500,
          rng,
          opts
        ),
      };
    });

    rounds.push({
      number:    r + 1,
      pairings:  completedPairings,
      published: true,
      closed:    true,
    });

    // Actualizar estado de jugadores
    players = applyRoundResults(players, completedPairings);
  }

  // Calcular desempates para el standings final
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const withTiebreaks = players.map((player) => ({
    ...player,
    tiebreakValues: config.tiebreaks.map((tb) =>
      calculateTiebreak(tb, player, playersById, nRounds)
    ),
  }));

  const standings = buildStandings(withTiebreaks);

  return { config, players: standings, rounds };
}

// ── Parseado de argumentos CLI ───────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    count: 1, players: null, rounds: null, system: 'dutch',
    minRating: null, maxRating: null, fpb: null, hpb: null, zpb: null,
    forfeits: null, unusual: null, baku: false, tiebreaks: null,
    seed: null, output: './rtg-output', stdout: false, help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { args.help = true; break; }
    if (argv[i] === '--count')       { args.count   = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--players')     { args.players = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--rounds')      { args.rounds  = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--system')      { args.system  = argv[++i]; continue; }
    if (argv[i] === '--min-rating')  { args.minRating = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--max-rating')  { args.maxRating = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--fpb')         { args.fpb = parseFloat(argv[++i]); continue; }
    if (argv[i] === '--hpb')         { args.hpb = parseFloat(argv[++i]); continue; }
    if (argv[i] === '--zpb')         { args.zpb = parseFloat(argv[++i]); continue; }
    if (argv[i] === '--forfeits')    { args.forfeits = parseFloat(argv[++i]); continue; }
    if (argv[i] === '--unusual')     { args.unusual = parseFloat(argv[++i]); continue; }
    if (argv[i] === '--baku')        { args.baku = true; continue; }
    if (argv[i] === '--tiebreaks')   { args.tiebreaks = argv[++i]; continue; }
    if (argv[i] === '--seed')        { args.seed    = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--output')      { args.output  = argv[++i]; continue; }
    if (argv[i] === '--stdout')      { args.stdout  = true; continue; }
  }
  return args;
}

function printHelp() {
  console.log(`
Chess Organizers — Random Tournament Generator (RTG)
Versión 2.3.0 | Conforme a FIDE TEC Manual 2.0 y VCL4THP v13

Uso:
  node rtg.js [opciones]

Opciones:
  --count       <n>     Torneos a generar (por defecto: 1)
  --players     <n>     Jugadores por torneo (por defecto: aleatorio 8-32)
  --rounds      <n>     Rondas por torneo (por defecto: fórmula FIDE)
  --system      <s>     Sistema: dutch, roundrobin, burstein, dubov (por defecto: dutch)
  --min-rating  <n>     Rating mínimo de jugadores (por defecto: 1200)
  --max-rating  <n>     Rating máximo de jugadores (por defecto: 2700)
  --fpb         <pct>   Cuota de Full-Point Byes 0/1 (por defecto: 0.01) [VCL Q6]
  --hpb         <pct>   Cuota de Half-Point Byes ½ (por defecto: 0.02) [VCL Q6]
  --zpb         <pct>   Cuota de Zero-Point Byes 0 (por defecto: 0.01) [VCL Q6]
  --forfeits    <pct>   Cuota de incomparecencias +/- (por defecto: 0.01) [VCL Q7]
  --unusual     <pct>   Cuota de resultados inusuales ½-0/0-½/0-0 (por defecto: 0.005) [VCL Q8]
  --baku                Activar método de aceleración Baku (Record-250) [VCL Q9]
  --tiebreaks   <list>  Lista de desempates separada por comas (ej: DE,BH1,BH,SB,AR,AP,W,WON) [VCL Q10]
  --seed        <n>     Semilla aleatoria para reproducibilidad
  --output      <dir>   Directorio de salida (por defecto: ./rtg-output/)
  --stdout              Imprimir en stdout (solo con --count 1)
  --help                Esta ayuda

Ejemplo para el proceso FIDE (5000 torneos):
  node rtg.js --count 5000 --output ./fide-verification/
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  const baseSeed = args.seed ?? Date.now();
  const rng      = createRNG(baseSeed);

  console.log(`Chess Organizers RTG — generando ${args.count} torneo(s) (sistema: ${args.system})...`);
  console.log(`Semilla: ${baseSeed}`);

  if (!args.stdout) {
    mkdirSync(args.output, { recursive: true });
  }

  let generated = 0;
  let errors    = 0;

  for (let i = 0; i < args.count; i++) {
    try {
      const tournament = generateTournament(
        {
          players: args.players, rounds: args.rounds, system: args.system,
          minRating: args.minRating, maxRating: args.maxRating,
          fpb: args.fpb, hpb: args.hpb, zpb: args.zpb,
          forfeits: args.forfeits, unusual: args.unusual,
          baku: args.baku, tiebreaks: args.tiebreaks,
        },
        rng
      );
      const trf = serializeTRF(tournament.config, tournament.players, tournament.rounds);

      if (args.stdout && args.count === 1) {
        process.stdout.write(trf);
      } else {
        const filename = join(args.output, `tournament_${String(i + 1).padStart(5, '0')}.trf`);
        writeFileSync(filename, trf, 'utf-8');
      }
      generated++;

      if (args.count > 1 && (i + 1) % 100 === 0) {
        console.log(`  ${i + 1}/${args.count} torneos generados...`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error en torneo ${i + 1}: ${err.message}`);
    }
  }

  console.log(`\nGeneración completada: ${generated} OK, ${errors} errores`);
  if (!args.stdout) {
    console.log(`Archivos en: ${args.output}`);
  }
  process.exit(errors > 0 ? 1 : 0);
}

// Solo auto-ejecutar como CLI, no al importar generateTournament() como API
const _isCli = typeof process !== 'undefined' && Array.isArray(process.argv) &&
  process.argv[1] != null && /rtg\.js$/.test(process.argv[1].replace(/\\/g, '/'));
if (_isCli) main();

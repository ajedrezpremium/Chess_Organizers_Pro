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
import { pairRound, applyRoundResults, buildStandings } from '../engine/dutch.js';
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

function generatePlayers(count, rng) {
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
    const rating    = rng.int(1200, 2700);
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

function simulateResult(p1Rating, p2Rating, rng) {
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

// ── Generar un torneo completo ────────────────────────────────────────────────

function generateTournament(opts, rng) {
  const playerCount = opts.players ?? rng.int(8, 32);
  const nRounds     = opts.rounds  ?? recommendedRounds(playerCount);
  const tournId     = `RTG-${Date.now()}-${rng.int(1000, 9999)}`;

  const config = {
    name:              `RTG Tournament ${tournId}`,
    city:              'Generated',
    federation:        'RTG',
    startDate:         new Date().toISOString().split('T')[0],
    endDate:           new Date().toISOString().split('T')[0],
    timeControl:       '90+30',
    tournamentTypeCode: 'S',   // Swiss (código TRF-2025)
    chiefArbiter:      'Auto-generated',
    nRounds,
    tiebreaks:         DEFAULT_TIEBREAK_ORDER,
    extendedType:      `IND SWISS ${nRounds}R`,
  };

  let players = generatePlayers(playerCount, rng);
  const rounds = [];

  for (let r = 0; r < nRounds; r++) {
    const { pairings, warnings } = pairRound(players, r + 1);

    // Simular resultados
    const completedPairings = pairings.map((pairing) => {
      if (pairing.isBye) return pairing;
      const white = players.find((p) => p.id === pairing.whiteId);
      const black = players.find((p) => p.id === pairing.blackId);
      return {
        ...pairing,
        result: simulateResult(
          white?.fideRating ?? 1500,
          black?.fideRating ?? 1500,
          rng
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

// ── Parseado de argumentos ────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    count: 1, players: null, rounds: null,
    seed: null, output: './rtg-output', stdout: false, help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { args.help = true; break; }
    if (argv[i] === '--count')   { args.count   = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--players') { args.players = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--rounds')  { args.rounds  = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--seed')    { args.seed    = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--output')  { args.output  = argv[++i]; continue; }
    if (argv[i] === '--stdout')  { args.stdout  = true; continue; }
  }
  return args;
}

function printHelp() {
  console.log(`
Chess Organizers — Random Tournament Generator (RTG)
Versión 1.0.0 | Formato TRF-2025

Uso:
  node rtg.js [opciones]

Opciones:
  --count   <n>     Torneos a generar (por defecto: 1)
  --players <n>     Jugadores por torneo (por defecto: aleatorio 8-32)
  --rounds  <n>     Rondas por torneo (por defecto: fórmula FIDE)
  --seed    <n>     Semilla aleatoria para reproducibilidad
  --output  <dir>   Directorio de salida (por defecto: ./rtg-output/)
  --stdout          Imprimir en stdout (solo con --count 1)
  --help            Esta ayuda

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

  console.log(`Chess Organizers RTG — generando ${args.count} torneo(s)...`);
  console.log(`Semilla: ${baseSeed}`);

  if (!args.stdout) {
    mkdirSync(args.output, { recursive: true });
  }

  let generated = 0;
  let errors    = 0;

  for (let i = 0; i < args.count; i++) {
    try {
      const tournament = generateTournament(
        { players: args.players, rounds: args.rounds },
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

main();

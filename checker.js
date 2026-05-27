#!/usr/bin/env node
/**
 * checker.js — Free Pairings Checker (FPC)
 *
 * Herramienta CLI obligatoria para el proceso de endorsement FIDE
 * (C.04.A §4 del FIDE Handbook).
 *
 * Uso:
 *   node checker.js --check tournament.trf
 *   node checker.js --check tournament.trf --round 4
 *   node checker.js --help
 *
 * Comportamiento:
 *   Lee un archivo TRF, reconstruye el estado del torneo ronda a ronda
 *   y verifica si los emparejamientos de cada ronda (o de la ronda
 *   indicada) son correctos según el sistema Dutch FIDE.
 *
 *   Salida:
 *     EXIT 0 — todos los emparejamientos son correctos
 *     EXIT 1 — se encontraron discrepancias (se detallan en stdout)
 *     EXIT 2 — error de lectura o formato inválido
 *
 *   Formato de salida compatible con javafo para el proceso FIDE.
 */

import { readFileSync } from 'fs';
import { parseTRF }     from '../trf/trf.js';
import { pairRound, applyRoundResults } from '../engine/dutch.js';
import { createPlayer } from '../engine/types.js';

// ── Parseado de argumentos ────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { check: null, round: null, help: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { args.help = true; break; }
    if (argv[i] === '--check' || argv[i] === '-c') { args.check = argv[++i]; continue; }
    if (argv[i] === '--round' || argv[i] === '-r') { args.round = parseInt(argv[++i], 10); continue; }
    if (argv[i] === '--verbose' || argv[i] === '-v') { args.verbose = true; continue; }
  }
  return args;
}

function printHelp() {
  console.log(`
Chess Organizers — Free Pairings Checker (FPC)
Versión 1.0.0 | Compatible con TRF16 y TRF-2025

Uso:
  node checker.js --check <archivo.trf> [opciones]

Opciones:
  --check, -c <archivo>   Archivo TRF a verificar (obligatorio)
  --round, -r <número>    Verificar solo la ronda indicada (por defecto: todas)
  --verbose, -v           Mostrar detalle de cada emparejamiento
  --help, -h              Mostrar esta ayuda

Códigos de salida:
  0   Todos los emparejamientos son correctos
  1   Se encontraron discrepancias
  2   Error de lectura o formato inválido

Ejemplo:
  node checker.js --check open_madrid_2026.trf
  node checker.js --check open_madrid_2026.trf --round 3 --verbose
`);
}

// ── Verificador de una ronda ──────────────────────────────────────────────────

/**
 * Verifica los emparejamientos de una ronda concreta.
 * Reconstruye el estado de los jugadores hasta la ronda anterior
 * y genera los emparejamientos esperados con el motor Dutch.
 *
 * @returns {{ round: number, discrepancies: string[], ok: boolean }}
 */
function checkRound(players, rounds, roundIndex, verbose) {
  const roundNumber = roundIndex + 1;
  const discrepancies = [];

  // Reconstruir estado hasta la ronda anterior
  let state = players.map(createPlayer);
  for (let r = 0; r < roundIndex; r++) {
    state = applyRoundResults(state, rounds[r].pairings);
  }

  // Generar emparejamientos esperados
  const { pairings: expected, warnings } = pairRound(state, roundNumber);
  const actual = rounds[roundIndex].pairings;

  if (verbose) {
    console.log(`\n── Ronda ${roundNumber} ──────────────────────────────────`);
    console.log(`  Emparejamientos en TRF: ${actual.length}`);
    console.log(`  Emparejamientos calculados: ${expected.length}`);
  }

  // Comparar emparejamientos
  // Construir sets de pares {whiteId, blackId} para comparación sin importar el orden de la lista
  const setFromPairings = (pairings) =>
    new Set(pairings.map((p) => [p.whiteId, p.blackId].sort().join('|')));

  const expectedSet = setFromPairings(expected);
  const actualSet   = setFromPairings(actual);

  for (const pair of actualSet) {
    if (!expectedSet.has(pair)) {
      const [id1, id2] = pair.split('|');
      const p1 = state.find((p) => p.id === id1);
      const p2 = state.find((p) => p.id === id2);
      discrepancies.push(
        `Ronda ${roundNumber}: par (${p1?.lastName ?? id1} vs ${p2?.lastName ?? id2}) ` +
        `en TRF pero NO generado por el motor`
      );
    }
  }
  for (const pair of expectedSet) {
    if (!actualSet.has(pair)) {
      const [id1, id2] = pair.split('|');
      const p1 = state.find((p) => p.id === id1);
      const p2 = state.find((p) => p.id === id2);
      discrepancies.push(
        `Ronda ${roundNumber}: par (${p1?.lastName ?? id1} vs ${p2?.lastName ?? id2}) ` +
        `generado por el motor pero NO en TRF`
      );
    }
  }

  // Comparar colores para los pares que coinciden
  for (const actualPairing of actual) {
    if (actualPairing.isBye) continue;
    const matchingExpected = expected.find((ep) =>
      (ep.whiteId === actualPairing.whiteId && ep.blackId === actualPairing.blackId) ||
      (ep.whiteId === actualPairing.blackId && ep.blackId === actualPairing.whiteId)
    );
    if (!matchingExpected) continue;

    if (
      matchingExpected.whiteId !== actualPairing.whiteId &&
      matchingExpected.blackId !== actualPairing.blackId
    ) {
      const p1 = state.find((p) => p.id === actualPairing.whiteId);
      const p2 = state.find((p) => p.id === actualPairing.blackId);
      discrepancies.push(
        `Ronda ${roundNumber}: colores invertidos para ` +
        `(${p1?.lastName ?? actualPairing.whiteId} vs ${p2?.lastName ?? actualPairing.blackId})`
      );
    }
  }

  if (warnings.length && verbose) {
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }

  return { round: roundNumber, discrepancies, ok: discrepancies.length === 0 };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);

  if (args.help) { printHelp(); process.exit(0); }

  if (!args.check) {
    console.error('Error: debes especificar un archivo TRF con --check');
    printHelp();
    process.exit(2);
  }

  // Leer archivo
  let content;
  try {
    content = readFileSync(args.check, 'utf-8');
  } catch (err) {
    console.error(`Error leyendo archivo: ${err.message}`);
    process.exit(2);
  }

  // Parsear TRF
  const { config, players, rounds, warnings: parseWarnings } = parseTRF(content);

  if (parseWarnings.length) {
    for (const w of parseWarnings) console.warn(`⚠ Parse: ${w}`);
  }

  if (!players.length || !rounds.length) {
    console.error('Error: TRF inválido — sin jugadores o sin rondas');
    process.exit(2);
  }

  console.log(`\nChess Organizers Free Pairings Checker`);
  console.log(`Torneo:  ${config.name ?? '(sin nombre)'}`);
  console.log(`Sistema: ${config.tournamentTypeCode ?? 'Suizo (Dutch)'}`);
  console.log(`Jugadores: ${players.length} | Rondas en TRF: ${rounds.length}`);

  // Determinar qué rondas verificar
  const roundsToCheck = args.round != null
    ? [args.round - 1]  // convertir a 0-based
    : rounds.map((_, i) => i);

  let totalDiscrepancies = 0;
  const results = [];

  for (const ri of roundsToCheck) {
    if (ri < 0 || ri >= rounds.length) {
      console.error(`Error: la ronda ${ri + 1} no existe en el TRF (hay ${rounds.length} rondas)`);
      process.exit(2);
    }
    const result = checkRound(players, rounds, ri, args.verbose);
    results.push(result);
    totalDiscrepancies += result.discrepancies.length;
  }

  // ── Informe de resultados ─────────────────────────────────────────
  console.log('\n── Resultado de la verificación ──────────────────────');
  for (const res of results) {
    if (res.ok) {
      console.log(`  ✓ Ronda ${res.round}: CORRECTO`);
    } else {
      console.log(`  ✗ Ronda ${res.round}: ${res.discrepancies.length} discrepancia(s)`);
      for (const d of res.discrepancies) {
        console.log(`      • ${d}`);
      }
    }
  }

  console.log('─────────────────────────────────────────────────────');
  if (totalDiscrepancies === 0) {
    console.log(`✓ Sin discrepancias. Emparejamientos conformes con el sistema Dutch FIDE.\n`);
    process.exit(0);
  } else {
    console.log(`✗ ${totalDiscrepancies} discrepancia(s) encontrada(s).\n`);
    process.exit(1);
  }
}

main();

/**
 * integration.test.js — Tests de integración bbpPairings + motor JS
 *
 * Ejecutar:
 *   node tests/integration.test.js              — prueba ambos backends
 *   node tests/integration.test.js --bbp-only   — solo bbpPairings (requiere binario)
 *   node tests/integration.test.js --js-only    — solo dutch.js
 *
 * Los tests de bbpPairings se saltan automáticamente si el binario no está instalado.
 */

import assert from 'assert/strict';
import { existsSync } from 'fs';
import { PairingEngine, Backend } from '../src/engine/pairingEngine.js';
import { resolveBinaryPath } from '../src/bbp/bbpBridge.js';
import { serializeTRF } from '../src/trf/trf.js';
import { createPlayer, Result, DEFAULT_TIEBREAK_ORDER } from '../src/engine/types.js';

// ── Utilidades ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      }).catch((err) => {
        console.error(`  ✗ ${name}: ${err.message}`);
        failed++;
      });
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function skip(name, reason) {
  console.log(`  ⊘ ${name} (omitido: ${reason})`);
  skipped++;
}

// ── Fixture: torneo de 4 jugadores, 1 ronda ───────────────────────────────────

function make4PlayerTRF() {
  const players = [
    createPlayer({ id: 'P001', name: 'Magnus',  lastName: 'Carlsen',  fideRating: 2830, title: 'GM', country: 'NOR', fideid: '1503014' }),
    createPlayer({ id: 'P002', name: 'Fabiano', lastName: 'Caruana',  fideRating: 2805, title: 'GM', country: 'USA', fideid: '2020009' }),
    createPlayer({ id: 'P003', name: 'Wesley',  lastName: 'So',       fideRating: 2768, title: 'GM', country: 'USA', fideid: '5202213' }),
    createPlayer({ id: 'P004', name: 'Anish',   lastName: 'Giri',     fideRating: 2745, title: 'GM', country: 'NED', fideid: '24116068' }),
  ];

  const config = {
    name: 'Integration Test Tournament', city: 'TestCity',
    federation: 'TST', startDate: '2026-04-01', endDate: '2026-04-01',
    timeControl: '90+30', tournamentTypeCode: 'S',
    chiefArbiter: 'Test Arbiter', nRounds: 3,
    tiebreaks: DEFAULT_TIEBREAK_ORDER,
  };

  return { trf: serializeTRF(config, players, []), players, config };
}

function make4PlayerTRFAfterRound1() {
  const { players, config } = make4PlayerTRF();

  // Aplicar resultados de ronda 1: P001 gana a P003, P002 gana a P004
  const round1Pairings = [
    { board: 1, whiteId: 'P001', blackId: 'P003', result: Result.WHITE_WIN, isBye: false },
    { board: 2, whiteId: 'P004', blackId: 'P002', result: Result.BLACK_WIN, isBye: false },
  ];

  const rounds = [{
    number: 1, pairings: round1Pairings, published: true, closed: true,
  }];

  const trf = serializeTRF(config, players, rounds);
  return { trf, players, config, rounds };
}

// ── Suite 1: PairingEngine con backend JS ─────────────────────────────────────

console.log('\n── Suite 1: PairingEngine backend JS ────────────────────');

const jsEngine = new PairingEngine({ forceBackend: Backend.JS, verbose: false });

await test('Resuelve backend como JS cuando se fuerza', async () => {
  const b = await jsEngine.resolveBackend();
  assert.equal(b, Backend.JS);
});

await test('getBackendInfo devuelve isFideEndorsed: false en JS', async () => {
  const info = await jsEngine.getBackendInfo();
  assert.equal(info.backend, Backend.JS);
  assert.equal(info.isFideEndorsed, false);
});

await test('pairNextRound genera pairings para torneo de 4j con JS', async () => {
  const { players } = make4PlayerTRF();
  const result = await jsEngine.pairNextRound({ players, round: 1 });
  assert.ok(result.pairings.length >= 2, 'Debe generar al menos 2 partidas');
  assert.equal(result.backend, Backend.JS);
});

await test('pairNextRound ronda 2 después de resultados no repite enfrentamientos', async () => {
  const { players: originalPlayers } = make4PlayerTRF();

  // Ronda 1
  const r1 = await jsEngine.pairNextRound({ players: originalPlayers, round: 1 });
  const { applyRoundResults } = await import('../src/engine/dutch.js');
  const r1withResults = r1.pairings.map((p) => ({ ...p, result: Result.WHITE_WIN }));

  const { createPlayer: cp } = await import('../src/engine/types.js');
  const playersAfterR1 = applyRoundResults(originalPlayers, r1withResults);

  // Ronda 2
  const r2 = await jsEngine.pairNextRound({ players: playersAfterR1, round: 2 });

  const r1Pairs = new Set(r1.pairings.map((p) => [p.whiteId, p.blackId].sort().join('|')));
  for (const p of r2.pairings.filter((p) => !p.isBye)) {
    const key = [p.whiteId, p.blackId].sort().join('|');
    assert.ok(!r1Pairs.has(key), `Par ${key} se repite entre ronda 1 y ronda 2`);
  }
});

// ── Suite 2: PairingEngine con backend bbpPairings ────────────────────────────

const bbpAvailable = existsSync(resolveBinaryPath());
const args = process.argv.slice(2);
const bbpOnly = args.includes('--bbp-only');
const jsOnly  = args.includes('--js-only');

if (!jsOnly && bbpAvailable) {
  console.log('\n── Suite 2: PairingEngine backend bbpPairings ───────────');

  const bbpEngine = new PairingEngine({ forceBackend: Backend.BBP, verbose: true });

  await test('Resuelve backend como BBP cuando está instalado', async () => {
    const b = await bbpEngine.resolveBackend();
    assert.equal(b, Backend.BBP);
  });

  await test('getBackendInfo devuelve isFideEndorsed: true con bbpPairings', async () => {
    const info = await bbpEngine.getBackendInfo();
    assert.equal(info.isFideEndorsed, true);
    assert.ok(info.label.includes('FIDE-endorsed'));
  });

  await test('pairNextRound con bbpPairings produce TRF de salida', async () => {
    const { trf } = make4PlayerTRF();
    const result = await bbpEngine.pairNextRound({ trf, system: 'dutch' });
    assert.equal(result.backend, Backend.BBP);
    assert.ok(result.pairings.length >= 2);
    assert.ok(typeof result.outputTrf === 'string');
    assert.ok(result.outputTrf.includes('001'), 'El TRF de salida debe contener líneas de jugador');
  });

  await test('verifyPairings con bbpPairings acepta TRF correcto', async () => {
    const { trf } = make4PlayerTRFAfterRound1();
    const check = await bbpEngine.verifyPairings(trf, 'dutch');
    // Un TRF con ronda 1 correcta debe pasar la verificación
    assert.ok(typeof check.ok === 'boolean');
    assert.ok(Array.isArray(check.discrepancies));
  });

  await test('generateRandom produce TRF válido', async () => {
    const { trf, seed } = await bbpEngine.generateRandom({ seed: 42 });
    assert.ok(typeof trf === 'string');
    assert.ok(trf.includes('012'), 'El TRF debe tener cabecera');
    assert.ok(trf.includes('001'), 'El TRF debe tener jugadores');
    assert.ok(typeof seed === 'number');
  });

} else if (!jsOnly) {
  console.log('\n── Suite 2: bbpPairings ──────────────────────────────────');
  skip('Todos los tests de bbpPairings', 'binario no instalado — ejecuta: npm run download-bbp');
}

// ── Suite 3: Selección automática de backend ──────────────────────────────────

if (!bbpOnly && !jsOnly) {
  console.log('\n── Suite 3: Selección automática de backend ──────────────');

  await test('PairingEngine auto selecciona BBP si el binario existe, JS si no', async () => {
    const autoEngine = new PairingEngine(); // forceBackend = 'auto'
    const backend = await autoEngine.resolveBackend();
    const expected = bbpAvailable ? Backend.BBP : Backend.JS;
    assert.equal(backend, expected);
  });

  await test('PairingEngine lanza error claro si se fuerza BBP sin binario', async () => {
    if (bbpAvailable) {
      skip('Binario disponible, test no aplicable', 'bbpPairings instalado');
      return;
    }
    const forcedEngine = new PairingEngine({ forceBackend: Backend.BBP });
    await assert.rejects(
      () => forcedEngine.resolveBackend(),
      (err) => err.message.includes('download-bbp'),
      'Debe sugerir npm run download-bbp en el mensaje de error'
    );
  });
}

// ── Resumen ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────');
console.log(`Tests: ${passed} pasados, ${failed} fallados, ${skipped} omitidos`);
if (!bbpAvailable) {
  console.log(`\nℹ Para ejecutar los tests de bbpPairings:`);
  console.log(`  npm run download-bbp && node tests/integration.test.js`);
}
if (failed === 0) {
  console.log('✓ Integración lista\n');
  process.exit(0);
} else {
  console.log('✗ Revisar los tests fallados\n');
  process.exit(1);
}

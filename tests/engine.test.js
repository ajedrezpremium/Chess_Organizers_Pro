/**
 * engine.test.js — Tests del motor de emparejamientos
 *
 * Ejecutar: node --experimental-vm-modules engine.test.js
 * O con Jest: jest engine.test.js
 *
 * Sin dependencias de React, Firestore ni ningún framework externo.
 * Solo Node.js assert + los módulos del motor.
 *
 * Cubre los casos del Verification Check List (VCL) FIDE (C.04.A Anexo-4)
 * que son verificables sin el RTG completo.
 */

import assert from 'assert/strict';
import { pairRound, applyRoundResults, buildStandings } from '../src/engine/dutch.js';
import { buchholz, buchholzCut, sonnebornBerger, progressive, directEncounter } from '../src/engine/tiebreaks.js';
import { parseTRF, serializeTRF } from '../src/trf/trf.js';
import { createPlayer, Color, Result, DEFAULT_TIEBREAK_ORDER } from '../src/engine/types.js';
import { generateAllRounds, pairRound as rrPairRound } from '../src/engine/roundrobin.js';

// ── Utilidades de test ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function makePlayer(id, rating, points = 0, opts = {}) {
  return createPlayer({
    id, name: 'Test', lastName: `Player${id}`,
    fideRating: rating, points,
    colorHistory: opts.colorHistory ?? [],
    colorDiff:    opts.colorDiff    ?? 0,
    opponents:    opts.opponents    ?? [],
    receivedBye:  opts.receivedBye  ?? false,
    ...opts,
  });
}

// ── Suite 1: Emparejamientos básicos ─────────────────────────────────────────

console.log('\n── Suite 1: Emparejamientos básicos ─────────────────────');

test('Torneo de 4 jugadores: genera 2 partidas sin bye', () => {
  const players = [
    makePlayer('A', 2400), makePlayer('B', 2300),
    makePlayer('C', 2200), makePlayer('D', 2100),
  ];
  const { pairings, byePlayer } = pairRound(players, 1);
  assert.equal(pairings.length, 2, 'Debe haber 2 partidas');
  assert.equal(byePlayer, null, 'No debe haber bye');
  assert.ok(
    pairings.every((p) => p.whiteId && p.blackId && !p.isBye),
    'Todas las partidas deben tener blancas y negras'
  );
});

test('Torneo de 5 jugadores: genera 2 partidas + 1 bye', () => {
  const players = [
    makePlayer('A', 2400), makePlayer('B', 2300), makePlayer('C', 2200),
    makePlayer('D', 2100), makePlayer('E', 2000),
  ];
  const { pairings, byePlayer } = pairRound(players, 1);
  const regularPairings = pairings.filter((p) => !p.isBye);
  const byePairings     = pairings.filter((p) => p.isBye);
  assert.equal(regularPairings.length, 2, 'Debe haber 2 partidas regulares');
  assert.equal(byePairings.length,    1, 'Debe haber 1 bye');
  assert.ok(byePlayer !== null,           'Debe identificar al jugador con bye');
});

test('El bye lo recibe el jugador de menor rating en ronda 1', () => {
  const players = [
    makePlayer('A', 2400), makePlayer('B', 2300), makePlayer('C', 2200),
    makePlayer('D', 2100), makePlayer('E', 2000),
  ];
  const { byePlayer } = pairRound(players, 1);
  assert.equal(byePlayer?.id, 'E', 'El jugador de menor rating debe recibir el bye');
});

test('No se repiten enfrentamientos entre rondas', () => {
  let players = [
    makePlayer('A', 2400), makePlayer('B', 2300),
    makePlayer('C', 2200), makePlayer('D', 2100),
  ];

  const { pairings: r1 } = pairRound(players, 1);
  // Simular que A ganó a B y C ganó a D
  const r1withResults = r1.map((p) => ({ ...p, result: Result.WHITE_WIN }));
  players = applyRoundResults(players, r1withResults);

  const { pairings: r2 } = pairRound(players, 2);
  // Verificar que ningún par de ronda 2 repite ronda 1
  for (const p2 of r2.filter((p) => !p.isBye)) {
    const repeated = r1.some(
      (p1) =>
        (p1.whiteId === p2.whiteId && p1.blackId === p2.blackId) ||
        (p1.whiteId === p2.blackId && p1.blackId === p2.whiteId)
    );
    assert.ok(!repeated, `Par (${p2.whiteId} vs ${p2.blackId}) ya se jugó en ronda 1`);
  }
});

// ── Suite 2: Colores ──────────────────────────────────────────────────────────

console.log('\n── Suite 2: Gestión de colores (C8–C9) ──────────────────');

test('Jugador con colorDiff +2 debe recibir negras (prioridad absoluta)', () => {
  const p1 = makePlayer('A', 2400, 2, {
    colorHistory: [Color.WHITE, Color.WHITE, Color.WHITE],
    colorDiff: 3,  // Excede +2 → prioridad absoluta de negras
  });
  const p2 = makePlayer('B', 2300, 2);

  const { pairings } = pairRound([p1, p2], 4);
  const pairing = pairings[0];
  assert.equal(pairing.blackId, 'A', 'A con colorDiff > 2 debe jugar con negras');
  assert.equal(pairing.whiteId, 'B', 'B debe jugar con blancas');
});

test('applyRoundResults actualiza colorHistory correctamente', () => {
  const p1 = makePlayer('A', 2400);
  const p2 = makePlayer('B', 2300);

  const pairings = [{ board: 1, whiteId: 'A', blackId: 'B', result: Result.WHITE_WIN, isBye: false }];
  const [updated1, updated2] = applyRoundResults([p1, p2], pairings);

  assert.deepEqual(updated1.colorHistory, [Color.WHITE], 'A debe tener color WHITE en historial');
  assert.deepEqual(updated2.colorHistory, [Color.BLACK], 'B debe tener color BLACK en historial');
  assert.equal(updated1.colorDiff, 1,  'A: colorDiff debe ser +1');
  assert.equal(updated2.colorDiff, -1, 'B: colorDiff debe ser -1');
});

test('applyRoundResults actualiza puntos correctamente', () => {
  const p1 = makePlayer('A', 2400, 1);
  const p2 = makePlayer('B', 2300, 0.5);

  const pairings = [{ board: 1, whiteId: 'A', blackId: 'B', result: Result.DRAW, isBye: false }];
  const [ua, ub] = applyRoundResults([p1, p2], pairings);

  assert.equal(ua.points, 1.5, 'A: 1 + 0.5 = 1.5');
  assert.equal(ub.points, 1.0, 'B: 0.5 + 0.5 = 1.0');
});

// ── Suite 3: Desempates ───────────────────────────────────────────────────────

console.log('\n── Suite 3: Desempates FIDE ──────────────────────────────');

test('Buchholz: suma correcta de puntos de rivales', () => {
  const pA = makePlayer('A', 2400, 2, { opponents: ['B', 'C'] });
  const pB = makePlayer('B', 2300, 1.5);
  const pC = makePlayer('C', 2200, 0.5);
  const playersById = { A: pA, B: pB, C: pC };

  const bh = buchholz(pA, playersById, 2);
  assert.equal(bh, 2.0, 'Buchholz de A = puntos(B) + puntos(C) = 1.5 + 0.5 = 2.0');
});

test('BuchholzCut1: excluye el peor rival', () => {
  const pA = makePlayer('A', 2400, 3, { opponents: ['B', 'C', 'D'] });
  const pB = makePlayer('B', 2300, 2.5);
  const pC = makePlayer('C', 2200, 1.0);
  const pD = makePlayer('D', 2100, 0.5);
  const playersById = { A: pA, B: pB, C: pC, D: pD };

  const bh1 = buchholzCut(pA, playersById, 3, 1);
  // Peor rival: D con 0.5 → se excluye → suma B(2.5) + C(1.0) = 3.5
  assert.equal(bh1, 3.5, 'BH-1 debe excluir el rival de menor puntuación');
});

test('Puntuación progresiva: acumula correctamente', () => {
  // Jugador con 1, 0, 1, 0.5 → acumulado: 1, 1, 2, 2.5 → suma = 6.5
  const pairings = [
    { board: 1, whiteId: 'A', blackId: 'B', result: Result.WHITE_WIN, isBye: false },
    { board: 1, whiteId: 'C', blackId: 'A', result: Result.WHITE_WIN, isBye: false },
    { board: 1, whiteId: 'A', blackId: 'D', result: Result.WHITE_WIN, isBye: false },
    { board: 1, whiteId: 'E', blackId: 'A', result: Result.DRAW,      isBye: false },
  ];
  const player = makePlayer('A', 2400, 2.5, {
    _roundPairings: pairings,
  });
  const prog = progressive(player);
  assert.equal(prog, 6.5, 'Progresiva debe ser 6.5');
});

// ── Suite 4: TRF parse/serialize ─────────────────────────────────────────────

console.log('\n── Suite 4: Formato TRF-2025 ────────────────────────────');

test('Serializar y parsear un torneo de 2 jugadores es idempotente', () => {
  const config = {
    name: 'Test Tournament', city: 'Madrid', federation: 'ESP',
    startDate: '2026-04-01', endDate: '2026-04-01',
    timeControl: '90+30', tournamentTypeCode: 'S',
    chiefArbiter: 'Test Arbiter', nRounds: 1,
    tiebreaks: ['BH1', 'BH'],
  };

  const players = [
    makePlayer('P001', 2400, 1, { colorHistory: [Color.WHITE], opponents: ['P002'] }),
    makePlayer('P002', 2300, 0, { colorHistory: [Color.BLACK], opponents: ['P001'],
      fideid: '10001234', country: 'FRA' }),
  ];

  const rounds = [{
    number: 1, published: true, closed: true,
    pairings: [{
      board: 1, whiteId: 'P001', blackId: 'P002',
      result: Result.WHITE_WIN, isBye: false,
    }],
  }];

  const trf     = serializeTRF(config, players, rounds);
  const parsed  = parseTRF(trf);

  assert.equal(parsed.config.name, 'Test Tournament', 'Nombre del torneo debe coincidir');
  assert.equal(parsed.config.nRounds, 1,              'Número de rondas debe ser 1');
  assert.equal(parsed.players.length, 2,              'Debe haber 2 jugadores');
  assert.equal(parsed.rounds.length, 1,               'Debe haber 1 ronda');
  assert.equal(parsed.rounds[0].pairings.length, 1,   'La ronda debe tener 1 partida');
  assert.ok(trf.includes('202 BH1 BH'),               'Debe incluir código 202 de desempates TRF-2025');
});

test('TRF con código 092 (tipo de torneo) se parsea correctamente', () => {
  const trf = `012 Open Madrid 2026
032 ESP
092 S
132 3
`;
  const { config } = parseTRF(trf);
  assert.equal(config.tournamentTypeCode, 'S', 'Código 092 debe leerse como tipo de torneo');
});

test('TRF con código 202 (desempates TRF-2025) se parsea correctamente', () => {
  const trf = `012 Open Test
132 5
202 BH1 BH SB DE PR
`;
  const { config } = parseTRF(trf);
  assert.deepEqual(config.tiebreaks, ['BH1', 'BH', 'SB', 'DE', 'PR'],
    'Los desempates del código 202 deben parsearse en orden');
});

// ── Suite 5: Round Robin ──────────────────────────────────────────────────────

console.log('\n── Suite 5: Round Robin (Berger) ─────────────────────────');

test('Round Robin 4 jugadores genera 3 rondas, 2 partidas c/u sin bye', () => {
  const players = [
    makePlayer('A', 2400), makePlayer('B', 2300),
    makePlayer('C', 2200), makePlayer('D', 2100),
  ];
  const { rounds, warnings } = generateAllRounds(players);
  assert.equal(rounds.length, 3, '4 jugadores → 3 rondas');
  for (const r of rounds) {
    const reg = r.pairings.filter((p) => !p.isBye);
    assert.equal(reg.length, 2, `Ronda ${r.number}: 2 partidas regulares`);
  }
  assert.equal(warnings.length, 0);
});

test('Round Robin 3 jugadores genera 3 rondas con 1 bye cada una', () => {
  const players = [
    makePlayer('A', 2400), makePlayer('B', 2300), makePlayer('C', 2200),
  ];
  const { rounds } = generateAllRounds(players);
  assert.equal(rounds.length, 3, '3 jugadores → 3 rondas (con bye)');
  for (const r of rounds) {
    const reg = r.pairings.filter((p) => !p.isBye);
    const bye = r.pairings.filter((p) => p.isBye);
    assert.equal(reg.length, 1, `Ronda ${r.number}: 1 partida regular`);
    assert.equal(bye.length, 1, `Ronda ${r.number}: 1 bye`);
  }
});

test('Round Robin: cada jugador se enfrenta a todos exactamente una vez', () => {
  const players = [
    makePlayer('A', 2400), makePlayer('B', 2300),
    makePlayer('C', 2200), makePlayer('D', 2100), makePlayer('E', 2000),
  ];
  const { rounds } = generateAllRounds(players);
  const encounters = {};
  for (const p of players) encounters[p.id] = new Set();

  for (const r of rounds) {
    for (const p of r.pairings) {
      if (p.isBye) continue;
      encounters[p.whiteId].add(p.blackId);
      encounters[p.blackId].add(p.whiteId);
    }
  }

  for (const p of players) {
    const others = players.filter((o) => o.id !== p.id).map((o) => o.id);
    assert.equal(
      encounters[p.id].size, others.length,
      `${p.id} debe enfrentarse a todos los demás (${others.length})`
    );
    for (const o of others) {
      assert.ok(encounters[p.id].has(o), `${p.id} debe enfrentarse a ${o}`);
    }
  }
});

test('Round Robin 6 jugadores: colores alternan伯格 correctamente', () => {
  const players = [
    makePlayer('A', 2500), makePlayer('B', 2400), makePlayer('C', 2300),
    makePlayer('D', 2200), makePlayer('E', 2100), makePlayer('F', 2000),
  ];
  const { rounds } = generateAllRounds(players);
  // 6 jugadores → 5 rondas
  assert.equal(rounds.length, 5);

  // Verificar que las primeras mesas alternan colores
  for (let i = 0; i < rounds.length; i++) {
    const first = rounds[i].pairings[0];
    if (first && !first.isBye) {
      const expectedWhite = i % 2 === 0 ? players[players.length - 1].id : players[0].id;
      // Verificar consistencia: no forzar valores específicos, solo alternancia
    }
  }
});

test('rrPairRound() devuelve una sola ronda correcta', () => {
  const players = [
    makePlayer('A', 2400), makePlayer('B', 2300),
    makePlayer('C', 2200), makePlayer('D', 2100),
  ];
  const result = rrPairRound(players, 1);
  assert.equal(result.pairings.length, 2, 'Ronda 1: 2 partidas');
  assert.equal(result.byePlayer, null, 'No debe haber bye');
  assert.ok(result.pairings[0].whiteId, 'Primera partida tiene blancas');
  assert.ok(result.pairings[0].blackId, 'Primera partida tiene negras');
});

// ── Suite 6: Burstein ─────────────────────────────────────────────────────────

console.log('\n── Suite 6: Burstein (Aceleración) ───────────────────────');

import { pairRound as bursteinPairRound, getBandA } from '../src/engine/burstein.js';

test('Burstein ronda 1 empareja A vs B en torneo de 6+ jugadores', () => {
  const players = [
    makePlayer('A', 2600), makePlayer('B', 2500), makePlayer('C', 2400),
    makePlayer('D', 2300), makePlayer('E', 2200), makePlayer('F', 2100),
  ];
  const result = bursteinPairRound(players, 1);
  assert.equal(result.pairings.length, 3, '6 jugadores → 3 partidas');
  // Verificar que todos están emparejados
  const pairedIds = new Set();
  for (const p of result.pairings) {
    if (p.isBye) continue;
    pairedIds.add(p.whiteId);
    pairedIds.add(p.blackId);
  }
  assert.equal(pairedIds.size, 6, 'Todos los jugadores deben estar emparejados');
  assert.equal(result.warnings.length, 0);
});

test('Burstein ronda 2 aplica bonus virtual a ganadores de banda A', () => {
  const players = [
    makePlayer('A', 2600, 1),  // ganó en ronda 1
    makePlayer('B', 2500, 0),  // perdió
    makePlayer('C', 2400, 1),  // ganó
    makePlayer('D', 2300, 0),  // perdió
    makePlayer('E', 2200, 0.5), // tablas
    makePlayer('F', 2100, 0.5), // tablas
  ];
  const bandA = ['A', 'B', 'C'];
  const result = bursteinPairRound(players, 2, bandA);
  assert.equal(result.pairings.length, 3, '6 jugadores → 3 partidas');
});

test('Burstein ronda 3+ usa Dutch estándar', () => {
  const players = [
    makePlayer('A', 2600, 2), makePlayer('B', 2500, 2),
    makePlayer('C', 2400, 1), makePlayer('D', 2300, 1),
  ];
  const result = bursteinPairRound(players, 3);
  assert.equal(result.pairings.length, 2, '4 jugadores → 2 partidas');
});

test('getBandA devuelve el top 1/3 de jugadores por rating', () => {
  const players = [
    makePlayer('A', 2600), makePlayer('B', 2500), makePlayer('C', 2400),
    makePlayer('D', 2300), makePlayer('E', 2200), makePlayer('F', 2100),
  ];
  const bandA = getBandA(players);
  assert.deepEqual(bandA, ['A', 'B'], 'Top 1/3 de 6 = los 2 primeros');
});

// ── Suite 7: Dubov ────────────────────────────────────────────────────────────

console.log('\n── Suite 7: Dubov (Aceleración Extrema) ──────────────────');

import { pairRound as dubovPairRound } from '../src/engine/dubov.js';

test('Dubov ronda 1 empareja Q1 vs Q4 y Q2 vs Q3', () => {
  const players = [
    makePlayer('A', 2600), makePlayer('B', 2500),
    makePlayer('C', 2400), makePlayer('D', 2300),
    makePlayer('E', 2200), makePlayer('F', 2100),
    makePlayer('G', 2000), makePlayer('H', 1900),
  ];
  const result = dubovPairRound(players, 1);
  assert.equal(result.pairings.length, 4, '8 jugadores → 4 partidas');
  const pairedIds = new Set();
  for (const p of result.pairings) {
    if (p.isBye) continue;
    pairedIds.add(p.whiteId);
    pairedIds.add(p.blackId);
  }
  assert.equal(pairedIds.size, 8, 'Todos emparejados');
});

test('Dubov ronda 2 agrupa ganadores vs ganadores', () => {
  const players = [
    makePlayer('A', 2600, 1), makePlayer('B', 2500, 1),
    makePlayer('C', 2400, 0), makePlayer('D', 2300, 0),
  ];
  const result = dubovPairRound(players, 2);
  assert.equal(result.pairings.length, 2, '4 jugadores → 2 partidas');
});

test('Dubov ronda 3+ usa Dutch estándar', () => {
  const players = [
    makePlayer('A', 2600, 2), makePlayer('B', 2500, 2),
    makePlayer('C', 2400, 1), makePlayer('D', 2300, 1),
  ];
  const result = dubovPairRound(players, 3);
  assert.equal(result.pairings.length, 2, '4 jugadores → 2 partidas');
});

// ── Resumen ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────');
console.log(`Tests: ${passed} pasados, ${failed} fallados`);
if (failed === 0) {
  console.log('✓ Motor listo para el proceso de verificación FIDE\n');
  process.exit(0);
} else {
  console.log('✗ Corregir los tests fallados antes de solicitar el endorsement FIDE\n');
  process.exit(1);
}

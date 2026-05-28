import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { serializeTRF, parseTRF } from '../src/trf/trf.js';

const MIN_CONFIG = {
  name: 'Test Tournament',
  federation: 'ESP',
  startDate: '2026-05-01',
  endDate: '2026-05-05',
  nRounds: 3,
  timeControl: '90+30',
  chiefArbiter: 'John Doe',
  tiebreaks: ['BH1', 'BH', 'SB'],
  extendedType: 'IND SWISS 3R',
};

const MIN_PLAYERS = [
  { id: '1', name: 'Magnus', lastName: 'Carlsen', fideRating: 2800, title: 'GM', country: 'NOR', fideid: '1503014', points: 3 },
  { id: '2', name: 'Hikaru', lastName: 'Nakamura', fideRating: 2750, title: 'GM', country: 'USA', fideid: '2016192', points: 2 },
  { id: '3', name: 'Alireza', lastName: 'Firouzja', fideRating: 2700, title: 'GM', country: 'FRA', fideid: '12573981', points: 1 },
];

const MIN_ROUNDS = [
  { number: 1, published: true, closed: true, pairings: [
    { board: 1, whiteId: '1', blackId: '2', result: '1', isBye: false },
    { board: 2, whiteId: '3', blackId: '', result: 'U', isBye: true },
  ]},
  { number: 2, published: true, closed: true, pairings: [
    { board: 1, whiteId: '2', blackId: '3', result: '=', isBye: false },
    { board: 2, whiteId: '1', blackId: '', result: 'H', isBye: true },
  ]},
  { number: 3, published: true, closed: true, pairings: [
    { board: 1, whiteId: '1', blackId: '3', result: '1', isBye: false },
    { board: 2, whiteId: '2', blackId: '', result: 'U', isBye: true },
  ]},
];

describe('serializeTRF', () => {
  it('generates valid TRF output', () => {
    const trf = serializeTRF(MIN_CONFIG, MIN_PLAYERS, MIN_ROUNDS);
    assert.ok(trf.includes('012 Test Tournament'));
    assert.ok(trf.includes('032 ESP'));
    assert.ok(trf.includes('062 3'));
    assert.ok(trf.includes('132 3'));
  });

  it('includes FIDE homologation fields', () => {
    const config = { ...MIN_CONFIG, deputyArbiter2: 'Jane Smith', tournamentDirector: 'Bob', address: 'Madrid', roundTime: '16:00' };
    const trf = serializeTRF(config, MIN_PLAYERS, MIN_ROUNDS);
    assert.ok(trf.includes('118 Jane Smith'));
    assert.ok(trf.includes('125 Bob'));
    assert.ok(trf.includes('128 Madrid'));
    assert.ok(trf.includes('138 16:00'));
  });

  it('generates 3 player lines with 001 prefix', () => {
    const trf = serializeTRF(MIN_CONFIG, MIN_PLAYERS, MIN_ROUNDS);
    const lines = trf.split('\n').filter(l => l.startsWith('001'));
    assert.equal(lines.length, 3);
  });

  it('sorts players by rating descending', () => {
    const trf = serializeTRF(MIN_CONFIG, MIN_PLAYERS, MIN_ROUNDS);
    const lines = trf.split('\n').filter(l => l.startsWith('001'));
    // Highest rated should be first (start rank 1)
    assert.ok(lines[0].includes('Carlsen'));
  });
});

describe('parseTRF', () => {
  it('parses serialized output back correctly', () => {
    const trf = serializeTRF(MIN_CONFIG, MIN_PLAYERS, MIN_ROUNDS);
    const parsed = parseTRF(trf);
    assert.equal(parsed.config.name, 'Test Tournament');
    assert.equal(parsed.config.nRounds, 3);
    assert.equal(parsed.players.length, 3);
  });

  it('detects bye rounds', () => {
    const trf = serializeTRF(MIN_CONFIG, MIN_PLAYERS, MIN_ROUNDS);
    const parsed = parseTRF(trf);
    const player1 = parsed.players.find(p => p.name === 'Magnus');
    assert.ok(player1.receivedBye);
  });
});

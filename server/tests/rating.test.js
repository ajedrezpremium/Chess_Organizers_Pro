import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getKFactor, expectedScore, totalRatingChange, calculateTPR, dpFromScore, perRoundChanges,
} from '../src/services/ratingChange.js';

describe('getKFactor — FIDE K-factor rules', () => {
  it('K=40 for new players (<26 games)', () => {
    assert.equal(getKFactor(1500, 0, null), 40);
    assert.equal(getKFactor(1500, 25, null), 40);
  });

  it('K=20 for players under 2400 with 26+ games', () => {
    assert.equal(getKFactor(2000, 30, null), 20);
    assert.equal(getKFactor(2399, 26, null), 20);
  });

  it('K=10 for players 2400+ with 26+ games', () => {
    assert.equal(getKFactor(2400, 30, null), 10);
    assert.equal(getKFactor(2700, 26, null), 10);
  });

  it('K=40 for players under 18 with <30 games', () => {
    assert.equal(getKFactor(2000, 28, '2010-01-01'), 40);
  });

  it('K=20 for players under 18 with 30+ games', () => {
    assert.equal(getKFactor(2000, 30, '2010-01-01'), 20);
  });
});

describe('expectedScore — Elo formula', () => {
  it('equal ratings give 0.5', () => {
    assert.equal(expectedScore(1500, 1500), 0.5);
  });

  it('400-point difference gives ~0.909 / ~0.091', () => {
    const e = expectedScore(1900, 1500);
    assert.ok(Math.abs(e - 0.909) < 0.01);
  });

  it('800-point difference gives ~0.99 / ~0.01', () => {
    const e = expectedScore(2300, 1500);
    assert.ok(Math.abs(e - 0.990) < 0.01);
  });
});

describe('dpFromScore — TPR formula', () => {
  it('50% score gives dp=0', () => {
    assert.equal(dpFromScore(5, 10), 0);
  });

  it('100% score gives dp=800', () => {
    assert.equal(dpFromScore(10, 10), 800);
  });

  it('0% score gives dp=-800', () => {
    assert.equal(dpFromScore(0, 10), -800);
  });

  it('75% score gives dp~=191', () => {
    const dp = dpFromScore(7.5, 10);
    assert.ok(Math.abs(dp - 191) < 1);
  });
});

describe('calculateTPR — Tournament Performance Rating', () => {
  it('returns null for empty data', () => {
    assert.equal(calculateTPR(1500, [], []), null);
  });

  it('TPR = avgOpp when score=50%', () => {
    const tpr = calculateTPR(1500, [1600, 1400], [1, 0]);
    assert.equal(tpr, 1500);
  });

  it('TPR > avgOpp when score > 50%', () => {
    const tpr = calculateTPR(1500, [1600, 1400, 1500], [1, 1, 1]);
    assert.ok(tpr > 1500);
  });

  it('handles single opponent correctly', () => {
    const tpr = calculateTPR(1500, [1700], [1]);
    assert.ok(tpr > 1700);
  });
});

describe('totalRatingChange — Per-tournament calculation', () => {
  it('returns 0 for no opponents', () => {
    const player = { fideRating: 1500, birthDate: null };
    assert.equal(totalRatingChange(player, [], []), 0);
  });

  it('calculates positive change for winning against stronger', () => {
    const player = { fideRating: 1500, gamesPlayed: 30, birthDate: null };
    // Win against 1700
    const delta = totalRatingChange(player, [{ fideRating: 1700 }], ['1']);
    assert.ok(delta > 0);
  });

  it('calculates negative change for losing to weaker', () => {
    const player = { fideRating: 1500, gamesPlayed: 30, birthDate: null };
    const delta = totalRatingChange(player, [{ fideRating: 1300 }], ['0']);
    assert.ok(delta < 0);
  });
});

describe('perRoundChanges — Round-by-round deltas', () => {
  const players = [
    { id: '1', name: 'Magnus', lastName: 'Carlsen', fideRating: 2800, birthDate: '1990-01-01' },
    { id: '2', name: 'Hikaru', lastName: 'Nakamura', fideRating: 2750, birthDate: '1987-01-01' },
  ];

  const rounds = [{
    round_number: 1,
    pairings: [{
      white_id: '1', black_id: '2',
      white_rating: 2800, black_rating: 2750,
      result: '1', is_bye: false,
    }],
  }];

  it('calculates per-round changes', () => {
    const chg = perRoundChanges(players, rounds);
    assert.ok(chg['1']);
    assert.ok(chg['2']);
    assert.equal(chg['1'].rounds.length, 1);
    assert.equal(chg['2'].rounds.length, 1);
  });

  it('includes TPR in results', () => {
    const chg = perRoundChanges(players, rounds);
    assert.ok(chg['1'].tpr !== undefined);
    assert.ok(chg['2'].tpr !== undefined);
  });
});

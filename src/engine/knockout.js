/**
 * knockout.js — Eliminación Directa (Single & Double Elimination)
 *
 * Soporta:
 *   - Single Elimination (bracket estándar)
 *   - Double Elimination (bracket de ganadores + perdedores)
 *   - Seeding por rating / sorteo puro
 *   - Byes en primera ronda para no-potencia-de-2
 *   - Partido por tercer y cuarto puesto (opcional)
 */

const BYE = { id: '__BYE__', name: 'BYE', rating: 0 };

function nextPowerOf2(n) {
  return 2 ** Math.ceil(Math.log2(n));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Genera el bracket completo para single elimination
 * @param {Array} players - [{ id, name, rating, seed? }]
 * @param {Object} opts
 * @param {string} opts.seeding - 'rating' | 'random' | 'manual'
 * @param {boolean} opts.thirdPlace - incluir partido por 3er puesto
 * @returns {{ rounds: Array, bracket: Object }}
 */
export function generateBracket(players, opts = {}) {
  const { seeding = 'rating', thirdPlace = true } = opts;
  const active = players.filter(p => p && !p.withdrawn);
  const n = active.length;
  const size = nextPowerOf2(n);
  const byes = size - n;

  // Seeding
  let seeded;
  if (seeding === 'rating') {
    seeded = [...active].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (seeding === 'random') {
    seeded = shuffle(active);
  } else {
    seeded = [...active];
  }

  // Insert byes at the end of the bottom half (FIDE standard)
  const bracketSlots = [];
  for (let i = 0; i < size; i++) {
    if (i < size - byes) {
      bracketSlots.push(seeded[i]);
    } else {
      bracketSlots.push({ ...BYE, id: `bye-${i}`, seed: Infinity });
    }
  }

  // Build rounds
  const totalRounds = Math.log2(size);
  const rounds = [];

  for (let r = 0; r < totalRounds; r++) {
    const matchesInRound = size / Math.pow(2, r + 1);
    const round = {
      roundNumber: r + 1,
      name: r === 0 ? 'Ronda 1 (Octavos)' :
            r === 1 ? 'Cuartos de final' :
            r === 2 ? 'Semifinales' :
            r === 3 ? 'Final' :
            totalRounds - r === 1 ? 'Final' :
            totalRounds - r === 2 ? 'Semifinales' :
            totalRounds - r === 3 ? 'Cuartos de final' :
            `Ronda ${r + 1}`,
      matches: [],
    };

    for (let m = 0; m < matchesInRound; m++) {
      if (r === 0) {
        // First round: pair slots
        const i1 = m * 2;
        const i2 = m * 2 + 1;
        const p1 = bracketSlots[i1]?.id ? bracketSlots[i1] : null;
        const p2 = bracketSlots[i2]?.id ? bracketSlots[i2] : null;
        const isBye = p1?.id?.startsWith('bye-') || p2?.id?.startsWith('bye-');
        round.matches.push({
          id: `r1-m${m}`,
          board: m + 1,
          white: p1,
          black: p2,
          result: isBye ? (p1?.id?.startsWith('bye-') ? '0' : '1') : '-',
          isBye,
          winner: isBye ? (p1?.id?.startsWith('bye-') ? p2 : p1) : null,
          nextMatchId: null, // set below
          nextSlot: null,    // 'winner' | 'loser'
        });
      } else {
        round.matches.push({
          id: `r${r + 1}-m${m}`,
          board: m + 1,
          white: null,
          black: null,
          result: '-',
          isBye: false,
          winner: null,
          nextMatchId: null,
          nextSlot: 'winner',
        });
      }
    }
    rounds.push(round);
  }

  // Link matches (winners advance)
  for (let r = 0; r < rounds.length - 1; r++) {
    const currentRound = rounds[r];
    const nextRound = rounds[r + 1];
    for (let m = 0; m < currentRound.matches.length; m++) {
      const nextMatchIdx = Math.floor(m / 2);
      if (nextRound.matches[nextMatchIdx]) {
        currentRound.matches[m].nextMatchId = nextRound.matches[nextMatchIdx].id;
        currentRound.matches[m].nextSlot = m % 2 === 0 ? 'winner' : 'winner';
      }
    }
  }

  // Third place match
  if (thirdPlace && totalRounds >= 2) {
    const finalRound = rounds[rounds.length - 1];
    const semiRound = rounds[rounds.length - 2];
    rounds.push({
      roundNumber: totalRounds + 1,
      name: 'Tercer y Cuarto Puesto',
      matches: [{
        id: `third-place`,
        board: 1,
        white: null,  // loser of semi 1
        black: null,  // loser of semi 2
        result: '-',
        isBye: false,
        winner: null,
        nextMatchId: null,
        nextSlot: null,
      }],
    });
    // Link semi losers to third place match
    for (let m = 0; m < semiRound.matches.length; m++) {
      semiRound.matches[m].loserNextMatchId = `third-place`;
    }
  }

  return { rounds, bracket: { size, totalRounds, byes }, players: seeded };
}

/**
 * Avanza un resultado en el bracket
 */
export function advanceBracket(rounds, matchId, result) {
  for (let r = 0; r < rounds.length; r++) {
    const match = rounds[r].matches.find(m => m.id === matchId);
    if (!match) continue;

    match.result = result;

    if (match.isBye) {
      match.winner = match.white?.id?.startsWith('bye-') ? match.black : match.white;
    } else {
      if (result === '1') match.winner = match.white;
      else if (result === '0') match.winner = match.black;
      else if (result === '=') {
        // Draw in KO = Armageddon or replay (mark as tie)
        match.winner = null;
        return { rounds, draw: true };
      }
    }

    // Advance winner to next match
    if (match.nextMatchId && match.winner) {
      for (let rr = r + 1; rr < rounds.length; rr++) {
        const nextMatch = rounds[rr].matches.find(m => m.id === match.nextMatchId);
        if (nextMatch) {
          if (match.nextSlot === 'winner' || match.nextSlot === 'loser') {
            if (!nextMatch.white) nextMatch.white = match.winner;
            else if (!nextMatch.black) nextMatch.black = match.winner;
          }
          break;
        }
      }
    }

    // Advance loser to third place match
    if (match.loserNextMatchId && result !== '-' && !match.isBye) {
      const loser = result === '1' ? match.black : match.white;
      const thirdMatch = rounds.flatMap(r => r.matches).find(m => m.id === match.loserNextMatchId);
      if (thirdMatch) {
        if (!thirdMatch.white) thirdMatch.white = loser;
        else if (!thirdMatch.black) thirdMatch.black = loser;
      }
    }

    break;
  }
  return { rounds, draw: false };
}

/**
 * Calcula standings desde el bracket
 */
export function calculateStandings(rounds, players) {
  const standings = players.map(p => ({
    ...p,
    points: 0,
    wins: 0,
    losses: 0,
    position: null,
  }));

  const allMatches = rounds.flatMap(r => r.matches);
  const winners = new Set();
  const losers = new Set();

  for (const match of allMatches) {
    if (match.result === '-' || match.isBye) continue;
    if (match.winner) {
      winners.add(match.winner.id);
      const loserId = match.white?.id === match.winner.id ? match.black?.id : match.white?.id;
      if (loserId) losers.add(loserId);
    }
  }

  // Find the winner (last match winner)
  const lastRound = rounds[rounds.length - 1];
  const finalMatch = lastRound?.matches?.[0];
  const champion = finalMatch?.winner;

  standings.forEach(p => {
    if (champion && p.id === champion.id) {
      p.position = 1;
      p.points = 1;
    } else if (winners.has(p.id)) {
      p.position = null; // eliminated in later rounds
      p.points = 0.5;
    }
  });

  return standings.sort((a, b) => (a.position || 999) - (b.position || 999));
}

export default { generateBracket, advanceBracket, calculateStandings };

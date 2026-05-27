export function getKFactor(rating, gamesPlayed) {
  if (gamesPlayed < 5) return 40;
  if (rating >= 2400) return 10;
  if (rating < 2400) return 20;
  return 20;
}

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function ratingChange(ratingA, ratingB, score) {
  if (ratingA === 0 || ratingB === 0) return 0;
  const we = expectedScore(ratingA, ratingB);
  const diff = score - we;
  return Math.round(diff * 1000) / 1000;
}

export function totalRatingChange(player, opponents, results) {
  let total = 0;
  let gamesPlayed = 0;
  for (let i = 0; i < opponents.length; i++) {
    if (!opponents[i]) continue;
    const oppRating = opponents[i].fideRating ?? 0;
    if (oppRating === 0 || player.fideRating === 0) continue;
    let score = 0;
    if (results[i] === '1') score = 1;
    else if (results[i] === '=') score = 0.5;
    else if (results[i] === '0') score = 0;
    else continue;
    total += ratingChange(player.fideRating, oppRating, score);
    gamesPlayed++;
  }
  const k = getKFactor(player.fideRating, gamesPlayed);
  return Math.round(total * k * 10) / 10;
}

export function calculateRatingChanges(players, rounds) {
  const playerMap = {};
  for (const p of players) {
    playerMap[p.id] = { ...p, ratings: [] };
  }

  const roundResults = {};
  for (const r of rounds) {
    for (const p of r.pairings) {
      if (p.white_id && !p.is_bye) {
        if (!roundResults[p.white_id]) roundResults[p.white_id] = { opponents: [], results: [] };
        if (!roundResults[p.black_id]) roundResults[p.black_id] = { opponents: [], results: [] };
      }
    }
  }

  for (const r of rounds) {
    for (const p of r.pairings) {
      if (p.is_bye) {
        if (p.white_id) {
          if (!roundResults[p.white_id]) roundResults[p.white_id] = { opponents: [], results: [] };
          roundResults[p.white_id].opponents.push(null);
          roundResults[p.white_id].results.push(p.result);
        }
        continue;
      }
      if (p.white_id && p.black_id) {
        if (!roundResults[p.white_id]) roundResults[p.white_id] = { opponents: [], results: [] };
        if (!roundResults[p.black_id]) roundResults[p.black_id] = { opponents: [], results: [] };
        roundResults[p.white_id].opponents.push({ id: p.black_id, fideRating: p.black_rating || 0 });
        roundResults[p.white_id].results.push(p.result === '1' ? '1' : p.result === '=' ? '=' : p.result === '0' ? '0' : '-');
        roundResults[p.black_id].opponents.push({ id: p.white_id, fideRating: p.white_rating || 0 });
        roundResults[p.black_id].results.push(p.result === '0' ? '1' : p.result === '=' ? '=' : p.result === '1' ? '0' : '-');
      }
    }
  }

  const changes = {};
  for (const p of players) {
    const data = roundResults[p.id];
    if (!data) { changes[p.id] = 0; continue; }
    changes[p.id] = totalRatingChange(p, data.opponents, data.results);
  }
  return changes;
}

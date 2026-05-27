export function getKFactor(rating, gamesPlayed) {
  if (gamesPlayed < 5) return 40;
  if (rating >= 2400) return 10;
  if (rating < 2400) return 20;
  return 20;
}

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function rawDelta(ratingA, ratingB, score) {
  if (ratingA === 0 || ratingB === 0) return 0;
  const we = expectedScore(ratingA, ratingB);
  return Math.round((score - we) * 1000) / 1000;
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
    total += rawDelta(player.fideRating, oppRating, score);
    gamesPlayed++;
  }
  const k = getKFactor(player.fideRating, gamesPlayed);
  return Math.round(total * k * 10) / 10;
}

function mapResult(result, isWhite) {
  if (result === '-') return null;
  const whiteScore = result === '1' ? 1 : result === '=' ? 0.5 : result === '0' ? 0 : null;
  if (whiteScore === null) return null;
  return isWhite ? whiteScore : 1 - whiteScore;
}

export function perRoundChanges(players, rounds) {
  const results = {};

  for (const p of players) {
    results[p.id] = { rounds: [], kFactor: 40 };
  }

  for (const r of rounds) {
    for (const p of r.pairings || []) {
      if (p.is_bye) {
        if (p.white_id && results[p.white_id]) {
          results[p.white_id].rounds.push(0);
        }
        continue;
      }
      if (p.white_id && p.black_id && results[p.white_id] && results[p.black_id]) {
        const wScore = mapResult(p.result, true);
        if (wScore !== null) {
          const wr = p.white_rating || 0;
          const br = p.black_rating || 0;
          results[p.white_id].rounds.push(rawDelta(wr, br, wScore));
          results[p.black_id].rounds.push(rawDelta(br, wr, 1 - wScore));
        } else {
          results[p.white_id].rounds.push(null);
          results[p.black_id].rounds.push(null);
        }
      }
    }

    for (const p of players) {
      if (results[p.id].rounds.length < r.round_number) {
        results[p.id].rounds.push(null);
      }
    }
  }

  for (const p of players) {
    const played = results[p.id].rounds.filter((v) => v !== null).length;
    results[p.id].kFactor = getKFactor(p.fideRating, played);
    results[p.id].total = Math.round(
      results[p.id].rounds.reduce((s, v) => s + (v || 0), 0) * results[p.id].kFactor * 10
    ) / 10;
  }

  return results;
}

export { rawDelta as ratingChange };

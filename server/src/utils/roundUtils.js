import { createPlayer } from '../../../src/engine/types.js';

export function buildPlayerState(db, tournamentId) {
  const rows = db.prepare(`
    SELECT tp.*, p.name, p.last_name, p.fide_rating, p.title, p.federation, p.fide_id
    FROM tournament_players tp JOIN players p ON tp.player_id = p.id
    WHERE tp.tournament_id = ?
    ORDER BY tp.seed_rank ASC
  `).all(tournamentId);

  return rows.map((row) => createPlayer({
    id: String(row.id),
    name: row.name,
    lastName: row.last_name,
    fideRating: row.fide_rating,
    title: row.title,
    country: row.federation,
    fideid: row.fide_id,
    category: row.category || '',
    points: row.current_points,
    colorDiff: row.color_diff,
    colorHistory: row.color_history ? JSON.parse(row.color_history) : [],
    opponents: row.opponents ? JSON.parse(row.opponents) : [],
    receivedBye: !!row.received_bye,
    withdrawn: !!row.withdrawn,
  }));
}

export function savePlayerState(db, tournamentId, players) {
  const upsert = db.prepare(`
    UPDATE tournament_players
    SET current_points = ?, color_diff = ?, color_history = ?, opponents = ?, received_bye = ?, withdrawn = ?
    WHERE id = ?
  `);
  for (const p of players) {
    upsert.run(
      p.points, p.colorDiff, JSON.stringify(p.colorHistory),
      JSON.stringify(p.opponents), p.receivedBye ? 1 : 0, p.withdrawn ? 1 : 0, parseInt(p.id)
    );
  }
}

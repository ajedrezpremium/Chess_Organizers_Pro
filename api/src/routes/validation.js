import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { buildPlayerState } from '../utils/roundUtils.js';
import { detectViolations, analyzeColorBalance } from '../../../src/engine/conflictDetector.js';
import { generateSuggestions } from '../../../src/engine/suggestionEngine.js';

const router = Router();

// GET /validation/:tid — análisis de conflictos y sugerencias
router.get('/:tid', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const players = await buildPlayerState(db, req.params.tid);

    const rounds = await db.prepare('SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC').all(req.params.tid);
    const engineRounds = [];
    for (const r of rounds) {
      const pairings = await db.prepare(`
        SELECT p.*, w.name as white_name, w.last_name as white_last, w.fide_rating as white_rating,
               b.name as black_name, b.last_name as black_last, b.fide_rating as black_rating
        FROM pairings p
        LEFT JOIN tournament_players tpw ON p.white_id = tpw.id
        LEFT JOIN players w ON tpw.player_id = w.id
        LEFT JOIN tournament_players tpb ON p.black_id = tpb.id
        LEFT JOIN players b ON tpb.player_id = b.id
        WHERE p.round_id = ?
        ORDER BY p.board ASC
      `).all(r.id);

      engineRounds.push({
        number: r.round_number,
        pairings: pairings.map((p) => ({
          board: p.board,
          whiteId: String(p.white_id),
          blackId: p.black_id ? String(p.black_id) : '',
          result: p.result,
          isBye: !!p.is_bye,
        })),
      });
    }

    const config = {
      nRounds: tournament.n_rounds,
      system: tournament.system,
      federation: tournament.federation,
    };

    const violations = detectViolations(players, engineRounds, config);
    const colorBalance = analyzeColorBalance(players);
    const suggestions = generateSuggestions(players, config, engineRounds);

    res.json({
      tournamentId: req.params.tid,
      playerCount: players.length,
      roundCount: rounds.length,
      totalPairings: engineRounds.reduce((s, r) => s + r.pairings.length, 0),
      violations,
      colorBalance,
      suggestions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

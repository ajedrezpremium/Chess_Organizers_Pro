import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { lookupPlayer } from '../services/external.js';

const router = Router();

// POST /external/lookup — buscar perfil en chess.com o lichess
router.post('/lookup', authenticate, async (req, res) => {
  try {
    const { platform, username } = req.body;
    if (!platform || !username) return res.status(400).json({ error: 'platform y username requeridos' });
    if (!['chesscom', 'lichess'].includes(platform)) {
      return res.status(400).json({ error: 'platform debe ser chesscom o lichess' });
    }

    const profile = await lookupPlayer(platform, username);
    res.json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /external/import — buscar e importar como jugador local
router.post('/import', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { platform, username, federation } = req.body;
    if (!platform || !username) return res.status(400).json({ error: 'platform y username requeridos' });

    const profile = await lookupPlayer(platform, username);

    // Get rating (prefer rapid, then blitz, then bullet)
    let rating = 0;
    if (platform === 'chesscom') {
      const stats = await (await import('../services/external.js')).chessComStats(username);
      rating = stats.chess_rapid?.rating || stats.chess_blitz?.rating || 0;
    } else {
      rating = profile.perfs?.rapid || profile.perfs?.classical || profile.perfs?.blitz || 0;
    }

    // Check if player already exists by fide_id or external_id pattern
    const externalId = `${platform}:${username}`;
    let existing = await db.prepare("SELECT * FROM players WHERE notes = ?").get(externalId);
    if (existing) return res.json({ player: existing, imported: false, message: 'Jugador ya importado' });

    // Create player
    const name = profile.name || profile.username;
    const lastName = '';
    const title = profile.title || '';

    const result = await db.prepare(`
      INSERT INTO players (name, last_name, fide_rating, title, federation, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, lastName, rating, title, federation || '', externalId);

    const player = await db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ player, imported: true, platform, username });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

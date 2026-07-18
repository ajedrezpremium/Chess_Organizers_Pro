import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { lookupPlayer } from '../services/external.js';

async function getScrapers() {
  return import('../services/scrapers.js');
}

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

// ================================================================
// CATÁLOGO GLOBAL DE TORNEOS (Scrapers reales + internas)
// ================================================================

// GET /external/sources — lista de fuentes disponibles
router.get('/sources', async (req, res) => {
  const sources = [
    {
      id: 'internal',
      name: 'Chess Organizers Pro',
      description: 'Torneos creados en nuestra plataforma',
      enabled: true,
      icon: '♛',
    },
    {
      id: 'chess-results',
      name: 'Chess-Results.com',
      description: 'Resultados de torneos FIDE y nacionales',
      enabled: true,
      icon: '🏆',
      rateLimit: '10 req/min',
    },
    {
      id: 'info64',
      name: 'Info64.org',
      description: 'Calendario y resultados de torneos en España',
      enabled: true,
      icon: '📅',
      rateLimit: '30 req/min',
    },
    {
      id: 'fide-calendar',
      name: 'FIDE Calendar',
      description: 'Calendario oficial de torneos FIDE',
      enabled: true,
      icon: '🌍',
      rateLimit: '60 req/min',
    },
    {
      id: 'ajedrezmadrid',
      name: 'Ajedrez Madrid',
      description: 'Torneos en la Comunidad de Madrid',
      enabled: true,
      icon: '🏛️',
      rateLimit: '30 req/min',
    },
  ];
  res.json(sources);
});

// GET /external/tournaments — catálogo unificado con scrapers reales
router.get('/tournaments', async (req, res) => {
  try {
    const {
      source = 'all',
      status = 'all',
      federation,
      country,
      city,
      system,
      from,
      to,
      search,
      page = 1,
      limit = 20,
      sort = 'start_date',
      order = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const filters = {
      source,
      status,
      federation,
      country,
      city,
      system,
      from,
      to,
      search,
      sort,
      order,
    };

    let allTournaments = await (await getScrapers()).fetchExternalTournaments(filters);

    // Add internal tournaments
    if (source === 'all' || source === 'internal') {
      const db = getDb();
      let sql = `
        SELECT
          t.id, t.name, t.system, t.n_rounds, t.federation, t.status,
          t.city, t.start_date, t.end_date, t.time_control, t.description,
          t.created_at, t.primary_color, t.secondary_color, t.logo_url,
          (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = t.id) as player_count
        FROM tournaments t
      `;
      const params = [];

      if (federation) { sql += ' AND t.federation = ?'; params.push(federation); }
      if (city) { sql += ' AND t.city LIKE ?'; params.push(`%${city}%`); }
      if (system) { sql += ' AND t.system = ?'; params.push(system); }
      if (from) { sql += ' AND t.start_date >= ?'; params.push(from); }
      if (to) { sql += ' AND t.start_date <= ?'; params.push(to); }
      if (search) { sql += ' AND (t.name LIKE ? OR t.city LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

      if (status === 'active') { sql += " AND t.status = 'active'"; }
      else if (status === 'finished') { sql += " AND t.status = 'finished'"; }
      else if (status === 'pending') { sql += " AND t.status = 'pending'"; }
      else if (status === 'upcoming') { sql += " AND t.status = 'pending' AND t.start_date > NOW()"; }

      const sortMap = {
        created_at: 't.created_at',
        start_date: 't.start_date',
        name: 't.name',
        players: 'player_count',
      };
      const sortCol = sortMap[sort] || 't.created_at';
      const orderDir = order === 'asc' ? 'ASC' : 'DESC';

      sql += ` ORDER BY ${sortCol} ${orderDir} LIMIT ? OFFSET ?`;
      params.push(limitNum, offset);

      const internal = await db.prepare(sql).all(...params);

      for (const t of internal) {
        allTournaments.push({
          ...t,
          source: 'internal',
          source_id: t.id,
          source_url: `/public/tournament/${t.id}`,
          is_internal: true,
        });
      }
    }

    // Deduplicate
    const seen = new Set();
    const unique = allTournaments.filter(t => {
      const key = `${t.name}|${t.city}|${t.start_date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort combined results
    unique.sort((a, b) => {
      const sortMap = {
        start_date: 'start_date',
        name: 'name',
        players: 'player_count',
        created_at: 'created_at',
      };
      const sortKey = sortMap[sort] || 'start_date';
      const aVal = a[sortKey] || a.created_at || a.start_date || '';
      const bVal = b[sortKey] || b.created_at || b.start_date || '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return order === 'asc' ? cmp : -cmp;
    });

    const total = unique.length;
    const paginated = unique.slice(offset, offset + limitNum);

    res.json({
      tournaments: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error('External tournaments error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /external/import-tournament — importar torneo externo a nuestra plataforma
router.post('/import-tournament', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { source, external_id } = req.body;

    if (!source || !external_id) {
      return res.status(400).json({ error: 'source y external_id requeridos' });
    }

    // Fetch real tournament from external source
    const tournaments = await (await getScrapers()).fetchExternalTournaments({ source, search: external_id });
    const tournament = tournaments.find(t => t.external_id === external_id || t.source_id === external_id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Torneo no encontrado en la fuente externa' });
    }

    // Crear torneo en nuestra BD
    const result = await db.prepare(`
      INSERT INTO tournaments (
        name, system, n_rounds, federation, city, start_date, end_date,
        time_control, status, description, created_by, primary_color, secondary_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, '#f59e0b', '#1f2937')
    `).run(
      tournament.name, tournament.system, tournament.n_rounds, tournament.federation, tournament.city,
      tournament.start_date, tournament.end_date, tournament.time_control,
      `Importado desde ${source}: ${tournament.source_url}`,
      req.user.id
    );

    const newTournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid);

    // Importar jugadores si existen
    if (tournament.players) {
      for (const p of tournament.players) {
        let player = await db.prepare('SELECT id FROM players WHERE fide_id = ?').get(p.fide_id);
        if (!player && p.name) {
          const pr = await db.prepare(`
            INSERT INTO players (name, last_name, fide_id, fide_rating, title, federation)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(p.name, p.last_name || '', p.fide_id || '', p.rating || 0, p.title || '', p.federation || '');
          player = { id: pr.lastInsertRowid };
        }
        if (player) {
          await db.prepare(`
            INSERT INTO tournament_players (tournament_id, player_id, seed_rank, current_points)
            VALUES (?, ?, ?, ?)
          `).run(newTournament.id, player.id, p.seed || 0, 0);
        }
      }
    }

    res.status(201).json({ tournament: newTournament, imported: true, source });
  } catch (err) {
    console.error('Import tournament error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /external/clear-cache — limpiar caché de scrapers (admin)
router.post('/clear-cache', authenticate, async (req, res) => {
  try {
    const { source } = req.body;
    (await getScrapers()).clearCache(source);
    res.json({ ok: true, message: source ? `Caché limpiada para ${source}` : 'Toda la caché limpiada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
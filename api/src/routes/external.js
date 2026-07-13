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

// ================================================================
// CATÁLOGO GLOBAL DE TORNEOS (Fuentes externas + internas)
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

// GET /external/tournaments — catálogo unificado con filtros
router.get('/tournaments', async (req, res) => {
  try {
    const db = getDb();
    const {
      source = 'all',        // 'internal', 'chess-results', 'info64', 'fide-calendar', 'ajedrezmadrid', 'all'
      status = 'all',        // 'active', 'finished', 'upcoming', 'all'
      federation,
      country,
      city,
      system,
      from,                  // YYYY-MM-DD
      to,                    // YYYY-MM-DD
      search,
      page = 1,
      limit = 20,
      sort = 'created_at',   // 'created_at', 'start_date', 'name', 'players'
      order = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let tournaments = [];

    // 1. Torneos internos (nuestra BD)
    if (source === 'all' || source === 'internal') {
      let sql = `
        SELECT
          t.id, t.name, t.system, t.n_rounds, t.federation, t.status,
          t.city, t.start_date, t.end_date, t.time_control, t.description,
          t.created_at, t.primary_color, t.secondary_color, t.logo_url,
          t.is_demo,
          (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = t.id) as player_count
        FROM tournaments t
        WHERE t.is_demo = 0
      `;
      const params = [];

      if (federation) { sql += ' AND t.federation = ?'; params.push(federation); }
      if (city) { sql += ' AND t.city LIKE ?'; params.push(`%${city}%`); }
      if (system) { sql += ' AND t.system = ?'; params.push(system); }
      if (from) { sql += ' AND t.start_date >= ?'; params.push(from); }
      if (to) { sql += ' AND t.start_date <= ?'; params.push(to); }
      if (search) { sql += ' AND (t.name LIKE ? OR t.city LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

      // Status filter
      if (status === 'active') { sql += " AND t.status = 'active'"; }
      else if (status === 'finished') { sql += " AND t.status = 'finished'"; }
      else if (status === 'pending' || status === 'upcoming') { sql += " AND t.status = 'pending'"; }
      else if (status === 'demo') { sql += " AND t.is_demo = 1"; }

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

      // Add source metadata
      for (const t of internal) {
        tournaments.push({
          ...t,
          source: 'internal',
          source_id: t.id,
          source_url: `/public/tournament/${t.id}`,
          is_internal: true,
        });
      }
    }

    // 2. Torneos externos - Mock data por ahora (en producción: scrapers reales)
    if (source === 'all' || ['chess-results', 'info64', 'fide-calendar', 'ajedrezmadrid'].includes(source)) {
      const externalTournaments = getMockExternalTournaments(source, { status, federation, city, system, search, from, to });
      tournaments.push(...externalTournaments);
    }

    // Sort combined results if needed
    if (source === 'all') {
      tournaments.sort((a, b) => {
        const aVal = a[sort] || a.created_at || a.start_date || '';
        const bVal = b[sort] || b.created_at || b.start_date || '';
        const cmp = String(aVal).localeCompare(String(bVal));
        return order === 'asc' ? cmp : -cmp;
      });
    }

    // Paginate combined results
    const total = tournaments.length;
    const paginated = tournaments.slice(offset, offset + limitNum);

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

    // En producción: fetch real del torneo desde la fuente externa
    // Por ahora: crear torneo demo basado en mock data
    const mock = getMockExternalTournaments(source).find(t => t.external_id === external_id);
    if (!mock) {
      return res.status(404).json({ error: 'Torneo no encontrado en la fuente externa' });
    }

    // Crear torneo en nuestra BD
    const result = await db.prepare(`
      INSERT INTO tournaments (
        name, system, n_rounds, federation, city, start_date, end_date,
        time_control, status, description, created_by, primary_color, secondary_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, '#f59e0b', '#1f2937')
    `).run(
      mock.name, mock.system, mock.n_rounds, mock.federation, mock.city,
      mock.start_date, mock.end_date, mock.time_control,
      `Importado desde ${source}: ${mock.source_url}`,
      req.user.id
    );

    const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid);

    // Importar jugadores si existen en mock
    if (mock.players) {
      for (const p of mock.players) {
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
          `).run(tournament.id, player.id, p.seed || 0, 0);
        }
      }
    }

    res.status(201).json({ tournament, imported: true, source });
  } catch (err) {
    console.error('Import tournament error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// MOCK DATA - En producción reemplazar con scrapers reales
// ================================================================

function getMockExternalTournaments(source, filters = {}) {
  const now = new Date();
  const baseMocks = {
    'chess-results': [
      {
        external_id: 'cr-12345',
        name: 'VII Open Internacional Ciudad de Madrid',
        system: 'dutch',
        n_rounds: 9,
        federation: 'FIDE',
        country: 'ESP',
        city: 'Madrid',
        start_date: '2026-07-15',
        end_date: '2026-07-20',
        time_control: '90+30',
        status: 'active',
        description: 'Torneo abierto internacional con 300+ jugadores',
        source_url: 'https://chess-results.com/tnr12345.aspx',
        player_count: 287,
        players: [
          { name: 'Ivan', last_name: 'Salgado', fide_id: '2209342', rating: 2685, title: 'GM', federation: 'ESP', seed: 1 },
          { name: 'Eduardo', last_name: 'Iturrizaga', fide_id: '3900243', rating: 2652, title: 'GM', federation: 'VEN', seed: 2 },
        ],
      },
      {
        external_id: 'cr-12346',
        name: 'IX Festival de Ajedrez Barcelona',
        system: 'dutch',
        n_rounds: 10,
        federation: 'FIDE',
        country: 'ESP',
        city: 'Barcelona',
        start_date: '2026-08-01',
        end_date: '2026-08-10',
        time_control: '90+30',
        status: 'upcoming',
        description: 'Festival con múltiples torneos paralelos',
        source_url: 'https://chess-results.com/tnr12346.aspx',
        player_count: 412,
      },
      {
        external_id: 'cr-12347',
        name: 'Copa de España por Equipos 2026',
        system: 'dutch',
        n_rounds: 7,
        federation: 'FEDA',
        country: 'ESP',
        city: 'Valencia',
        start_date: '2026-06-01',
        end_date: '2026-06-04',
        time_control: '45+15',
        status: 'finished',
        description: 'Campeonato de España por equipos',
        source_url: 'https://chess-results.com/tnr12347.aspx',
        player_count: 128,
      },
      {
        external_id: 'cr-12348',
        name: 'Open Internacional Andorra 2026',
        system: 'dutch',
        n_rounds: 9,
        federation: 'FIDE',
        country: 'AND',
        city: 'Andorra la Vella',
        start_date: '2026-07-25',
        end_date: '2026-08-02',
        time_control: '90+30',
        status: 'upcoming',
        description: 'Torneo en el Principado de Andorra',
        source_url: 'https://chess-results.com/tnr12348.aspx',
        player_count: 156,
      },
      {
        external_id: 'cr-12349',
        name: 'Magnus Carlsen Invitational 2026',
        system: 'roundrobin',
        n_rounds: 10,
        federation: 'FIDE',
        country: 'NOR',
        city: 'Stavanger',
        start_date: '2026-05-20',
        end_date: '2026-05-30',
        time_control: 'Classical',
        status: 'finished',
        description: 'Torneo de élite con los mejores del mundo',
        source_url: 'https://chess-results.com/tnr12349.aspx',
        player_count: 10,
      },
    ],
    'info64': [
      {
        external_id: 'i64-5678',
        name: 'LXXXII Campeonato de España Absoluto',
        system: 'dutch',
        n_rounds: 11,
        federation: 'FEDA',
        country: 'ESP',
        city: 'Linares',
        start_date: '2026-07-10',
        end_date: '2026-07-20',
        time_control: '90+30',
        status: 'active',
        description: 'Campeonato nacional absoluto',
        source_url: 'https://info64.org/...',
        player_count: 120,
      },
      {
        external_id: 'i64-5679',
        name: 'Open Internacional La Roda 2026',
        system: 'dutch',
        n_rounds: 9,
        federation: 'FIDE',
        country: 'ESP',
        city: 'La Roda',
        start_date: '2026-08-15',
        end_date: '2026-08-22',
        time_control: '90+30',
        status: 'upcoming',
        description: 'Tradicional open de verano en Albacete',
        source_url: 'https://info64.org/...',
        player_count: 200,
      },
      {
        external_id: 'i64-5680',
        name: 'I Torneo Ciudad de Toledo',
        system: 'dutch',
        n_rounds: 7,
        federation: 'FEDA',
        country: 'ESP',
        city: 'Toledo',
        start_date: '2026-09-01',
        end_date: '2026-09-03',
        time_control: '60+30',
        status: 'upcoming',
        description: 'Nuevo torneo en la ciudad imperial',
        source_url: 'https://info64.org/...',
        player_count: 80,
      },
      {
        external_id: 'i64-5681',
        name: 'Open Internacional Benasque 2026',
        system: 'dutch',
        n_rounds: 10,
        federation: 'FIDE',
        country: 'ESP',
        city: 'Benasque',
        start_date: '2026-07-01',
        end_date: '2026-07-10',
        time_control: '90+30',
        status: 'finished',
        description: 'Uno de los opens más prestigiosos de España',
        source_url: 'https://info64.org/...',
        player_count: 350,
      },
      {
        external_id: 'i64-5682',
        name: 'Campeonato de España Sub-18 2026',
        system: 'dutch',
        n_rounds: 9,
        federation: 'FEDA',
        country: 'ESP',
        city: 'Salobreña',
        start_date: '2026-04-15',
        end_date: '2026-04-20',
        time_control: '90+30',
        status: 'finished',
        description: 'Campeonato nacional juvenil',
        source_url: 'https://info64.org/...',
        player_count: 180,
      },
    ],
    'fide-calendar': [
      {
        external_id: 'fide-2026-001',
        name: 'FIDE World Cup 2026',
        system: 'knockout',
        n_rounds: 7,
        federation: 'FIDE',
        country: 'AZE',
        city: 'Baku',
        start_date: '2026-08-10',
        end_date: '2026-08-28',
        time_control: 'Classical',
        status: 'upcoming',
        description: 'Copa del Mundo FIDE - Clasificatorio para Candidatos',
        source_url: 'https://ratings.fide.com/calendar/',
        player_count: 206,
      },
      {
        external_id: 'fide-2026-002',
        name: 'FIDE Grand Swiss 2026',
        system: 'dutch',
        n_rounds: 11,
        federation: 'FIDE',
        country: 'ENG',
        city: 'Isle of Man',
        start_date: '2026-10-15',
        end_date: '2026-10-27',
        time_control: 'Classical',
        status: 'upcoming',
        description: 'Gran Suizo FIDE - Clasificatorio Candidatos',
        source_url: 'https://ratings.fide.com/calendar/',
        player_count: 150,
      },
      {
        external_id: 'fide-2026-003',
        name: 'European Individual Championship 2026',
        system: 'dutch',
        n_rounds: 11,
        federation: 'ECU',
        country: 'MNE',
        city: 'Podgorica',
        start_date: '2026-03-10',
        end_date: '2026-03-20',
        time_control: '90+30',
        status: 'finished',
        description: 'Campeonato de Europa Individual',
        source_url: 'https://ratings.fide.com/calendar/',
        player_count: 380,
      },
    ],
    'ajedrezmadrid': [
      {
        external_id: 'am-1001',
        name: 'XXV Open Internacional Villa de Madrid',
        system: 'dutch',
        n_rounds: 9,
        federation: 'FIDE',
        country: 'ESP',
        city: 'Madrid',
        start_date: '2026-07-01',
        end_date: '2026-07-07',
        time_control: '90+30',
        status: 'upcoming',
        description: 'Open clásico de la capital',
        source_url: 'https://ajedrezmadrid.com/...',
        player_count: 250,
      },
      {
        external_id: 'am-1002',
        name: 'Torneo Navidad Madrid 2025',
        system: 'dutch',
        n_rounds: 7,
        federation: 'FEDA',
        country: 'ESP',
        city: 'Madrid',
        start_date: '2025-12-26',
        end_date: '2025-12-30',
        time_control: '60+30',
        status: 'finished',
        description: 'Tradicional torneo navideño',
        source_url: 'https://ajedrezmadrid.com/...',
        player_count: 180,
      },
      {
        external_id: 'am-1003',
        name: 'Liga Madrileña de Ajedrez 2026 - División Honor',
        system: 'roundrobin',
        n_rounds: 14,
        federation: 'FEDA',
        country: 'ESP',
        city: 'Madrid',
        start_date: '2026-01-15',
        end_date: '2026-05-30',
        time_control: '90+30',
        status: 'active',
        description: 'Liga por equipos de la Comunidad de Madrid',
        source_url: 'https://ajedrezmadrid.com/...',
        player_count: 80,
      },
      {
        external_id: 'am-1004',
        name: 'Open Internacional Alcalá de Henares 2026',
        system: 'dutch',
        n_rounds: 9,
        federation: 'FIDE',
        country: 'ESP',
        city: 'Alcalá de Henares',
        start_date: '2026-08-20',
        end_date: '2026-08-26',
        time_control: '90+30',
        status: 'upcoming',
        description: 'Open en ciudad patrimonio de la humanidad',
        source_url: 'https://ajedrezmadrid.com/...',
        player_count: 160,
      },
      {
        external_id: 'am-1005',
        name: 'Copa de la Comunidad de Madrid 2026',
        system: 'dutch',
        n_rounds: 6,
        federation: 'FEDA',
        country: 'ESP',
        city: 'Madrid',
        start_date: '2026-05-01',
        end_date: '2026-05-03',
        time_control: '45+15',
        status: 'upcoming',
        description: 'Copa por equipos regional',
        source_url: 'https://ajedrezmadrid.com/...',
        player_count: 120,
      },
    ],
  };

  const mocks = baseMocks[source] || [];
  return mocks.filter(t => {
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active' && t.status !== 'active') return false;
      if (filters.status === 'finished' && t.status !== 'finished') return false;
      if (filters.status === 'upcoming' && t.status !== 'upcoming') return false;
    }
    if (filters.federation && t.federation !== filters.federation) return false;
    if (filters.city && !t.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.system && t.system !== filters.system) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!t.name.toLowerCase().includes(s) && !t.city.toLowerCase().includes(s)) return false;
    }
    if (filters.from && t.start_date < filters.from) return false;
    if (filters.to && t.start_date > filters.to) return false;
    return true;
  }).map(t => ({
    ...t,
    source,
    source_id: t.external_id,
    is_internal: false,
    created_at: t.start_date,
  }));
}

export default router;
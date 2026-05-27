import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import * as fideService from '../services/fideRating.js';
import { submitTRF } from '../services/trfSubmit.js';
import { serializeTRF } from '../../../src/trf/trf.js';
import { buildPlayerState } from '../utils/roundUtils.js';
import { DEFAULT_TIEBREAK_ORDER } from '../../../src/engine/types.js';

const router = Router();

// GET /fide/search?q=
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Mínimo 2 caracteres' });
    const [last, first = ''] = q.split(',').map((s) => s.trim());
    const results = await fideService.searchPlayers(last || q, first);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Error al consultar FIDE', details: err.message });
  }
});

// GET /fide/rating/:fideId
router.get('/rating/:fideId', authenticate, async (req, res) => {
  try {
    const data = await fideService.getRating(req.params.fideId);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Error al consultar FIDE', details: err.message });
  }
});

// POST /fide/import/:fideId — importar jugador desde FIDE a la BD local
router.post('/import/:fideId', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const data = await fideService.getRating(req.params.fideId);

    const existing = db.prepare('SELECT id FROM players WHERE fide_id = ?').get(data.fide_id || req.params.fideId);
    if (existing) return res.json({ id: existing.id, message: 'Jugador ya existente' });

    const result = db.prepare(`
      INSERT INTO players (fide_id, name, last_name, title, federation, fide_rating)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.fide_id || req.params.fideId,
      data.name || '',
      data.last_name || '',
      data.title || '',
      data.federation || '',
      data.rating || 0,
    );

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(player);
  } catch (err) {
    res.status(502).json({ error: 'Error al importar desde FIDE', details: err.message });
  }
});

// POST /fide/bulk-import — importación masiva de jugadores desde FIDE
router.post('/bulk-import', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { fide_ids } = req.body;
    if (!fide_ids || !Array.isArray(fide_ids) || fide_ids.length === 0) {
      return res.status(400).json({ error: 'Lista de FIDE IDs requerida' });
    }

    const imported = []; const skipped = []; const errors = [];

    for (const fid of fide_ids) {
      try {
        const existing = db.prepare('SELECT id, name, last_name FROM players WHERE fide_id = ?').get(fid);
        if (existing) { skipped.push({ fide_id: fid, name: `${existing.name} ${existing.last_name}` }); continue; }

        const data = await fideService.getRating(fid);
        const result = db.prepare(`INSERT INTO players (fide_id, name, last_name, title, federation, fide_rating) VALUES (?, ?, ?, ?, ?, ?)`).run(
          data.fide_id || fid, data.name || '', data.last_name || '', data.title || '', data.federation || '', data.rating || 0,
        );
        const player = db.prepare('SELECT id, fide_id, name, last_name, fide_rating FROM players WHERE id = ?').get(result.lastInsertRowid);
        imported.push(player);
      } catch (e) {
        errors.push({ fide_id: fid, error: e.message });
      }
    }

    res.json({ imported, skipped, errors, total: fide_ids.length });
  } catch (err) {
    res.status(500).json({ error: 'Error en importación masiva', details: err.message });
  }
});

// GET /fide/federation/:fed?month= — listar jugadores de una federación (descarga masiva)
router.get('/federation/:fed', authenticate, async (req, res) => {
  try {
    const month = req.query.month || '';
    const csv = await fideService.downloadRatingList(req.params.fed, month);
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="fide_${req.params.fed}${month ? '_'+month : ''}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(502).json({ error: 'Error al descargar lista FIDE', details: err.message });
  }
});

// POST /fide/bulk-import-fed — importar todos los jugadores de una federación desde FIDE
router.post('/bulk-import-fed', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { federation, month } = req.body;
    if (!federation) return res.status(400).json({ error: 'Federación requerida' });

    const csv = await fideService.downloadRatingList(federation, month || '');
    const lines = csv.split('\n').slice(1).filter(Boolean);
    const imported = []; const skipped = []; let errors = 0;

    for (const line of lines) {
      try {
        const parts = line.split(',');
        const fid = parts[0]?.trim();
        if (!fid) continue;

        const existing = db.prepare('SELECT id FROM players WHERE fide_id = ?').get(fid);
        if (existing) { skipped.push(fid); continue; }

        const name = parts[1]?.trim() || '';
        const lastName = parts[2]?.trim() || '';
        const title = parts[4]?.trim() || '';
        const rating = parseInt(parts[6]?.trim()) || 0;

        const result = db.prepare(`INSERT INTO players (fide_id, name, last_name, title, federation, fide_rating) VALUES (?, ?, ?, ?, ?, ?)`).run(fid, name, lastName, title, federation, rating);
        const player = db.prepare('SELECT id, fide_id, name, last_name, fide_rating FROM players WHERE id = ?').get(result.lastInsertRowid);
        imported.push(player);
      } catch {
        errors++;
      }
    }

    res.json({ imported, skipped: skipped.length, errors, total: lines.length });
  } catch (err) {
    res.status(500).json({ error: 'Error al importar federación', details: err.message });
  }
});

// POST /fide/submit/:tournamentId — enviar TRF a FIDE
router.post('/submit/:tournamentId', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tournamentId, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

    const players = buildPlayerState(db, req.params.tournamentId);
    const closedRounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.tournamentId);

    const rounds = closedRounds.map((r) => {
      const pairings = db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
      return {
        number: r.round_number,
        published: true,
        closed: true,
        pairings: pairings.map((p) => ({
          board: p.board, whiteId: String(p.white_id),
          blackId: p.black_id ? String(p.black_id) : '',
          result: p.result, isBye: !!p.is_bye,
        })),
      };
    });

    const trfContent = serializeTRF({
      name: tournament.name, city: tournament.city, federation: tournament.federation,
      startDate: tournament.start_date, endDate: tournament.end_date,
      timeControl: tournament.time_control, tournamentTypeCode: 'S',
      chiefArbiter: tournament.chief_arbiter, nRounds: tournament.n_rounds,
      tiebreaks: (tournament.tiebreaks ?? '').split(',').filter(Boolean),
      extendedType: `IND SWISS ${tournament.n_rounds}R`,
    }, players, rounds);

    const submission = await submitTRF(req.params.tournamentId, trfContent, tournament.federation);
    res.json(submission);
  } catch (err) {
    res.status(502).json({ error: 'Error al enviar a FIDE', details: err.message });
  }
});

export default router;

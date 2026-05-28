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
    db.prepare('UPDATE tournaments SET submitted_to_fide = 1, submitted_at = datetime(\'now\') WHERE id = ?').run(req.params.tournamentId);
    res.json(submission);
  } catch (err) {
    res.status(502).json({ error: 'Error al enviar a FIDE', details: err.message });
  }
});

// GET /fide/report/:tournamentId — Reporte FIDE homologado (HTML)
router.get('/report/:tournamentId', authenticate, (req, res) => {
  const db = getDb();
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.tournamentId);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  const players = buildPlayerState(db, req.params.tournamentId);
  const tOrder = (tournament.tiebreaks || DEFAULT_TIEBREAK_ORDER).split(',').filter(Boolean);
  const standings = calculateTiebreak(players, null, tOrder);

  const rounds = db.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND status = 'closed' ORDER BY round_number ASC").all(req.params.tournamentId);

  const tBody = (label, val) => `<tr><td style="font-weight:600;padding:4px 12px;border:1px solid #ccc;background:#f5f5f5">${label}</td><td style="padding:4px 12px;border:1px solid #ccc">${val || '-'}</td></tr>`;

  let html = `<html><head><meta charset="utf-8"><title>FIDE Report — ${tournament.name}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;max-width:900px;margin:auto;padding:20px}
h1{text-align:center;color:#1a237e;font-size:18px}
table{width:100%;border-collapse:collapse;margin:10px 0}
th{background:#1a237e;color:#fff;padding:6px 8px;font-size:11px;text-align:center}
td{padding:4px 8px;border:1px solid #ccc;font-size:11px}
.alt{background:#f9f9f9}
.footer{text-align:center;margin-top:20px;font-size:10px;color:#666}
</style></head><body>
<h1>FIDE Tournament Report</h1>
<table>${tBody('Event', tournament.name)}${tBody('FIDE ID', tournament.fide_event_id)}${tBody('Federation', tournament.federation)}${tBody('City', tournament.city)}${tBody('Address', tournament.location_address)}${tBody('Dates', tournament.start_date + (tournament.end_date ? ' — '+tournament.end_date : ''))}${tBody('System', tournament.system)}${tBody('Rounds', tournament.n_rounds)}${tBody('Time Control', tournament.time_control)}${tBody('Chief Arbiter', tournament.chief_arbiter)}${tBody('Deputy Arbiter', tournament.deputy_arbiter)}${tBody('Tournament Director', tournament.tournament_director)}${tBody('Rated', tournament.rated ? 'Yes' : 'No')}</table>

<h2>Final Standings</h2>
<table><thead><tr><th>#</th><th>Name</th><th>Title</th><th>FED</th><th>FIDE ID</th><th>Rating</th><th>Points</th><th>BH1</th><th>BH</th><th>SB</th></tr></thead><tbody>`;

  for (const p of standings) {
    const tv = p.tiebreakValues || [];
    html += `<tr${standings.indexOf(p) % 2 ? ' class="alt"' : ''}><td style="text-align:center">${standings.indexOf(p) + 1}</td><td>${p.name} ${p.lastName || ''}</td><td style="text-align:center">${p.title || ''}</td><td style="text-align:center">${p.federation || ''}</td><td style="text-align:center">${p.fideId || ''}</td><td style="text-align:center">${p.rating || 0}</td><td style="text-align:center;font-weight:bold">${p.points}</td>${tv.slice(0, 3).map(v => `<td style="text-align:center">${typeof v === 'number' ? v.toFixed(2) : v}</td>`).join('')}</tr>`;
  }

  html += `</tbody></table>`;

  if (rounds.length) {
    html += `<h2>Round Schedule & Results</h2>`;
    for (const r of rounds) {
      const pairings = db.prepare('SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC').all(r.id);
      html += `<h3>Round ${r.round_number}</h3><table><thead><tr><th>Board</th><th>White</th><th>Result</th><th>Black</th></tr></thead><tbody>`;
      for (const p of pairings) {
        const w = players.find(x => x.id == p.white_id);
        const b = players.find(x => x.id == p.black_id);
        html += `<tr><td style="text-align:center">${p.board}</td><td>${w ? w.name + ' ' + (w.lastName||'') + ' (' + (w.rating||0) + ')' : 'BYE'}</td><td style="text-align:center;font-weight:bold">${p.result === 'U' ? '½-½' : p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : p.result}</td><td>${b ? b.name + ' ' + (b.lastName||'') + ' (' + (b.rating||0) + ')' : '-'}</td></tr>`;
      }
      html += `</tbody></table>`;
    }
  }

  html += `<div class="footer">Generated by Chess Organizers Pro — FIDE Homologated Report<br>${new Date().toISOString()}</div></body></html>`;

  res.type('html').send(html);
});

export default router;

import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { parseCSV, detectColumnMap, suggestColumnMap, importPlayers, importPlayersFromTRF } from '../services/importer.js';

const router = Router();

// POST /import/preview-csv — previsualizar CSV sin importar
router.post('/preview-csv', authenticate, (req, res) => {
  try {
    const { csv, format } = req.body;
    if (!csv) return res.status(400).json({ error: 'Contenido CSV requerido' });

    const delimiter = format === 'tsv' ? '\t' : format === 'vega' ? ';' : undefined;
    const { headers, rows } = parseCSV(csv, { delimiter });
    const columnSuggestions = suggestColumnMap(headers);
    const sample = rows.slice(0, 5);

    res.json({ headers, totalRows: rows.length, sample, columnSuggestions });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /import/players/:tid — importar jugadores desde CSV/TSV
router.post('/players/:tid', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { csv, column_map, format } = req.body;
    if (!csv || !column_map) return res.status(400).json({ error: 'csv y column_map requeridos' });

    // Verify ownership
    const t = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

    const delimiter = format === 'tsv' ? '\t' : format === 'vega' ? ';' : undefined;
    const { rows } = parseCSV(csv, { delimiter });

    const results = importPlayers(db, req.params.tid, req.user.id, rows, column_map);
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /import/trf/:tid — importar desde archivo TRF
router.post('/trf/:tid', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { trf } = req.body;
    if (!trf) return res.status(400).json({ error: 'Contenido TRF requerido' });

    const t = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

    const results = importPlayersFromTRF(db, req.params.tid, trf);
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /import/tsv/:tid — importar TSV (Vega-style)
router.post('/tsv/:tid', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { tsv, column_map } = req.body;
    if (!tsv || !column_map) return res.status(400).json({ error: 'tsv y column_map requeridos' });

    const t = db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(req.params.tid, req.user.id);
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado' });

    const { rows } = parseCSV(tsv, { delimiter: '\t' });
    const results = importPlayers(db, req.params.tid, req.user.id, rows, column_map);
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

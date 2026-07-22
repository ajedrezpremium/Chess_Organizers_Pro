import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'scans');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato no permitido. Use JPG, PNG, WebP o PDF.'), false);
  },
});

// POST /scan/upload — subir archivo para escanear
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    // Check scan limits based on user's plan
    const membership = await db.prepare(`
      SELECT um.*, mp.monthly_scans_limit
      FROM user_memberships um 
      JOIN membership_plans mp ON mp.id = um.plan_id
      WHERE um.user_id = ? AND um.status = 'active'
      ORDER BY um.id DESC LIMIT 1
    `).get(userId);

    if (!membership) {
      return res.status(403).json({ 
        error: 'No tienes una membresía activa', 
        code: 'NO_MEMBERSHIP',
        upgrade_required: true 
      });
    }

    const monthlyLimit = membership.monthly_scans_limit || 0;
    if (monthlyLimit > 0) {
      // Count scans this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const scansThisMonth = await db.prepare(`
        SELECT COUNT(*) as count FROM scan_jobs 
        WHERE user_id = ? AND created_at >= ?
      `).get(userId, startOfMonth.toISOString());

      if (scansThisMonth.count >= monthlyLimit) {
        return res.status(403).json({ 
          error: `Límite mensual de escaneos alcanzado (${monthlyLimit}/mes). Actualiza tu plan para más escaneos.`,
          code: 'SCAN_LIMIT_EXCEEDED',
          limit: monthlyLimit,
          used: scansThisMonth.count,
          upgrade_required: true
        });
      }
    } else if (monthlyLimit === 0) {
      return res.status(403).json({ 
        error: 'Tu plan no incluye escaneos. Actualiza a Básico o Pro para usar el escáner.',
        code: 'SCAN_NOT_INCLUDED',
        upgrade_required: true
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const { tournament_id } = req.body;

    // Create scan job
    const jobId = uuidv4();
    const job = {
      id: jobId,
      user_id: userId,
      tournament_id: tournament_id || null,
      file_path: req.file.path,
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      status: 'queued',
      progress: 0,
      current_step: 'uploaded',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.prepare(`
      INSERT INTO scan_jobs (id, user_id, tournament_id, file_path, file_name, file_size, mime_type, status, progress, current_step, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id, job.user_id, job.tournament_id, job.file_path, job.file_name,
      job.file_size, job.mime_type, job.status, job.progress, job.current_step,
      job.created_at, job.updated_at
    );

    // Trigger async processing (in production: add to BullMQ queue)
    processScanJob(jobId).catch(err => console.error('Scan job error:', err));

    res.status(201).json({ job });
  } catch (err) {
    console.error('Scan upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /scan/:jobId/status — estado del job
router.get('/:jobId/status', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const job = await db.prepare('SELECT * FROM scan_jobs WHERE id = ? AND user_id = ?').get(req.params.jobId, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /scan/:jobId/result — resultado parseado
router.get('/:jobId/result', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const job = await db.prepare('SELECT * FROM scan_jobs WHERE id = ? AND user_id = ?').get(req.params.jobId, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });

    const games = await db.prepare('SELECT * FROM scan_games WHERE job_id = ? ORDER BY round_number, board_number').all(req.params.jobId);

    res.json({
      job,
      games,
      metadata: job.result_metadata ? JSON.parse(job.result_metadata) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /scan/:jobId/import — importar partidas a torneo
router.post('/:jobId/import', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { tournament_id, game_ids } = req.body;
    const jobId = req.params.jobId;

    const job = await db.prepare('SELECT * FROM scan_jobs WHERE id = ? AND user_id = ?').get(jobId, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Job no completado' });

    // Verify tournament access
    const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ? AND created_by = ?').get(tournament_id, req.user.id);
    if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado o sin permisos' });

    const placeholders = game_ids.map(() => '?').join(',');
    const games = await db.prepare(`SELECT * FROM scan_games WHERE job_id = ? AND id IN (${placeholders})`).all(jobId, ...game_ids);

    let imported = 0;
    for (const game of games) {
      // Create or find players
      let whiteId = await findOrCreatePlayer(db, game.white_name, game.white_last_name, game.white_fide_id, game.white_rating, game.white_title, game.white_federation);
      let blackId = await findOrCreatePlayer(db, game.black_name, game.black_last_name, game.black_fide_id, game.black_rating, game.black_title, game.black_federation);

      // Add to tournament_players if not exists
      await db.prepare(`
        INSERT OR IGNORE INTO tournament_players (tournament_id, player_id, seed_rank)
        VALUES (?, ?, 0)
      `).run(tournament_id, whiteId);
      await db.prepare(`
        INSERT OR IGNORE INTO tournament_players (tournament_id, player_id, seed_rank)
        VALUES (?, ?, 0)
      `).run(tournament_id, blackId);

      // Get tournament_player IDs
      const tpWhite = await db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?').get(tournament_id, whiteId);
      const tpBlack = await db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?').get(tournament_id, blackId);

      // Create pairing in a new or existing round
      let round = await db.prepare('SELECT * FROM rounds WHERE tournament_id = ? AND status = ? ORDER BY round_number DESC LIMIT 1').get(tournament_id, 'generated');
      if (!round) {
        const rResult = await db.prepare('INSERT INTO rounds (tournament_id, round_number, status) VALUES (?, 1, ?)').run(tournament_id, 'generated');
        round = { id: rResult.lastInsertRowid, round_number: 1 };
      }

      const nextBoard = await db.prepare('SELECT COALESCE(MAX(board), 0) + 1 as next FROM pairings WHERE round_id = ?').get(round.id);

      await db.prepare(`
        INSERT INTO pairings (round_id, board, white_id, black_id, result, white_rating, black_rating)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(round.id, nextBoard.next, tpWhite.id, tpBlack.id, game.result || '-', game.white_rating || 0, game.black_rating || 0);

      // Mark game as imported
      await db.prepare('UPDATE scan_games SET imported = 1, imported_at = ? WHERE id = ?').run(new Date().toISOString(), game.id);
      imported++;
    }

    res.json({ imported, message: `${imported} partidas importadas al torneo` });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /scan/jobs — listar jobs del usuario
router.get('/jobs', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await db.prepare(`
      SELECT j.*, t.name as tournament_name
      FROM scan_jobs j
      LEFT JOIN tournaments t ON j.tournament_id = t.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, parseInt(limit), offset);

    const total = await db.prepare('SELECT COUNT(*) as c FROM scan_jobs WHERE user_id = ?').get(req.user.id);

    res.json({ jobs, total: total.c, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /scan/:jobId/export — exportar en formato
router.get('/:jobId/export', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const { format = 'pgn' } = req.query;
    const job = await db.prepare('SELECT * FROM scan_jobs WHERE id = ? AND user_id = ?').get(req.params.jobId, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });

    const games = await db.prepare('SELECT * FROM scan_games WHERE job_id = ? ORDER BY round_number, board_number').all(req.params.jobId);

    let content = '';
    let filename = `scan-${job.id}.${format}`;
    let contentType = 'text/plain';

    switch (format) {
      case 'pgn':
        content = gamesToPGN(games, job);
        contentType = 'application/x-chess-pgn';
        break;
      case 'json':
        content = JSON.stringify({ games, tournament: job.tournament_name }, null, 2);
        contentType = 'application/json';
        break;
      case 'trf':
        content = gamesToTRF(games, job);
        contentType = 'application/xml';
        break;
      case 'cbv':
        // CBV is binary - return info for client-side generation
        return res.json({ message: 'CBV export requires client-side generation', games });
      default:
        return res.status(400).json({ error: 'Formato no soportado' });
    }

    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// ASYNC PROCESSING (in production use BullMQ + Redis)
// ================================================================

async function processScanJob(jobId) {
  const db = getDb();

  const updateJob = async (updates) => {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), jobId];
    await db.prepare(`UPDATE scan_jobs SET ${sets}, updated_at = ? WHERE id = ?`).run(...values, new Date().toISOString(), jobId);
  };

  try {
    const job = await db.prepare('SELECT * FROM scan_jobs WHERE id = ?').get(jobId);
    if (!job) throw new Error('Job no encontrado');

    await updateJob({ status: 'processing', current_step: 'ocr', progress: 10 });

    // STEP 1: OCR - Extract text from image/PDF
    const ocrText = await performOCR(job.file_path, job.mime_type);
    await updateJob({ current_step: 'llm_parse', progress: 40, ocr_text: ocrText });

    // STEP 2: LLM Vision - Parse tournament structure
    const parsed = await parseWithLLM(ocrText, job.file_path, job.mime_type);
    await updateJob({ current_step: 'validation', progress: 70, parsed_data: JSON.stringify(parsed) });

    // STEP 3: Validate and normalize games
    const games = validateAndNormalizeGames(parsed);
    await updateJob({ current_step: 'saving', progress: 90 });

    // Save games
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      await db.prepare(`
        INSERT INTO scan_games (job_id, round_number, board_number, white_name, white_last_name, white_fide_id, white_rating, white_title, white_federation,
          black_name, black_last_name, black_fide_id, black_rating, black_title, black_federation, result, moves, confidence, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        jobId, g.round || 1, g.board || i + 1,
        g.white?.name, g.white?.lastName, g.white?.fideId, g.white?.rating, g.white?.title, g.white?.federation,
        g.black?.name, g.black?.lastName, g.black?.fideId, g.black?.rating, g.black?.title, g.black?.federation,
        g.result || '-', g.moves || '', g.confidence || 0, JSON.stringify(g.metadata || {})
      );
    }

    await updateJob({ status: 'completed', current_step: 'completed', progress: 100, result_metadata: JSON.stringify({ gamesCount: games.length, tournament: parsed.tournament }) });
  } catch (err) {
    console.error('Scan job error:', err);
    await updateJob({ status: 'failed', error_message: err.message, progress: 0 });
  }
}

// OCR using Tesseract.js (client-side would be better for large files)
async function performOCR(filePath, mimeType) {
  try {
    // For production: use Google Vision API, Azure Document Intelligence, or AWS Textract
    // This is a placeholder - in real implementation, call external OCR service
    
    if (mimeType === 'application/pdf') {
      // PDF: would use pdf-parse + tesseract on each page
      return `[OCR placeholder for PDF: ${filePath}]`;
    }
    
    // Image: use Tesseract.js
    // const { createWorker } = await import('tesseract.js');
    // const worker = await createWorker('spa');
    // const { data: { text } } = await worker.recognize(filePath);
    // await worker.terminate();
    // return text;
    
    return `[OCR placeholder for image: ${filePath}]`;
  } catch (err) {
    console.error('OCR error:', err);
    return '';
  }
}

// Parse with LLM Vision (OpenRouter)
async function parseWithLLM(ocrText, filePath, mimeType) {
  try {
    // In production: call OpenRouter API with vision model
    // For now: return mock parsed data
    
    // This would be the prompt sent to GPT-4o / Nemotron / Gemini
    const prompt = `
Eres un experto en ajedrez. Analiza este texto extraído de un libro de actas/planilla de torneo y extrae:
1. Metadatos del torneo (nombre, fecha, ciudad, sistema, rondas, control de tiempo)
2. Lista de partidas con: ronda, mesa, blancas (nombre, apellido, ELO, título, federación), negras (igual), resultado, movimientos si están disponibles

Texto OCR:
${ocrText}

Responde SOLO en JSON válido con esta estructura:
{
  "tournament": { "name": "", "city": "", "federation": "", "system": "", "rounds": 0, "time_control": "" },
  "games": [
    { "round": 1, "board": 1, "white": { "name": "", "lastName": "", "rating": 0, "title": "", "federation": "", "fideId": "" }, "black": { ... }, "result": "1-0", "moves": "1.e4 e5 2.Nf3 Nc6", "confidence": 0.9 }
  ]
}
`;

    // Mock response for development
    return {
      tournament: {
        name: 'Torneo Escaneado',
        city: 'Madrid',
        federation: 'FIDE',
        system: 'dutch',
        rounds: 5,
        time_control: '90+30',
      },
      games: [
        {
          round: 1, board: 1,
          white: { name: 'Magnus', lastName: 'Carlsen', rating: 2831, title: 'GM', federation: 'NOR', fideId: '1503014' },
          black: { name: 'Fabiano', lastName: 'Caruana', rating: 2796, title: 'GM', federation: 'USA', fideId: '2020009' },
          result: '1/2-1/2', moves: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.0-0 Be7', confidence: 0.95,
        },
        {
          round: 1, board: 2,
          white: { name: 'Hikaru', lastName: 'Nakamura', rating: 2780, title: 'GM', federation: 'USA', fideId: '2016192' },
          black: { name: 'Ian', lastName: 'Nepomniachtchi', rating: 2758, title: 'GM', federation: 'FIDE', fideId: '4168119' },
          result: '1-0', moves: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2', confidence: 0.9,
        },
      ],
    };
  } catch (err) {
    console.error('LLM parse error:', err);
    return { tournament: {}, games: [] };
  }
}

function validateAndNormalizeGames(parsed) {
  const games = parsed.games || [];
  return games.map(g => ({
    ...g,
    result: ['1-0', '0-1', '1/2-1/2', '*', '-'].includes(g.result) ? g.result : '-',
    confidence: Math.max(0, Math.min(1, g.confidence || 0)),
    metadata: g.metadata || {},
  }));
}

async function findOrCreatePlayer(db, name, lastName, fideId, rating, title, federation) {
  let player = null;
  
  if (fideId) {
    player = await db.prepare('SELECT id FROM players WHERE fide_id = ?').get(fideId);
  }
  if (!player && name && lastName) {
    player = await db.prepare('SELECT id FROM players WHERE name = ? AND last_name = ?').get(name, lastName);
  }
  
  if (!player) {
    const result = await db.prepare(`
      INSERT INTO players (name, last_name, fide_id, fide_rating, title, federation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name || '', lastName || '', fideId || '', rating || 0, title || '', federation || '');
    player = { id: result.lastInsertRowid };
  }
  
  return player.id;
}

function gamesToPGN(games, job) {
  let pgn = '';
  for (const g of games) {
    pgn += `[Event "${job.tournament_name || 'Scanned Tournament'}"]\n`;
    pgn += `[Site "${job.city || ''}"]\n`;
    pgn += `[Date "${new Date().toISOString().split('T')[0]}"]\n`;
    pgn += `[Round "${g.round}"]\n`;
    pgn += `[White "${g.white_name} ${g.white_last_name}"]\n`;
    pgn += `[Black "${g.black_name} ${g.black_last_name}"]\n`;
    pgn += `[Result "${g.result}"]\n`;
    if (g.white_rating) pgn += `[WhiteElo "${g.white_rating}"]\n`;
    if (g.black_rating) pgn += `[BlackElo "${g.black_rating}"]\n`;
    if (g.white_title) pgn += `[WhiteTitle "${g.white_title}"]\n`;
    if (g.black_title) pgn += `[BlackTitle "${g.black_title}"]\n`;
    pgn += `[WhiteFideId "${g.white_fide_id}"]\n`;
    pgn += `[BlackFideId "${g.black_fide_id}"]\n`;
    pgn += `\n${g.moves || ''} ${g.result}\n\n`;
  }
  return pgn;
}

function gamesToTRF(games, job) {
  // Simplified TRF XML - in production use proper FIDE TRF generator
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Tournament>\n`;
  xml += `  <Name>${job.tournament_name || 'Scanned Tournament'}</Name>\n`;
  xml += `  <Federation>${job.federation || 'FIDE'}</Federation>\n`;
  xml += `  <Games>\n`;
  for (const g of games) {
    xml += `    <Game>\n`;
    xml += `      <Round>${g.round}</Round>\n`;
    xml += `      <Board>${g.board}</Board>\n`;
    xml += `      <White><Name>${g.white_name} ${g.white_last_name}</Name><FideId>${g.white_fide_id}</FideId><Rating>${g.white_rating}</Rating><Title>${g.white_title}</Title></White>\n`;
    xml += `      <Black><Name>${g.black_name} ${g.black_last_name}</Name><FideId>${g.black_fide_id}</FideId><Rating>${g.black_rating}</Rating><Title>${g.black_title}</Title></Black>\n`;
    xml += `      <Result>${g.result}</Result>\n`;
    xml += `      <Moves>${g.moves}</Moves>\n`;
    xml += `    </Game>\n`;
  }
  xml += `  </Games>\n</Tournament>`;
  return xml;
}

export default router;
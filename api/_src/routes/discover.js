import { Router } from 'express';
import { getDiscover } from '../services/discover.js';

const router = Router();

// GET /discover — torneos reales: en vivo (Lichess Broadcast),
// destacados oficiales y próximos. Cache 10 min en servidor.
// Respuesta: { live, upcoming, finished, updatedAt, source }
router.get('/', async (req, res) => {
  try {
    const data = await getDiscover();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener torneos en vivo', live: [], upcoming: [], finished: [] });
  }
});

export default router;

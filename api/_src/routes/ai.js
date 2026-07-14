import { Router } from 'express';
import { askFideRules } from '../services/ai.js';

const router = Router();

// POST /ai/fide — preguntar a la IA sobre reglas FIDE
router.post('/fide', async (req, res) => {
  try {
    const { question, history } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Se requiere una pregunta' });
    }
    const response = await askFideRules(question.trim(), history || []);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar la IA' });
  }
});

export default router;

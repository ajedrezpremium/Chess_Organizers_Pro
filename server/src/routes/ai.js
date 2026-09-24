import { Router } from 'express';
import { askFideRules } from '../services/ai.js';
import { normalizeAiLang } from '../data/fide-system-prompt.js';

const router = Router();

const REQUIRED_MSG = {
  es: 'Se requiere una pregunta',
  en: 'A question is required',
  fr: 'Une question est requise',
  de: 'Eine Frage ist erforderlich',
  pt: 'É necessária uma pergunta',
};

const ERROR_MSG = {
  es: 'Error al consultar la IA',
  en: 'Error querying the AI',
  fr: 'Erreur lors de la consultation de l’IA',
  de: 'Fehler bei der KI-Abfrage',
  pt: 'Erro ao consultar a IA',
};

// POST /ai/fide — preguntar a la IA sobre reglas FIDE
// Body: { question, history?, lang? } — lang: es|en|fr|de|pt (defecto: es)
router.post('/fide', async (req, res) => {
  try {
    const { question, history, lang } = req.body;
    const l = normalizeAiLang(lang);
    if (!question || !question.trim()) {
      return res.status(400).json({ error: REQUIRED_MSG[l], lang: l });
    }
    const response = await askFideRules(question.trim(), history || [], l);
    res.json(response);
  } catch (err) {
    const l = normalizeAiLang(req.body?.lang);
    res.status(500).json({ error: ERROR_MSG[l], lang: l });
  }
});

export default router;

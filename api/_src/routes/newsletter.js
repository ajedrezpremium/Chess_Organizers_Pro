import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.post('/subscribe', async (req, res) => {
  try {
    const db = getDb();
    const { email, locale } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email inválido' });
    try {
      await db.prepare('INSERT INTO newsletter_subscribers (email, locale) VALUES (?, ?)').run(email.toLowerCase().trim(), locale || 'es');
    } catch (e) {
      if (e.message.includes('unique') || e.message.includes('duplicate')) {
        await db.prepare('UPDATE newsletter_subscribers SET active = 1, locale = ? WHERE email = ?').run(locale || 'es', email.toLowerCase().trim());
      } else throw e;
    }
    res.json({ ok: true, message: 'Suscrito' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/subscribers', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.prepare('SELECT COUNT(*) as count FROM newsletter_subscribers WHERE active = 1').get();
    res.json({ count: rows.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

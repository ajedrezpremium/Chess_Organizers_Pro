import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTelegramMessage, verifyBotToken } from '../services/telegram.js';
import { sendTwilioMessage } from '../services/twilio.js';

const router = Router();

// Get user notifications (in-app)
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { limit = 20, unread } = req.query;
  let sql = `SELECT n.*, t.name as tournament_name FROM notifications n LEFT JOIN tournaments t ON n.tournament_id = t.id WHERE n.user_id = ?`;
  const params = [req.user.id];
  if (unread === 'true') { sql += ` AND n.read = 0`; }
  sql += ` ORDER BY n.created_at DESC LIMIT ?`;
  params.push(parseInt(limit, 10));
  const notifications = db.prepare(sql).all(...params);
  const unreadCount = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0`).get(req.user.id).c;
  res.json({ ok: true, notifications, unreadCount });
});

// Mark notification as read
router.patch('/:id/read', authenticate, (req, res) => {
  const db = getDb();
  const n = db.prepare(`SELECT id FROM notifications WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!n) return res.status(404).json({ ok: false, error: 'Notificación no encontrada' });
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// Mark all as read
router.patch('/read-all', authenticate, (req, res) => {
  const db = getDb();
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(req.user.id);
  res.json({ ok: true });
});

// Get notification settings
router.get('/settings', authenticate, (req, res) => {
  const db = getDb();
  let s = db.prepare(`SELECT * FROM user_notification_settings WHERE user_id = ?`).get(req.user.id);
  if (!s) {
    db.prepare(`INSERT INTO user_notification_settings (user_id) VALUES (?)`).run(req.user.id);
    s = db.prepare(`SELECT * FROM user_notification_settings WHERE user_id = ?`).get(req.user.id);
  }
  delete s.id;
  delete s.user_id;
  res.json({ ok: true, settings: s });
});

// Update notification settings
router.patch('/settings', authenticate, (req, res) => {
  const db = getDb();
  const allowed = ['telegram_token', 'telegram_chat_id', 'twilio_phone', 'email_enabled', 'notify_rounds', 'notify_results', 'notify_finished'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(req.body[key]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ ok: false, error: 'Sin campos' });
  vals.push(req.user.id);
  db.prepare(`INSERT INTO user_notification_settings (user_id) VALUES (?) ON CONFLICT(user_id) DO UPDATE SET ${sets.join(', ')}`).run(req.user.id, ...vals.slice(0, -1));
  db.prepare(`UPDATE user_notification_settings SET ${sets.join(', ')} WHERE user_id = ?`).run(...vals);
  res.json({ ok: true });
});

// Test Telegram
router.post('/test-telegram', authenticate, (req, res) => {
  const { token, chatId } = req.body;
  if (!token || !chatId) return res.status(400).json({ ok: false, error: 'Token y chat ID requeridos' });
  sendTelegramMessage(token, chatId, '✅ <b>Chess Organizers Pro</b>\nConexión exitosa. Recibirás notificaciones de tus torneos aquí.')
    .then(r => res.json(r))
    .catch(err => res.status(500).json({ ok: false, error: err.message }));
});

// Verify Telegram bot token
router.post('/verify-telegram', authenticate, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ ok: false, error: 'Token requerido' });
  verifyBotToken(token)
    .then(ok => res.json({ ok }))
    .catch(err => res.status(500).json({ ok: false, error: err.message }));
});

export default router;

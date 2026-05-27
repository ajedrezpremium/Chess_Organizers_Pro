import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const SALT_ROUNDS = 12;

// POST /auth/register
router.post('/register', validate({
  email: { type: 'email', required: true },
  password: { type: 'string', required: true, min: 6 },
  name: { type: 'string', required: true },
  role: { type: 'string' },
  federation: { type: 'string' },
}), async (req, res) => {
  try {
    const db = getDb();
    const { email, password, name, role, federation } = req.body;

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role, federation) VALUES (?, ?, ?, ?, ?)'
    ).run(email, hash, name, role ?? 'organizer', federation ?? '');

    const token = generateToken({
      id: result.lastInsertRowid,
      email, name, role: role ?? 'organizer',
    });

    res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, email, name, role: role ?? 'organizer' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post('/login', validate({
  email: { type: 'email', required: true },
  password: { type: 'string', required: true },
}), async (req, res) => {
  try {
    const db = getDb();
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = generateToken({
      id: user.id, email: user.email, name: user.name, role: user.role,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/me
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, role, federation, fide_id, verified, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

// POST /auth/push-token — guarda token de push notification (Expo/APNS/FCM)
router.post('/push-token', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    // Store in user record or a dedicated push_tokens table
    try { db.exec(`ALTER TABLE users ADD COLUMN push_token TEXT DEFAULT ''`); } catch {}
    try { db.exec(`ALTER TABLE users ADD COLUMN push_platform TEXT DEFAULT ''`); } catch {}
    db.prepare(`UPDATE users SET push_token = ?, push_platform = ? WHERE id = ?`).run(token, platform || '', req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

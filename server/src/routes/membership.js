import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import config from '../config.js';

const router = Router();

// GET /membership/plans — lista todos los planes
router.get('/plans', async (req, res) => {
  const db = getDb();
  const plans = await db.prepare('SELECT * FROM membership_plans ORDER BY price_usd ASC').all();
  res.json(plans);
});

// GET /membership/my — membresía del usuario autenticado
router.get('/my', authenticate, async (req, res) => {
  const db = getDb();
  const membership = await db.prepare(`
    SELECT um.*, mp.name as plan_name, mp.slug as plan_slug, mp.max_tournaments, mp.max_players_per_tournament, mp.features
    FROM user_memberships um JOIN membership_plans mp ON mp.id = um.plan_id
    WHERE um.user_id = ? AND um.status = 'active'
    ORDER BY um.id DESC LIMIT 1
  `).get(req.user.id);

  const activeCount = (await db.prepare("SELECT COUNT(*) as c FROM tournaments WHERE created_by = ? AND status = 'active'").get(req.user.id)).c;

  res.json({ membership, active_tournaments: activeCount });
});

// POST /membership/subscribe — suscribirse a un plan
router.post('/subscribe', authenticate, async (req, res) => {
  const db = getDb();
  const { plan_slug } = req.body;
  if (!plan_slug) return res.status(400).json({ error: 'Se requiere plan_slug' });

  const plan = await db.prepare('SELECT * FROM membership_plans WHERE slug = ?').get(plan_slug);
  if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });

  // Free plan: direct subscription (no payment)
  if (plan.price_usd === 0) {
    await db.prepare("UPDATE user_memberships SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(req.user.id);
    await db.prepare('INSERT INTO user_memberships (user_id, plan_id, status) VALUES (?, ?, ?)').run(req.user.id, plan.id, 'active');

    const membership = await db.prepare(`
      SELECT um.*, mp.name as plan_name, mp.slug as plan_slug, mp.max_tournaments, mp.max_players_per_tournament, mp.features
      FROM user_memberships um JOIN membership_plans mp ON mp.id = um.plan_id
      WHERE um.id = (SELECT MAX(id) FROM user_memberships WHERE user_id = ?)
    `).get(req.user.id);

    return res.status(201).json({ ok: true, membership });
  }

  // Paid plan: require Stripe checkout
  if (!config.stripe.secretKey) {
    return res.status(400).json({ error: 'Stripe no configurado. Los planes de pago no están disponibles.' });
  }

  // Return checkout URL for paid plans
  res.json({
    ok: false,
    requires_checkout: true,
    plan_slug,
    checkout_url: `/api/stripe/create-checkout-session`,
  });
});

export default router;

/**
 * stripe.js — Rutas de Stripe
 *
 * POST /stripe/create-checkout-session
 * POST /stripe/create-portal-session
 * POST /stripe/webhook
 * GET  /stripe/config
 */
import express, { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import config from '../config.js';
import { createCheckoutSession, createPortalSession, handleWebhook } from '../services/stripe.js';

const router = Router();

// GET /stripe/config — devuelve estado de stripe al frontend
router.get('/config', async (req, res) => {
  res.json({
    enabled: !!config.stripe.secretKey,
    publicKey: '', // Publishable key devuelta desde frontend via VITE_STRIPE_KEY
  });
});

// POST /stripe/create-checkout-session
router.post('/create-checkout-session', authenticate, async (req, res) => {
  try {
    const { plan_slug, success_url, cancel_url } = req.body;
    if (!plan_slug) return res.status(400).json({ error: 'Se requiere plan_slug' });

    const result = await createCheckoutSession({
      user: req.user,
      planSlug: plan_slug,
      successUrl: success_url || `${config.publicUrl}/pricing`,
      cancelUrl: cancel_url || `${config.publicUrl}/pricing`,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /stripe/create-portal-session
router.post('/create-portal-session', authenticate, async (req, res) => {
  try {
    const { return_url } = req.body;
    const result = await createPortalSession({
      user: req.user,
      returnUrl: return_url || `${config.publicUrl}/pricing`,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /stripe/webhook — raw body required for signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const result = await handleWebhook(req.body, sig);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

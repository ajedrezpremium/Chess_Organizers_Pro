/**
 * stripe.js — Servicio de integración con Stripe
 *
 * Maneja creación de Checkout Sessions, gestión de suscripciones,
 * y procesamiento de webhooks.
 */
import Stripe from 'stripe';
import config from '../config.js';
import { getDb } from '../db/index.js';

const stripeKey = config.stripe.secretKey;
/** @type {import('stripe').default|null} */
let stripe = null;

if (stripeKey) {
  stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31' });
}

const PRICE_MAP = {
  free: config.stripe.priceFree || '',
  basico: config.stripe.priceBasico || '',
  pro: config.stripe.pricePro || '',
};

/**
 * Crea un Checkout Session para suscripción
 */
export async function createCheckoutSession({ user, planSlug, successUrl, cancelUrl }) {
  if (!stripe) {
    throw new Error('Stripe no está configurado (STRIPE_SECRET_KEY faltante)');
  }

  const db = getDb();
  const plan = db.prepare('SELECT * FROM membership_plans WHERE slug = ?').get(planSlug);
  if (!plan) throw new Error('Plan no encontrado');
  if (plan.price_usd === 0) throw new Error('Plan gratuito no requiere Stripe');

  const priceId = PRICE_MAP[planSlug];
  if (!priceId) throw new Error(`No hay precio Stripe configurado para el plan ${planSlug}`);

  // Buscar o crear customer
  let customerId = '';
  const existing = db.prepare('SELECT stripe_customer_id FROM user_memberships WHERE user_id = ? AND stripe_customer_id != ? ORDER BY id DESC LIMIT 1').get(user.id, '');
  if (existing?.stripe_customer_id) {
    customerId = existing.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { user_id: String(user.id) },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl,
    metadata: {
      user_id: String(user.id),
      plan_slug: planSlug,
      plan_name: plan.name,
    },
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Crea un Customer Portal Session para gestión de suscripción
 */
export async function createPortalSession({ user, returnUrl }) {
  if (!stripe) throw new Error('Stripe no configurado');

  const db = getDb();
  const membership = db.prepare(`
    SELECT stripe_customer_id FROM user_memberships
    WHERE user_id = ? AND stripe_customer_id != '' AND status = 'active'
    ORDER BY id DESC LIMIT 1
  `).get(user.id);

  if (!membership?.stripe_customer_id) {
    throw new Error('No hay suscripción activa con Stripe');
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: membership.stripe_customer_id,
    return_url: returnUrl,
  });

  return { url: portal.url };
}

/**
 * Procesa webhook de Stripe
 */
export async function handleWebhook(rawBody, signature) {
  if (!stripe) throw new Error('Stripe no configurado');
  if (!config.stripe.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET no configurado');

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  } catch (err) {
    throw new Error(`Firma de webhook inválida: ${err.message}`);
  }

  const db = getDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const paymentType = session.metadata?.type;

      // Handle tournament registration payment
      if (paymentType === 'tournament_registration') {
        const regId = parseInt(session.metadata?.registration_id);
        const tournamentId = parseInt(session.metadata?.tournament_id);
        if (regId && tournamentId) {
          db.prepare(`
            UPDATE registration_requests SET paid = 1,
              stripe_payment_intent_id = ?,
              updated_at = datetime('now')
            WHERE id = ? AND tournament_id = ?
          `).run(session.payment_intent, regId, tournamentId);

          const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
          if (tournament?.auto_approve) {
            // Auto-approve: set status approved, find or create player and enroll
            db.prepare("UPDATE registration_requests SET status = 'approved' WHERE id = ?").run(regId);
            const reg = db.prepare('SELECT * FROM registration_requests WHERE id = ?').get(regId);
            if (reg) {
              let player = null;
              if (reg.fide_id) player = db.prepare('SELECT * FROM players WHERE fide_id = ?').get(reg.fide_id);
              if (!player && reg.email) player = db.prepare('SELECT * FROM players WHERE email = ? AND email != ?').get(reg.email, '');
              if (!player) {
                const pr = db.prepare(`
                  INSERT INTO players (fide_id, name, last_name, fide_rating, federation, title, email, phone, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(reg.fide_id ?? '', reg.name, reg.last_name ?? '', reg.fide_rating ?? 0, reg.federation ?? '', reg.title ?? '', reg.email ?? '', reg.phone ?? '', reg.notes ?? '');
                player = db.prepare('SELECT * FROM players WHERE id = ?').get(pr.lastInsertRowid);
              }
              const maxSeed = db.prepare('SELECT MAX(seed_rank) as max FROM tournament_players WHERE tournament_id = ?').get(tournamentId);
              const nextSeed = (maxSeed?.max ?? 0) + 1;
              const existing = db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?').get(tournamentId, player.id);
              if (!existing) {
                db.prepare('INSERT INTO tournament_players (tournament_id, player_id, seed_rank) VALUES (?, ?, ?)').run(tournamentId, player.id, nextSeed);
              }
            }
          }
          // else: keep status as pending_payment (paid), organizer must approve manually
        }
        break;
      }

      const userId = parseInt(session.metadata?.user_id);
      const planSlug = session.metadata?.plan_slug;

      if (userId && planSlug) {
        const plan = db.prepare('SELECT * FROM membership_plans WHERE slug = ?').get(planSlug);
        if (plan) {
          // Cancelar membresías activas previas
          db.prepare("UPDATE user_memberships SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(userId);

          // Insertar nueva membresía con datos Stripe
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          db.prepare(`
            INSERT INTO user_memberships (user_id, plan_id, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end)
            VALUES (?, ?, 'active', ?, ?, ?, ?)
          `).run(userId, plan.id, session.customer, session.subscription, session.metadata?.price_id || '', new Date(subscription.current_period_end * 1000).toISOString());
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'cancelled';
      const cancelAtPeriodEnd = sub.cancel_at_period_end ? 1 : 0;
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

      db.prepare(`
        UPDATE user_memberships SET status = ?, cancel_at_period_end = ?, current_period_end = ?, updated_at = datetime('now')
        WHERE stripe_subscription_id = ?
      `).run(status, cancelAtPeriodEnd, periodEnd, sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const subDeleted = event.data.object;
      // Downgrade to Free
      const freePlan = db.prepare("SELECT id FROM membership_plans WHERE slug = 'free'").get();
      if (freePlan) {
        db.prepare(`
          UPDATE user_memberships SET status = 'cancelled' WHERE stripe_subscription_id = ?
        `).run(subDeleted.id);

        // Give free plan
        const userIdRow = db.prepare('SELECT user_id FROM user_memberships WHERE stripe_subscription_id = ?').get(subDeleted.id);
        if (userIdRow) {
          db.prepare("UPDATE user_memberships SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(userIdRow.user_id);
          db.prepare("INSERT INTO user_memberships (user_id, plan_id, status) VALUES (?, ?, 'active')").run(userIdRow.user_id, freePlan.id);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      if (subId) {
        db.prepare("UPDATE user_memberships SET status = 'expired' WHERE stripe_subscription_id = ?").run(subId);
      }
      break;
    }
  }

  return { received: true };
}

/**
 * Sincroniza las suscripciones activas con Stripe (para tareas programadas)
 */
/**
 * Crea un Checkout Session para pago de inscripción a torneo
 */
export async function createRegistrationCheckoutSession({ registrationId, tournament, amount, currency, successUrl, cancelUrl }) {
  if (!stripe) {
    throw new Error('Stripe no está configurado (STRIPE_SECRET_KEY faltante)');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: currency || 'usd',
        product_data: {
          name: `Inscripción: ${tournament.name}`,
          description: `Torneo de ajedrez - ${tournament.system}`,
        },
        unit_amount: amount, // already in cents
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: 'tournament_registration',
      registration_id: String(registrationId),
      tournament_id: String(tournament.id),
    },
  });

  return { url: session.url, sessionId: session.id };
}

export function isStripeConfigured() {
  return stripe !== null;
}

export async function syncSubscriptions() {
  if (!stripe) return;
  const db = getDb();
  const activeSubs = db.prepare("SELECT * FROM user_memberships WHERE stripe_subscription_id != '' AND status = 'active'").all();

  for (const mem of activeSubs) {
    try {
      const sub = await stripe.subscriptions.retrieve(mem.stripe_subscription_id);
      const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'cancelled';
      const cancelAtPeriodEnd = sub.cancel_at_period_end ? 1 : 0;
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

      db.prepare(`
        UPDATE user_memberships SET status = ?, cancel_at_period_end = ?, current_period_end = ?
        WHERE id = ?
      `).run(status, cancelAtPeriodEnd, periodEnd, mem.id);
    } catch {
      // Subscription might have been deleted in Stripe
      db.prepare("UPDATE user_memberships SET status = 'expired' WHERE id = ?").run(mem.id);
    }
  }
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { getDb, closeDb } from './db/supabase.js';
import { migrate } from './db/schema.js';
import config from './config.js';

import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournaments.js';
import playerRoutes from './routes/players.js';
import fideRoutes from './routes/fide.js';
import statsRoutes from './routes/stats.js';
import roundRoutes from './routes/rounds.js';
import publicRoutes from './routes/public.js';
import leagueRoutes from './routes/leagues.js';
import matchRoutes from './routes/matches.js';
import teamRoutes from './routes/teams.js';
import arbiterRoutes from './routes/arbiters.js';
import membershipRoutes from './routes/membership.js';
import validationRoutes from './routes/validation.js';
import stripeRoutes from './routes/stripe.js';
import apiKeysRoutes from './routes/apiKeys.js';
import webhookRoutes from './routes/webhooks.js';
import apiV1Routes from './routes/apiV1.js';
import externalRoutes from './routes/external.js';
import importRoutes from './routes/import.js';
import notificationRoutes from './routes/notifications.js';
import aiRoutes from './routes/ai.js';
import scanRoutes from './routes/scan.js';

const app = express();

// ── Health check (PRIMERO de todo) ─────────────────────────────────
app.get('/health', (req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ status: 'ok', msg: 'no-db' })); });
app.get('/health/readiness', (req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ status: 'ready', msg: 'no-db' })); });


// ── Production security ────────────────────────────────────────────
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'production' ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
});

// ── Middleware global ───────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
// app.use(compression());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/auth', limiter);
// Body parser: try express.json with error suppression
const jsonParser = express.json();
app.use((req, res, next) => {
  jsonParser(req, res, (err) => {
    if (err) {
      // express.json failed — try raw body from Vercel
      if (typeof req.body === 'string') {
        try { req.body = JSON.parse(req.body); } catch {}
      }
      next();
    } else {
      next();
    }
  });
});

// ── Rutas ──────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/tournaments', tournamentRoutes);
app.use('/players', playerRoutes);
app.use('/', roundRoutes);
app.use('/leagues', leagueRoutes);
app.use('/matches', matchRoutes);
app.use('/fide', fideRoutes);
app.use('/stats', statsRoutes);
app.use('/arbiters', arbiterRoutes);
app.use('/membership', membershipRoutes);
app.use('/validation', validationRoutes);
app.use('/stripe', stripeRoutes);
app.use('/api-keys', apiKeysRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/v1', apiV1Routes);
app.use('/external', externalRoutes);
app.use('/import', importRoutes);
app.use('/notifications', notificationRoutes);
app.use('/ai', aiRoutes);
app.use('/scan', scanRoutes);
app.use('/public', publicRoutes);

// ── Static assets + SPA fallback ────────────────────────────────────
const API_PREFIXES = ['/auth/', '/public/', '/tournaments/', '/players/', '/fide/', '/stats/', '/health', '/pairings/', '/rounds/', '/membership/', '/validation/', '/stripe/', '/api/v1/', '/external/', '/webhooks/', '/api-keys/', '/import/', '/notifications/', '/leagues/', '/matches/', '/teams/', '/team_members/'];
app.use(express.static(config.clientDist));
app.use((req, res, next) => {
  if (req.method === 'GET' && !API_PREFIXES.some((p) => req.path.startsWith(p))) {
    return res.sendFile('index.html', { root: config.clientDist });
  }
  next();
});

app.use('/', teamRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Error handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: config.nodeEnv === 'production' ? 'Error interno del servidor' : err.message,
  });
});

// ── Migración de BD ────────────────────────────────────────────────
migrate().catch(e => console.error('Migration error:', e));

// ── Inicio (solo en standalone; Vercel serverless no ejecuta listen) ──
let server;
if (!process.env.VERCEL) {
  const db = getDb();
  server = app.listen(config.port, () => {
    console.log(`✅ Chess Organizers Pro API — puerto ${config.port} [${config.nodeEnv}]`);
    console.log(`🗄️  BD: ${config.db.url || config.db.path}`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────
  function shutdown() {
    console.log('\n🛑 Cerrando servidor...');
    server.close(() => {
      closeDb();
      console.log('✅ Servidor detenido');
      process.exit(0);
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;

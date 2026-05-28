import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { getDb, closeDb } from './db/index.js';
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

const app = express();

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
app.use(compression());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use('/auth', limiter);

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
app.use('/public', publicRoutes);

// ── Static files (client build) ────────────────────────────────────
app.use(express.static(config.clientDist, { index: 'index.html' }));

// ── SPA fallback (antes de teamRoutes que tiene auth global) ──────
const API_PREFIXES = ['/auth/', '/tournaments/', '/players/', '/fide/', '/stats/', '/health', '/pairings/', '/rounds/', '/membership/', '/validation/', '/stripe/', '/api/v1/', '/external/', '/webhooks/', '/api-keys/', '/import/', '/notifications/', '/leagues/', '/matches/', '/teams/', '/team_members/'];
app.use((req, res, next) => {
  if (req.method === 'GET' && !API_PREFIXES.some((p) => req.path.startsWith(p))) {
    return res.sendFile('index.html', { root: config.clientDist });
  }
  next();
});

// ── Health check ───────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const db = getDb();
  let dbOk = false;
  try { db.prepare('SELECT 1').get(); dbOk = true; } catch {}
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    database: dbOk ? 'connected' : 'error',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/readiness', (req, res) => {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    res.json({ status: 'ready', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'not ready', database: 'disconnected' });
  }
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

// ── Graceful shutdown ──────────────────────────────────────────────
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

// ── Migración de BD ────────────────────────────────────────────────
migrate();

// ── Inicio ─────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  const db = getDb();
  console.log(`✅ Chess Organizers Pro API — puerto ${config.port} [${config.nodeEnv}]`);
  console.log(`🗄️  BD SQLite: ${config.db.path}`);
});

export { app, server };

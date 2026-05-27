import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Usar BD temporal para tests
const TEST_DB = './test_data/test.db';
if (!existsSync(dirname(TEST_DB))) mkdirSync(dirname(TEST_DB), { recursive: true });
// Limpiar BD de ejecuciones anteriores
try { unlinkSync(TEST_DB); } catch {}
try { unlinkSync(TEST_DB + '-wal'); } catch {}
try { unlinkSync(TEST_DB + '-shm'); } catch {}

const ENV = {
  DB_PATH: TEST_DB,
  JWT_SECRET: 'test-secret',
  PORT: '0',
};

let request, server, BASE;

before(async () => {
  // Set env vars antes de cualquier import
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;

  // Inicializar schema y app con imports dinámicos
  const { migrate } = await import('../src/db/schema.js');
  migrate();

  const mod = await import('../src/index.js');
  server = mod.server;
  BASE = `http://localhost:${server.address().port}`;

  request = async (method, path, body = null, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : null,
    });
    const data = res.headers.get('content-type')?.includes('application/json')
      ? await res.json()
      : await res.text();
    return { status: res.status, data, headers: res.headers };
  };
});

let token, tournamentId, playerId;

describe('API Tests', { concurrency: false }, () => {
  it('POST /auth/register — crea usuario', async () => {
    const res = await request('POST', '/auth/register', {
      email: 'test@test.com', password: 'test123', name: 'Test User',
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.token);
    token = res.data.token;
  });

  it('POST /auth/login — inicia sesión', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'test@test.com', password: 'test123',
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
    token = res.data.token;
  });

  it('GET /auth/me — perfil', async () => {
    const res = await request('GET', '/auth/me', null, token);
    assert.equal(res.status, 200);
    assert.equal(res.data.email, 'test@test.com');
  });

  it('POST /tournaments — crea torneo', async () => {
    const res = await request('POST', '/tournaments', {
      name: 'Test Swiss', system: 'dutch', n_rounds: 5,
    }, token);
    assert.equal(res.status, 201);
    tournamentId = res.data.id;
  });

  it('GET /tournaments — lista torneos', async () => {
    const res = await request('GET', '/tournaments', null, token);
    assert.equal(res.status, 200);
    assert.ok(res.data.tournaments.length > 0);
  });

  it('PATCH /tournaments/:id — actualiza torneo', async () => {
    const res = await request('PATCH', `/tournaments/${tournamentId}`, {
      description: 'Updated',
    }, token);
    assert.equal(res.status, 200);
    assert.equal(res.data.description, 'Updated');
  });

  it('POST /players — crea jugador', async () => {
    const res = await request('POST', '/players', {
      fide_id: '9900001', name: 'Test', last_name: 'Player', fide_rating: 2500, federation: 'TEST',
    }, token);
    assert.equal(res.status, 201);
    playerId = res.data.id;
  });

  it('GET /players — busca jugadores', async () => {
    const res = await request('GET', '/players?q=Test', null, token);
    assert.equal(res.status, 200);
    assert.ok(res.data.players.length > 0);
  });

  it('POST /tournaments/:tid/players — inscribe jugador', async () => {
    const res = await request('POST', `/tournaments/${tournamentId}/players`, {
      player_id: playerId, seed_rank: 1,
    }, token);
    assert.equal(res.status, 201);
  });

  it('Crea e inscribe segundo jugador', async () => {
    const r1 = await request('POST', '/players', {
      fide_id: '9900002', name: 'Second', last_name: 'Player', fide_rating: 2400, federation: 'TEST',
    }, token);
    assert.equal(r1.status, 201);
    const r2 = await request('POST', `/tournaments/${tournamentId}/players`, {
      player_id: r1.data.id, seed_rank: 2,
    }, token);
    assert.equal(r2.status, 201);
  });

  it('Genera ronda 1', async () => {
    const res = await request('POST', `/tournaments/${tournamentId}/rounds/generate`, null, token);
    assert.equal(res.status, 201);
  });

  it('GET /tournaments/:tid/rounds — lista rondas', async () => {
    const res = await request('GET', `/tournaments/${tournamentId}/rounds`, null, token);
    assert.equal(res.status, 200);
    assert.ok(res.data.length > 0);
  });

  it('Exporta TRF', async () => {
    const res = await request('GET', `/tournaments/${tournamentId}/trf`, null, token);
    assert.equal(res.status, 200);
    assert.ok(typeof res.data === 'string');
  });

  it('GET /health — health check', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
  });

  it('POST /nonexistent — 401 (global auth middleware)', async () => {
    const res = await request('POST', '/nonexistent');
    assert.equal(res.status, 401);
  });

  it('GET /tournaments sin token — 401', async () => {
    const res = await request('GET', '/tournaments');
    assert.equal(res.status, 401);
  });

  after(() => {
    if (server) server.close();
    try { unlinkSync(TEST_DB); } catch {}
    try { unlinkSync(TEST_DB + '-wal'); } catch {}
    try { unlinkSync(TEST_DB + '-shm'); } catch {}
  });
});

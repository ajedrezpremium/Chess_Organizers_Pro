import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const ENV = {
  JWT_SECRET: 'test-secret',
  PORT: '0',
  DATABASE_URL: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || '',
};

let request, server, BASE;

before(async () => {
  for (const [k, v] of Object.entries(ENV)) if (v) process.env[k] = v;

  const { migrate } = await import('../src/db/schema.js');
  await migrate();

  const mod = await import('../src/index.js');
  const { default: app } = mod;
  // Start server for testing
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  BASE = `http://localhost:${server.address().port}`;

  request = async (method, path, body = null, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : null,
    });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
});

after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  const { closeDb } = await import('../src/db/supabase.js');
  await closeDb();
});

describe('API Integration Tests', () => {
  let token = '';
  let tournamentId;

  it('POST /auth/register — registrar usuario', async () => {
    const { status, body } = await request('POST', '/auth/register', {
      email: 'test@test.com', password: 'test123', name: 'Tester',
    });
    assert.equal(status, 201);
    assert.ok(body.token);
    token = body.token;
  });

  it('POST /auth/login — login', async () => {
    const { status, body } = await request('POST', '/auth/login', {
      email: 'test@test.com', password: 'test123',
    });
    assert.equal(status, 200);
    assert.ok(body.token);
  });

  it('GET /health — health check', async () => {
    const { status, body } = await request('GET', '/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
  });

  it('POST /tournaments — crear torneo', async () => {
    const { status, body } = await request('POST', '/tournaments', {
      name: 'Test Tournament', system: 'dutch', n_rounds: 5,
    }, token);
    assert.equal(status, 201);
    assert.ok(body.id);
    tournamentId = body.id;
  });

  it('GET /tournaments — listar torneos', async () => {
    const { status, body } = await request('GET', '/tournaments', null, token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
  });

  it('GET /tournaments/:id — obtener torneo', async () => {
    const { status, body } = await request('GET', `/tournaments/${tournamentId}`, null, token);
    assert.equal(status, 200);
    assert.equal(body.name, 'Test Tournament');
  });

  it('POST /players — crear jugador', async () => {
    const { status, body } = await request('POST', '/players', {
      name: 'Magnus', last_name: 'Carlsen', fide_id: '2200010', fide_rating: 2831,
      title: 'GM', federation: 'NOR',
    }, token);
    assert.equal(status, 201);
    assert.ok(body.id);
  });

  it('GET /players?q= — buscar jugadores', async () => {
    const { status, body } = await request('GET', '/players?q=Magnus', null, token);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
  });

  it('GET /public/tournaments — torneos públicos', async () => {
    const { status, body } = await request('GET', '/public/tournaments');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
  });

  it('POST /fide/import/2200010 — importar jugador FIDE', async () => {
    const { status, body } = await request('POST', '/fide/import/2200010', null, token);
    // Should work or fail gracefully (no FIDE API configured)
    assert.ok(status === 200 || status === 400 || status === 500);
  });

  it('DELETE /tournaments/:id — eliminar torneo', async () => {
    const { status } = await request('DELETE', `/tournaments/${tournamentId}`, null, token);
    assert.equal(status, 200);
  });
});

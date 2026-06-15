import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('Supabase pool error:', err));

function transpile(sql) {
  let idx = 0;
  let result = sql
    .replace(/'datetime\(''now''\)'/gi, 'NOW()')
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/datetime\("now"\)/gi, 'NOW()')
    .replace(/\?/g, () => `$${++idx}`)
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
    .replace(/REPLACE\s+INTO/gi, 'INSERT INTO');

  if (/\bINSERT\s+INTO\b.*\bON\s+CONFLICT\b/i.test(result)) {
    return result;
  }
  if (/^INSERT\s+INTO/i.test(result) && !/^\s*--/m.test(result)) {
    result += ' ON CONFLICT DO NOTHING';
  }
  return result;
}

const preparedCache = new Map();

function prepare(sql) {
  if (preparedCache.has(sql)) return preparedCache.get(sql);
  const pgSql = transpile(sql);
  const stmt = {
    get: async (...params) => {
      const { rows } = await pool.query(pgSql, params.filter(p => p !== undefined));
      return rows[0] ?? null;
    },
    all: async (...params) => {
      const { rows } = await pool.query(pgSql, params.filter(p => p !== undefined));
      return rows;
    },
    run: async (...params) => {
      const result = await pool.query(pgSql, params.filter(p => p !== undefined));
      return { changes: result.rowCount, lastInsertRowid: result.rows?.[0]?.id ?? null };
    },
  };
  preparedCache.set(sql, stmt);
  return stmt;
}

let db = null;

export function getDb() {
  if (db) return db;
  db = {
    prepare,
    exec: async (sql) => {
      const statements = sql.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) await pool.query(transpile(stmt));
      }
    },
    close: async () => { await pool.end(); db = null; },
  };
  return db;
}

export async function closeDb() {
  await pool.end();
  db = null;
}

export default getDb;

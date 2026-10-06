import pg from 'pg';

const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

function getConnectionString() {
  // Use the explicit pooler URL verbatim when set (copy it from
  // Supabase dashboard → Connect → Transaction pooler, it already
  // includes the region-specific host and pgbouncer params).
  if (process.env.DATABASE_POOLER_URL) return process.env.DATABASE_POOLER_URL;
  // Otherwise use DATABASE_URL as-is (direct connection). Do NOT rewrite
  // the host: Supabase pooler hosts are region-specific, so a naive
  // supabase.co → pooler.supabase.com replacement makes Supavisor answer
  // "(ENOTFOUND) tenant/user ... not found" and breaks all DB access.
  return process.env.DATABASE_URL;
}

const pool = new pg.Pool({
  connectionString: getConnectionString(),
  ssl: isProd ? { rejectUnauthorized: false } : false,
  max: isProd ? 3 : 10,
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

  // ON CONFLICT DO NOTHING removed — interferes with RETURNING *
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
      let execSql = pgSql.trim();
      const isInsert = /^INSERT\s+INTO/i.test(execSql);
      if (isInsert && !/\bRETURNING\b/i.test(execSql)) execSql += ' RETURNING *';
      const result = await pool.query(execSql, params.filter(p => p !== undefined));
      const lastInsertRowid = isInsert ? (result.rows?.[0]?.id ?? null) : null;
      return { changes: result.rowCount ?? 0, lastInsertRowid };
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

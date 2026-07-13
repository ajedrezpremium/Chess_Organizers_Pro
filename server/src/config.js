import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FIDE_LAWS_SYSTEM_PROMPT } from './data/fide-system-prompt.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([^#=]+)=(.+)/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
}

function get(key, fallback) {
  return process.env[key] ?? env[key] ?? fallback;
}

function required(key, fallback, hint) {
  const val = get(key, fallback);
  if (!val || val === fallback) {
    console.warn(`⚠️  Variable de entorno faltante: ${key}.${hint ? ` ${hint}` : ''}`);
  }
  return val;
}

const nodeEnv = get('NODE_ENV', 'development');
const jwtSecret = required('JWT_SECRET', 'chess-organizers-dev-secret-change-in-prod',
  nodeEnv === 'production' ? 'Define JWT_SECRET en producción.' : '');

export default {
  port: parseInt(get('PORT', '4000'), 10),
  host: get('HOST', '0.0.0.0'),
  nodeEnv,

  ai: {
    openrouterKey: get('OPENROUTER_API_KEY', ''),
    model: get('AI_MODEL', 'google/gemini-2.0-flash-001'),
    systemPrompt: FIDE_LAWS_SYSTEM_PROMPT,
  },

  jwt: {
    secret: jwtSecret,
    expiresIn: get('JWT_EXPIRES', '7d'),
  },

  db: {
    path: resolve(__dirname, '..', get('DB_PATH', nodeEnv === 'production'
      ? '/data/chessorganizers.db' : 'data/chessorganizers.db')),
    url: get('DATABASE_URL', ''),
  },
  supabase: {
    url: get('SUPABASE_URL', ''),
    anonKey: get('SUPABASE_ANON_KEY', ''),
  },

  fide: {
    ratingApi: get('FIDE_RATING_API', 'https://ratings.fide.com/api/'),
    ratingServer: get('FIDE_RATING_SERVER', 'https://ratings.fide.com/'),
    apiKey: get('FIDE_API_KEY', ''),
    token: get('FIDE_TOKEN', ''),
    submitUrl: get('FIDE_SUBMIT_URL', ''),
  },

  smtp: {
    host: get('SMTP_HOST', ''),
    port: parseInt(get('SMTP_PORT', '587'), 10),
    secure: get('SMTP_SECURE', 'false') === 'true',
    user: get('SMTP_USER', ''),
    pass: get('SMTP_PASS', ''),
  },

  publicUrl: get('PUBLIC_URL', 'http://localhost:5173'),
  clientDist: get('CLIENT_DIST', resolve(__dirname, '..', '..', 'client', 'dist')),

  stripe: {
    secretKey: get('STRIPE_SECRET_KEY', ''),
    webhookSecret: get('STRIPE_WEBHOOK_SECRET', ''),
    priceFree: get('STRIPE_PRICE_FREE', ''),
    priceBasico: get('STRIPE_PRICE_BASICO', ''),
    pricePro: get('STRIPE_PRICE_PRO', ''),
  },

  cors: {
    origin: get('CORS_ORIGIN', '*'),
  },
};

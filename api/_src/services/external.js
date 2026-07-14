/**
 * external.js — Integración con plataformas externas
 *
 * chess.com API: https://www.chess.com/news/view/published-data-api
 * Lichess API: https://lichess.org/api
 */

const CHESSCOM_BASE = 'https://api.chess.com/pub';
const LICHESS_BASE = 'https://lichess.org/api';

const FETCH_TIMEOUT = 8000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChessOrganizersPro/1.0' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Chess.com ────────────────────────────────────────────────

/**
 * Busca perfil de jugador en chess.com
 * @param {string} username - Chess.com username
 * @returns {object} { name, username, rating, avatar, url }
 */
export async function chessComProfile(username) {
  const data = await fetchJson(`${CHESSCOM_BASE}/player/${encodeURIComponent(username)}`);
  return {
    platform: 'chess.com',
    username: data.username,
    name: data.name || data.username,
    title: data.title || '',
    avatar: data.avatar || '',
    location: data.location || '',
    url: data.url,
  };
}

/**
 * Obtiene estadísticas de chess.com
 * @param {string} username
 * @returns {object} stats por tipo de juego
 */
export async function chessComStats(username) {
  const data = await fetchJson(`${CHESSCOM_BASE}/player/${encodeURIComponent(username)}/stats`);
  const stats = {};
  for (const key of ['chess_rapid', 'chess_blitz', 'chess_bullet']) {
    if (data[key]) {
      stats[key] = {
        rating: data[key].last?.rating || 0,
        best: data[key].best?.rating || 0,
        games: data[key].record?.win + data[key].record?.loss + data[key].record?.draw || 0,
      };
    }
  }
  return stats;
}

// ── Lichess ──────────────────────────────────────────────────

/**
 * Busca perfil de jugador en Lichess
 * @param {string} username - Lichess username
 * @returns {object} { name, username, rating, title, avatar }
 */
export async function lichessProfile(username) {
  const data = await fetchJson(`${LICHESS_BASE}/user/${encodeURIComponent(username)}`);
  return {
    platform: 'lichess',
    username: data.username,
    name: `${data.username}`,
    title: data.title || '',
    avatar: '', // lichess avatar requires special handling
    url: `https://lichess.org/@/${data.username}`,
    perfs: {
      rapid: data.perfs?.rapid?.rating || 0,
      blitz: data.perfs?.blitz?.rating || 0,
      bullet: data.perfs?.bullet?.rating || 0,
      classical: data.perfs?.classical?.rating || 0,
    },
    createdAt: data.createdAt,
    seenAt: data.seenAt,
  };
}

/**
 * Busca jugador por username en ambas plataformas
 * @param {string} platform - 'chesscom' | 'lichess'
 * @param {string} username
 * @returns {object} perfil unificado
 */
export async function lookupPlayer(platform, username) {
  switch (platform) {
    case 'chesscom':
      return await chessComProfile(username);
    case 'lichess':
      return await lichessProfile(username);
    default:
      throw new Error(`Plataforma no soportada: ${platform}`);
  }
}

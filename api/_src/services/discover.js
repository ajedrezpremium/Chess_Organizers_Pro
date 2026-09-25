/**
 * discover.js — Agregador de torneos REALES para Discover.
 *
 * Fuente primaria: Lichess Broadcast API (pública, sin clave).
 *   GET https://lichess.org/api/broadcast/top → { active: [...] }
 *   Cada broadcast trae: nombre, sede, ritmo, web oficial (info.website)
 *   y clasificaciones (info.standings, normalmente Chess-Results).
 * Respaldo: FEATURED_EVENTS (eventos reales curados, nunca inventados).
 * Caché en memoria 10 min para no saturar a Lichess.
 */
import { FEATURED_EVENTS } from '../data/featured-events.js';

const LICHESS_TOP_URL = 'https://lichess.org/api/broadcast/top';
const CACHE_TTL = 1000 * 60 * 10;
const FETCH_TIMEOUT = 9000;

let cache = { at: 0, data: null };

function playersLine(info) {
  const p = (info?.players || '').split(',').map((s) => s.trim()).filter(Boolean);
  return p.slice(0, 6).join(', ');
}

function mapBroadcast(b) {
  const tour = b.tour || {};
  const round = b.round || {};
  const info = tour.info || {};
  const name = tour.group || tour.name || 'Broadcast';
  const base = {
    id: `li-${round.id || tour.id}`,
    name,
    city: info.location || '',
    round: round.name || '',
    system: info.format || '',
    rhythm: info.tc || '',
    board1: playersLine(info),
    source: 'lichess',
    officialUrl: info.website || tour.url || '',
    broadcastUrl: round.url || tour.url || 'https://lichess.org/broadcast',
    technicalUrl: info.standings || '',
  };
  return base;
}

async function fetchLichessTop() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(LICHESS_TOP_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ChessOrganizersPro/1.0 (+https://chess-organizers-pro.vercel.app; discover)',
      },
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`Lichess HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.active) ? data.active : [];
  } finally {
    clearTimeout(t);
  }
}

function toFinished(b) {
  const m = mapBroadcast(b);
  const startsAt = b.round?.startsAt || (tourDates(b)[0] ?? null);
  return {
    id: m.id,
    name: m.name,
    system: m.system || '—',
    winner: '',
    winnerElo: '',
    date: startsAt ? new Date(startsAt).toISOString().slice(0, 10) : '',
    trf: Boolean(m.technicalUrl),
    source: m.source,
    officialUrl: m.officialUrl,
    broadcastUrl: m.broadcastUrl,
    technicalUrl: m.technicalUrl,
  };
}

function tourDates(b) {
  return Array.isArray(b.tour?.dates) ? b.tour.dates : [];
}

export async function getDiscover() {
  if (cache.data && Date.now() - cache.at < CACHE_TTL) return cache.data;

  const featuredLive = FEATURED_EVENTS.filter((e) => e.status === 'live');
  const featuredUpcoming = FEATURED_EVENTS.filter((e) => e.status === 'upcoming');

  try {
    const now = Date.now();
    const active = await fetchLichessTop();

    const live = [];
    const upcoming = [];
    const finished = [];
    const seen = new Set();

    for (const b of active) {
      const startsAt = b.round?.startsAt ?? tourDates(b)[0] ?? 0;
      const ongoing = b.round?.ongoing === true || (startsAt && startsAt <= now && (!b.round?.startsAt || now - startsAt < 1000 * 60 * 60 * 20));
      const key = b.tour?.group || b.tour?.name;
      if (ongoing) {
        if (live.length < 6) live.push({ ...mapBroadcast(b), round: `${b.round?.name || ''} · en juego` });
      } else if (startsAt && startsAt > now) {
        if (key && seen.has(key)) continue;
        seen.add(key);
        if (upcoming.length < 6) {
          const m = mapBroadcast(b);
          upcoming.push({
            id: m.id, name: m.name, date: new Date(startsAt).toISOString().slice(0, 10),
            city: m.city, system: m.system || '—', rhythm: m.rhythm || '—', level: 'Élite',
            source: m.source, officialUrl: m.officialUrl, broadcastUrl: m.broadcastUrl, technicalUrl: m.technicalUrl,
          });
        }
      } else if (finished.length < 6) {
        finished.push(toFinished(b));
      }
    }

    const data = {
      live: [...dedupFeatured(featuredLive, live), ...live].slice(0, 6),
      upcoming: [...featuredUpcoming, ...upcoming].slice(0, 6),
      finished: finished.slice(0, 6),
      updatedAt: new Date().toISOString(),
      source: 'live',
    };
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.warn('Discover: Lichess no disponible, usando destacados:', err.message);
    const data = {
      live: featuredLive,
      upcoming: featuredUpcoming,
      finished: [],
      updatedAt: new Date().toISOString(),
      source: 'featured',
      degraded: true,
    };
    cache = { at: Date.now(), data };
    return data;
  }
}

// Si Lichess ya trae el evento en directo (misma cabecera), el destacado
// curado sobra: el de Lichess lleva la URL exacta de la ronda en juego.
function dedupFeatured(featured, live) {
  const heads = (s) => s.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
  const liveHeads = live.map((t) => heads(t.name || ''));
  return featured.filter((f) => !liveHeads.some((h) => h && heads(f.name).startsWith(h)));
}

export function clearDiscoverCache() {
  cache = { at: 0, data: null };
}

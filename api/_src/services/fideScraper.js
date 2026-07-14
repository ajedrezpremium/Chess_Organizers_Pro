import config from '../config.js';

const BASE = 'https://ratings.fide.com';

/* ─────── Public HTML scraping fallbacks (no API key needed) ─────── */

/**
 * Busca jugadores FIDE por nombre vía scraping.
 * Usa la URL de búsqueda pública.
 */
export async function searchPlayersScrape(query) {
  const url = `${BASE}/search.phtml?search=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChessOrganizersPro/1.0)' },
  });
  if (!res.ok) throw new Error(`FIDE search error: ${res.status}`);
  const html = await res.text();
  return parseSearchHTML(html);
}

function parseSearchHTML(html) {
  const results = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells || cells.length < 6) continue;
    const clean = (s) => s?.replace(/<[^>]+>/g, '').trim() || '';
    const fid = clean(cells[0]);
    const name = clean(cells[1]);
    const lastName = clean(cells[2]);
    const title = clean(cells[3]);
    const fed = clean(cells[4]);
    const rating = parseInt(clean(cells[5])) || 0;
    if (fid && /^\d{4,}$/.test(fid)) {
      results.push({ fide_id: fid, name, last_name: lastName, title, federation: fed, rating });
    }
  }
  return results;
}

/**
 * Obtiene datos de un jugador FIDE por ID desde su perfil público.
 */
export async function getRatingScrape(fideId) {
  const url = `${BASE}/profile/${fideId}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChessOrganizersPro/1.0)' },
  });
  if (!res.ok) throw new Error(`FIDE profile error: ${res.status}`);
  const html = await res.text();
  return parseProfileHTML(html, fideId);
}

function parseProfileHTML(html, fideId) {
  // Name: <h1 class="player-title">Name, LastName</h1>
  let name = '', lastName = '';
  const nameMatch = html.match(/<h1\s+class="player-title">([^<]+)<\/h1>/i);
  if (nameMatch) {
    const parts = nameMatch[1].split(',').map((s) => s.trim());
    name = parts[1] || nameMatch[1];
    lastName = parts[0] || '';
  } else {
    // Fallback: <title>LastName, Name FIDE Profile</title>
    const titleMatch = html.match(/<title>([^,]+),?\s*([^<]+?)\s*FIDE\s*Profile/i);
    if (titleMatch) {
      lastName = titleMatch[1].trim();
      name = (titleMatch[2] || '').replace(/FIDE\s*Profile/i, '').trim();
    }
  }

  // Federation: <img src="/images/flags/XX.svg"
  let federation = '';
  const fedMatch = html.match(/\/images\/flags\/([a-z]{2})\.svg/i);
  if (fedMatch) federation = fedMatch[1].toUpperCase();

  // Title: look after "FIDE title" for next <p>
  let title = '';
  const titleStart = html.indexOf('FIDE title');
  if (titleStart > -1) {
    const afterTitle = html.slice(titleStart, titleStart + 300);
    const titleTagMatch = afterTitle.match(/<p>([^<]+)<\/p>/);
    if (titleTagMatch) {
      title = titleTagMatch[1].trim();
    }
  }
  // Map long title to FIDE code
  const titleMap = {
    'grandmaster': 'GM', 'g': 'GM',
    'international master': 'IM',
    'fide master': 'FM',
    'candidate master': 'CM',
    'woman grandmaster': 'WGM', 'w': 'WGM', 'wg': 'WGM',
    'woman international master': 'WIM',
    'woman fide master': 'WFM',
    'woman candidate master': 'WCM',
  };
  const lowerTitle = title.toLowerCase();
  for (const [key, val] of Object.entries(titleMap)) {
    if (lowerTitle.includes(key)) { title = val; break; }
  }

  // Standard rating: look for rating boxes before FIDE ID
  // Structure: <p>RATING</p><p>STANDARD</p>
  let rating = 0;
  // Find the standard rating in the profile-games section
  const beforeFideId = html.slice(0, html.indexOf('FIDE ID'));
  // Pattern: <p>(\d+)</p><p\s+style="font-size:8px">\s*STANDARD
  const ratingMatch = beforeFideId.match(/<p>(\d+)<\/p>\s*<p[^>]*>\s*STANDARD/i);
  if (ratingMatch) {
    rating = parseInt(ratingMatch[1]) || 0;
  } else {
    // Fallback: first STD. RATING from rating table
    const tableRating = html.match(/STD\.?\s*RATING[\s\S]*?align=right[^>]*>(\d+)<\/td>/i);
    if (tableRating) rating = parseInt(tableRating[1]) || 0;
  }

  return {
    fide_id: fideId,
    name,
    last_name: lastName,
    title,
    federation,
    rating,
  };
}

/**
 * Descarga lista de rating de federación desde la página de descarga pública.
 */
export async function downloadRatingListScrape(federation, month) {
  const period = month || '';
  const url = `${BASE}/download.phtml?period=${encodeURIComponent(period)}&federation=${encodeURIComponent(federation)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChessOrganizersPro/1.0)' },
  });
  if (!res.ok) throw new Error(`FIDE download error: ${res.status}`);
  const text = await res.text();
  if (text.includes('<!DOCTYPE') || text.includes('<html')) {
    throw new Error('La descarga directa requiere una cuenta gratuita en ratings.fide.com. Usá la importación por archivo CSV/TRF.');
  }
  return text;
}

/* ─────── API-based (requires FIDE_API_KEY) ─────── */

export async function searchPlayers(query) {
  if (config.fide.apiKey) {
    try {
      const url = `${BASE}/api/players/search?last_name=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.fide.apiKey}`, 'Accept': 'application/json' },
      });
      if (res.ok) return res.json();
    } catch { /* fallback */ }
  }
  return searchPlayersScrape(query);
}

export async function getRating(fideId) {
  if (config.fide.apiKey) {
    try {
      const url = `${BASE}/api/player/${fideId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.fide.apiKey}`, 'Accept': 'application/json' },
      });
      if (res.ok) return res.json();
    } catch { /* fallback */ }
  }
  return getRatingScrape(fideId);
}

export async function downloadRatingList(federation, month) {
  if (config.fide.apiKey) {
    try {
      const url = `${BASE}/api/players/list?federation=${federation}&month=${month}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.fide.apiKey}` },
      });
      if (res.ok) return res.text();
    } catch { /* fallback */ }
  }
  return downloadRatingListScrape(federation, month);
}

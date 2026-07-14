import config from '../config.js';
import * as scraper from './fideScraper.js';

const FIDE_API_BASE = 'https://ratings.fide.com';

/**
 * Busca jugadores FIDE — intenta API con Bearer token, fallback a scraping público.
 */
export async function searchPlayers(lastName, firstName = '') {
  if (config.fide.apiKey) {
    try {
      const url = `${FIDE_API_BASE}/api/players/search?last_name=${encodeURIComponent(lastName)}${firstName ? '&first_name=' + encodeURIComponent(firstName) : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.fide.apiKey}`, 'Accept': 'application/json' },
      });
      if (res.ok) return res.json();
    } catch { /* fallback */ }
  }
  return scraper.searchPlayersScrape(`${lastName}${firstName ? ', ' + firstName : ''}`);
}

/**
 * Obtiene rating FIDE — intenta API, fallback a scraping de perfil público.
 */
export async function getRating(fideId) {
  if (config.fide.apiKey) {
    try {
      const url = `${FIDE_API_BASE}/api/player/${fideId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.fide.apiKey}`, 'Accept': 'application/json' },
      });
      if (res.ok) return res.json();
    } catch { /* fallback */ }
  }
  return scraper.getRatingScrape(fideId);
}

/**
 * Descarga lista de rating de federación — intenta API, fallback a scraping público.
 */
export async function downloadRatingList(federation, month) {
  if (config.fide.apiKey) {
    try {
      const url = `${FIDE_API_BASE}/api/players/list?federation=${federation}&month=${month}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.fide.apiKey}` },
      });
      if (res.ok) return res.text();
    } catch { /* fallback */ }
  }
  return scraper.downloadRatingListScrape(federation, month);
}

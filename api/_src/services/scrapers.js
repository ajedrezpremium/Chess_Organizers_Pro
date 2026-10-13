/**
 * Real scrapers for external tournament sources
 * Chess-Results, Info64, FIDE Calendar, Ajedrez Madrid
 */

let cheerio = null;
async function getCheerio() {
  if (!cheerio) {
    try {
      const mod = await import('cheerio');
      cheerio = mod.default || mod;
    } catch {
      return null;
    }
  }
  return cheerio;
}

// Cache en memoria simple (en producción usar Redis)
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

function getCache(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Rate limiting simple
const rateLimits = new Map();
async function checkRateLimit(source) {
  const now = Date.now();
  const limits = {
    'chess-results': { max: 10, window: 60000 }, // 10 req/min
    'info64': { max: 30, window: 60000 },
    'fide-calendar': { max: 60, window: 60000 },
    'ajedrezmadrid': { max: 30, window: 60000 },
  };
  
  const limit = limits[source] || { max: 10, window: 60000 };
  const key = `${source}:${Math.floor(now / limit.window)}`;
  const count = (rateLimits.get(key) || 0) + 1;
  rateLimits.set(key, count);
  
  if (count > limit.max) {
    throw new Error(`Rate limit exceeded for ${source}`);
  }
}

// ================================================================
// CHESS-RESULTS.COM SCRAPER
// ================================================================
async function scrapeChessResults(filters = {}) {
  await checkRateLimit('chess-results');
  
  const cacheKey = `chess-results:${JSON.stringify(filters)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    // Chess-Results usa URLs como: https://chess-results.com/tnr{id}.aspx
    // Para listar torneos, hay que buscar en su calendario o usar su API no oficial
    // Nota: Chess-Results no tiene API pública oficial. Usamos scraping con respeto.
    
    const url = 'https://chess-results.com/calendario.aspx'; // Página de calendario
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      }
    });
    
    const html = await response.text();
    const cheerioMod = await getCheerio();
if (!cheerioMod) throw new Error('cheerio not available');
const $ = cheerioMod.load(html);
    const tournaments = [];

    // Chess-Results calendar page structure (selectors basados en observación)
    $('.tournament-item, .calendar-entry, table tr').each((i, el) => {
      const $el = $(el);
      const name = $el.find('.tournament-name, .name, td:nth-child(2)').text().trim();
      const city = $el.find('.city, .location, td:nth-child(3)').text().trim();
      const startDate = $el.find('.start-date, .date, td:nth-child(4)').text().trim();
      const endDate = $el.find('.end-date, td:nth-child(5)').text().trim();
      const link = $el.find('a').attr('href');
      
      if (name && (city || startDate)) {
        tournaments.push({
          external_id: `cr-${Date.now()}-${i}`,
          name,
          system: 'dutch',
          n_rounds: 9,
          federation: 'FIDE',
          country: 'ESP',
          city,
          start_date: parseDate(startDate),
          end_date: parseDate(endDate),
          time_control: '90+30',
          status: determineStatus(startDate, endDate),
          description: '',
          source_url: link ? `https://chess-results.com${link}` : '',
          player_count: 0,
        });
      }
    });

    setCache(cacheKey, tournaments);
    return tournaments;
  } catch (err) {
    console.error('Chess-Results scrape error:', err);
    return [];
  }
}

// ================================================================
// INFO64.ORG SCRAPER
// ================================================================
async function scrapeInfo64(filters = {}) {
  await checkRateLimit('info64');
  
  const cacheKey = `info64:${JSON.stringify(filters)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    // Info64 tiene calendarios RSS y páginas de torneos
    const url = 'https://info64.org/calendario.php'; // URL ejemplo
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    
    const html = await response.text();
    const cheerioMod = await getCheerio();
if (!cheerioMod) throw new Error('cheerio not available');
const $ = cheerioMod.load(html);
    const tournaments = [];

    // Selectores para Info64 (estructura observada)
    $('.torneo, .calendar-event, .event-item').each((i, el) => {
      const $el = $(el);
      const name = $el.find('.nombre, .title, h3, h4').text().trim();
      const city = $el.find('.lugar, .city, .location').text().trim();
      const dates = $el.find('.fecha, .dates, .date-range').text().trim();
      const link = $el.find('a').attr('href');
      
      if (name) {
        const { start, end } = parseDateRange(dates);
        tournaments.push({
          external_id: `i64-${Date.now()}-${i}`,
          name,
          system: 'dutch',
          n_rounds: 9,
          federation: 'FIDE',
          country: 'ESP',
          city,
          start_date: parseDate(start),
          end_date: parseDate(end),
          time_control: '90+30',
          status: determineStatus(start, end),
          description: '',
          source_url: link ? `https://info64.org${link}` : '',
          player_count: 0,
        });
      }
    });

    setCache(cacheKey, tournaments);
    return tournaments;
  } catch (err) {
    console.error('Info64 scrape error:', err);
    return [];
  }
}

// ================================================================
// FIDE CALENDAR SCRAPER (ratings.fide.com/calendar)
// ================================================================
async function scrapeFideCalendar(filters = {}) {
  await checkRateLimit('fide-calendar');

  const cacheKey = `fide-calendar:${JSON.stringify(filters)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const cheerioMod = await getCheerio();
    if (!cheerioMod) throw new Error('cheerio not available');

    // Nuevo calendario oficial FIDE (el antiguo ratings.fide.com/calendar.phtml da 404).
    // La lista se sirve vía POST a calendar_server.php con show=table.
    const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const TC_MAP = { standard: 'Classical', classical: 'Classical', rapid: 'Rapid', blitz: 'Blitz' };
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const tournaments = [];
    const MAX_PAGES = 5;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({ show: 'table', page: String(page) });
      if (filters.search) params.set('name_filter', filters.search);

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      let html;
      try {
        const response = await fetch('https://calendar.fide.com/calendar_server.php', {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://calendar.fide.com/calendar.php',
          },
          body: params.toString(),
          signal: ctrl.signal,
        });
        html = await response.text();
      } finally {
        clearTimeout(timer);
      }

      const $p = cheerioMod.load(html);
      const rows = $p('.calendar-h-row');
      if (!rows.length) break;

      rows.each((i, el) => {
        const $el = $p(el);
        const days = $el.find('.t-tile-header-day').map((_, d) => parseInt($p(d).text().trim(), 10)).get().filter((n) => Number.isFinite(n));
        const monthRaw = ($el.find('.t-tile-header-month').first().text() || '').trim().slice(0, 3).toLowerCase();
        const m = MONTHS[monthRaw] || 1;
        // Las filas no traen año: si el mes ya pasó, es del año siguiente.
        let year = now.getFullYear();
        if (m < now.getMonth() + 1) year += 1;
        const d1 = days[0] || 1;
        const d2 = days[1] || d1;
        const start_date = `${year}-${pad(m)}-${pad(d1)}`;
        const end_date = `${year}-${pad(m)}-${pad(d2)}`;

        const link = $el.find('.calendar-h-name a');
        const name = link.text().trim();
        if (!name) return;
        const href = link.attr('href') || '';
        const idMatch = href.match(/id=(\d+)/);
        const fideId = idMatch ? idMatch[1] : `${Date.now()}-${page}-${i}`;

        const tcRaw = ($el.find('.calendar-h-start').text() || '').replace(/time control:/i, '').trim();
        const cityRaw = ($el.find('.calendar-h-city').text() || '').trim();
        const cityMatch = cityRaw.match(/^(.*),\s*([A-Z]{3})$/);
        let city = cityMatch ? cityMatch[1].trim() : cityRaw;
        let ccode = cityMatch ? cityMatch[2] : '';
        if (!cityMatch && /^[A-Z]{3}$/.test(cityRaw)) ccode = cityRaw;

        tournaments.push({
          external_id: `fide-${fideId}`,
          name,
          system: 'dutch',
          n_rounds: 11,
          federation: ccode || 'FIDE',
          country: ccode,
          city,
          start_date,
          end_date,
          time_control: TC_MAP[tcRaw.toLowerCase()] || tcRaw || 'Classical',
          status: determineStatus(start_date, end_date),
          description: '',
          source_url: idMatch ? `https://calendar.fide.com/calendar.php?id=${fideId}` : '',
          player_count: 0,
        });
      });
    }

    setCache(cacheKey, tournaments);
    return tournaments;
  } catch (err) {
    console.error('FIDE Calendar scrape error:', err);
    return [];
  }
}

// ================================================================
// AJEDREZ MADRID SCRAPER
// ================================================================
async function scrapeAjedrezMadrid(filters = {}) {
  await checkRateLimit('ajedrezmadrid');
  
  const cacheKey = `ajedrezmadrid:${JSON.stringify(filters)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = 'https://ajedrezmadrid.com/calendario/'; // URL del calendario
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    const html = await response.text();
    const cheerioMod = await getCheerio();
if (!cheerioMod) throw new Error('cheerio not available');
const $ = cheerioMod.load(html);
    const tournaments = [];

    // Ajedrez Madrid structure
    $('.evento, .tournament, .calendario-item').each((i, el) => {
      const $el = $(el);
      const name = $el.find('.titulo, .nombre, h3, h4').text().trim();
      const city = $el.find('.lugar, .ciudad, .location').text().trim() || 'Madrid';
      const dates = $el.find('.fecha, .fechas, .date').text().trim();
      const link = $el.find('a').attr('href');
      
      if (name) {
        const { start, end } = parseDateRange(dates);
        tournaments.push({
          external_id: `am-${Date.now()}-${i}`,
          name,
          system: 'dutch',
          n_rounds: 9,
          federation: 'FIDE',
          country: 'ESP',
          city,
          start_date: parseDate(start),
          end_date: parseDate(end),
          time_control: '90+30',
          status: determineStatus(start, end),
          description: '',
          source_url: link ? `https://ajedrezmadrid.com${link}` : '',
          player_count: 0,
        });
      }
    });

    setCache(cacheKey, tournaments);
    return tournaments;
  } catch (err) {
    console.error('Ajedrez Madrid scrape error:', err);
    return [];
  }
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function parseDate(dateStr) {
  if (!dateStr) return '';
  // Intentar varios formatos: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, "15-20 Julio 2026"
  const cleaned = dateStr.trim().replace(/[./]/g, '-');
  
  // Formato "15-20 Julio 2026" o "15 Julio 2026"
  const rangeMatch = cleaned.match(/(\d{1,2})\s*(?:-|–|a)\s*(\d{1,2})?\s*(\w+)\s*(\d{4})/i);
  if (rangeMatch) {
    const [, day1, day2, month, year] = rangeMatch;
    const months = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
      january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
    const monthNum = months[month.toLowerCase()] || 1;
    const day = day2 || day1;
    return `${year}-${String(monthNum).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  
  // ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  
  // DD-MM-YYYY
  const dmY = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2]}-${dmY[1]}`;
  
  return '';
}

function parseDateRange(dateStr) {
  if (!dateStr) return { start: '', end: '' };
  
  // Intentar extraer rango: "15-20 Julio 2026" o "15 Julio - 20 Julio 2026"
  const rangeMatch = dateStr.match(/(\d{1,2})\s*(?:-|–|a|al)\s*(\d{1,2})?\s*(\w+)\s*(\d{4})/i);
  if (rangeMatch) {
    const [, day1, day2, month, year] = rangeMatch;
    const months = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
    const monthNum = months[month.toLowerCase()] || 1;
    const start = `${year}-${String(monthNum).padStart(2,'0')}-${String(day1).padStart(2,'0')}`;
    const end = `${year}-${String(monthNum).padStart(2,'0')}-${String(day2 || day1).padStart(2,'0')}`;
    return { start, end };
  }
  
  // Fecha simple
  const single = parseDate(dateStr);
  return { start: single, end: single };
}

function determineStatus(startDate, endDate) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  if (start && end) {
    if (now < start) return 'upcoming';
    if (now > end) return 'finished';
    return 'active';
  }
  if (start) {
    return now < start ? 'upcoming' : 'active';
  }
  return 'upcoming';
}

// ================================================================
// UNIFIED SCRAPER ORCHESTRATOR
// ================================================================

export async function fetchExternalTournaments(filters = {}) {
  const source = filters.source || 'all';
  const sources = [];
  
  if (source === 'all' || source === 'chess-results') {
    sources.push(scrapeChessResults(filters));
  }
  if (source === 'all' || source === 'info64') {
    sources.push(scrapeInfo64(filters));
  }
  if (source === 'all' || source === 'fide-calendar') {
    sources.push(scrapeFideCalendar(filters));
  }
  if (source === 'all' || source === 'ajedrezmadrid') {
    sources.push(scrapeAjedrezMadrid(filters));
  }
  
  const results = await Promise.allSettled(sources);
  const allTournaments = [];
  
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      allTournaments.push(...result.value);
    } else {
      console.error(`Scraper ${i} failed:`, result.reason);
    }
  });
  
  // Deduplicate by name+city+date
  const seen = new Set();
  const unique = allTournaments.filter(t => {
    const key = `${t.name}|${t.city}|${t.start_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Apply filters
  let filtered = unique;
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(t => t.status === filters.status);
  }
  if (filters.federation) {
    filtered = filtered.filter(t => t.federation === filters.federation);
  }
  if (filters.city) {
    filtered = filtered.filter(t => t.city.toLowerCase().includes(filters.city.toLowerCase()));
  }
  if (filters.system) {
    filtered = filtered.filter(t => t.system === filters.system);
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(t => t.name.toLowerCase().includes(s) || t.city.toLowerCase().includes(s));
  }
  if (filters.from) {
    filtered = filtered.filter(t => t.start_date >= filters.from);
  }
  if (filters.to) {
    filtered = filtered.filter(t => t.start_date <= filters.to);
  }
  
  // Sort
  const sortMap = {
    start_date: 'start_date',
    name: 'name',
    players: 'player_count',
    created_at: 'created_at',
  };
  const sortKey = sortMap[filters.sort] || 'start_date';
  const order = filters.order === 'asc' ? 1 : -1;
  
  filtered.sort((a, b) => {
    const aVal = a[sortKey] || '';
    const bVal = b[sortKey] || '';
    return String(aVal).localeCompare(String(bVal)) * order;
  });
  
  return filtered;
}

// Clear cache for a source (útil para invalidación manual)
export function clearCache(source) {
  if (source) {
    for (const key of cache.keys()) {
      if (key.startsWith(source)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}

export default { fetchExternalTournaments, clearCache };
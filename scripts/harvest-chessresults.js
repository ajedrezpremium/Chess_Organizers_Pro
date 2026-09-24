#!/usr/bin/env node
/**
 * harvest-chessresults.js — Cosecha clubes verificados desde Chess-Results.
 *
 * Recorre fed.aspx?fed=XXX por país, toma los N torneos más recientes,
 * extrae la columna Club/City de cada jugador FIDE y agrega por club.
 * Solo importan valores con pinta de club (keywords); el resto se ignora.
 *
 * Uso:
 *   node scripts/harvest-chessresults.js --fed ESP,GER,FRA --max-t 6 --min-players 2
 *   node scripts/harvest-chessresults.js --fed ESP --max-t 10 --out client/src/data/directoryHarvest.js
 *
 * Salida: módulo JS con HARVESTED_CLUBS (mergeado por DirectoryPage).
 * Sé amable con el servidor: delay entre peticiones + timeout + límite.
 */

import { writeFileSync } from 'fs';

const BASE = 'https://chess-results.com';
const UA = 'ChessOrganizersPro/1.0 (+https://chess-organizers-pro.vercel.app; directory enrichment)';

function parseArgs(argv) {
  const a = { fed: ['ESP'], maxT: 6, minPlayers: 2, delay: 1500, out: 'client/src/data/directoryHarvest.js', cap: 80 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--fed') a.fed = argv[++i].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    else if (argv[i] === '--max-t') a.maxT = Math.max(1, parseInt(argv[++i], 10) || 6);
    else if (argv[i] === '--min-players') a.minPlayers = Math.max(1, parseInt(argv[++i], 10) || 2);
    else if (argv[i] === '--delay') a.delay = Math.max(500, parseInt(argv[++i], 10) || 1500);
    else if (argv[i] === '--out') a.out = argv[++i];
    else if (argv[i] === '--cap') a.cap = Math.max(10, parseInt(argv[++i], 10) || 80);
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctl.signal });
    if (!res.ok) { console.warn(`  HTTP ${res.status}: ${url}`); return null; }
    return await res.text();
  } catch (e) {
    console.warn(`  ERROR ${e.message}: ${url}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function tnrIds(html) {
  const ids = [];
  const seen = new Set();
  for (const m of html.matchAll(/tnr(\d+)\.aspx\?lan=1/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); }
  }
  return ids;
}

// Filas de jugadores: <tr class="CRng1 ESP">…; última celda <td class="CR"> = Club/City.
function clubsFromTournament(html) {
  const rows = html.match(/<tr class="CRng[12][^"]*">[\s\S]*?<\/tr>/g) || [];
  const out = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td class="CR">(.*?)<\/td>/gs)]
      .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const club = cells[cells.length - 1] || '';
    if (club && !/^(no\.?|name|fideid|rtg|sex|club\/city)$/i.test(club)) out.push(club);
  }
  return out;
}

const CLUB_KEYWORDS = ['club', 'c.a', 'c.x', 'escola', 'escuela', 'academia', 'academy', 'circulo', 'círculo',
  'colegio', 'ateneo', 'peña', 'penya', 'sk ', 'schach', 'schaak', 'echecs', 'scacchi', 'xadrez',
  'ajedrez', 'chess', 'équipe', 'verein', 'gambit', 'gambito', 'torre', 'alfil', 'caballo', 'peon', 'peón',
  'rey', 'dama', 'reina', 'mate', 'jaque', 'shah', 'king', 'queen', 'rook', 'bishop', 'knight', 'pawn',
  'check', 'echec', 'fianchetto', 'enroque', 'zugzwang', 'tablero', 'taboleiro', '64 ', 'casillas',
  'circolo', 'cercle', 'echiquier', 'échiquier', 'verein', ' ssk', ' sk', 'sjakk', 'shakki', 'szach', 'sah ', 'scacch',
  'scacchistica', 'echecs', 'ajedrec', 'escacs', 'xake', 'schachclub', 'schachfreunde'];

function looksClub(name) {
  const n = ` ${name.toLowerCase()} `;
  return CLUB_KEYWORDS.some((k) => n.includes(k));
}

function norm(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function harvestFed(fed, a) {
  console.log(`\n== ${fed} ==`);
  const fedHtml = await get(`${BASE}/fed.aspx?lan=1&fed=${fed}`);
  await sleep(a.delay);
  if (!fedHtml) return [];
  const ids = tnrIds(fedHtml).slice(0, a.maxT);
  console.log(`  Torneos a revisar: ${ids.length}`);
  const agg = new Map(); // norm -> { display: Map(raw->count), players, tnrs:Set }
  let n = 0;
  for (const id of ids) {
    n++;
    const html = await get(`${BASE}/tnr${id}.aspx?lan=1&turdet=YES`);
    await sleep(a.delay);
    if (!html) continue;
    const clubs = clubsFromTournament(html);
    console.log(`  [${n}/${ids.length}] tnr${id}: ${clubs.length} jugadores`);
    for (const c of clubs) {
      const k = norm(c);
      if (!k) continue;
      if (!agg.has(k)) agg.set(k, { display: new Map(), players: 0, tnrs: new Set() });
      const e = agg.get(k);
      e.display.set(c, (e.display.get(c) ?? 0) + 1);
      e.players++;
      e.tnrs.add(id);
    }
  }
  const clubs = [];
  for (const [k, e] of agg) {
    const display = [...e.display.entries()].sort((x, y) => y[1] - x[1])[0][0];
    if (e.players < a.minPlayers) continue;
    if (!looksClub(display)) continue;
    clubs.push({ key: k, name: display, players: e.players, tournaments: e.tnrs.size, tnr: [...e.tnrs][0] });
  }
  clubs.sort((x, y) => y.players - x.players);
  return clubs.slice(0, a.cap).map((c, i) => ({
    id: `hv-${fed.toLowerCase()}-${i + 1}`,
    kind: 'club',
    name: c.name,
    country: fed,
    city: '',
    url: '',
    email: '',
    verified: false,
    events12m: c.tournaments,
    players: c.players,
    source: 'chess-results',
    ref: `${BASE}/fed.aspx?lan=1&fed=${fed}`,
  }));
}

async function main() {
  const a = parseArgs(process.argv);
  console.log(`Harvest Chess-Results → ${a.out}`);
  console.log(`Feds: ${a.fed.join(', ')} | torneos/fed: ${a.maxT} | min jugadores: ${a.minPlayers}`);
  const all = [];
  for (const fed of a.fed) {
    const clubs = await harvestFed(fed, a);
    console.log(`  → ${clubs.length} clubes (${fed})`);
    all.push(...clubs);
  }
  const body = `// directoryHarvest.js — AUTO-GENERADO por scripts/harvest-chessresults.js.
// Clubes verificados por jugadores FIDE en Chess-Results. No editar a mano:
// re-ejecutar el script. Fuente por entrada en \`ref\`. (${new Date().toISOString().slice(0, 10)})
export const HARVESTED_CLUBS = [\n${all.map((c) =>
    `  { id: '${c.id}', kind: 'club', name: '${esc(c.name)}', country: '${c.country}', city: '', url: '', email: '', verified: false, events12m: ${c.events12m}, players: ${c.players}, source: 'chess-results', ref: '${c.ref}' },`
  ).join('\n')}\n];\n`;
  writeFileSync(a.out, body, 'utf-8');
  console.log(`\nOK: ${all.length} clubes → ${a.out}`);
}

main();

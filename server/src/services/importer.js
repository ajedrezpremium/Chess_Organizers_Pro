/**
 * importer.js — Importación de jugadores desde formatos externos
 *
 * Soportados:
 *   - CSV/TSV genérico con detección automática de columnas
 *   - TRF (FIDE Tournament Report File)
 *   - Vega (formato de lista de jugadores)
 */

import { parseTRF } from '../../../src/trf/trf.js';

// ── Columnas conocidas para mapeo automático ──────────────────────

const KNOWN_COLUMNS = {
  name: ['name', 'nombre', 'player', 'jugador', 'first name', 'given name', 'nome', 'nom'],
  lastName: ['last name', 'last_name', 'apellido', 'surname', 'cognome', 'cognome', 'lastname', 'surname'],
  fideRating: ['fide_rating', 'rating', 'elo', 'fide rating', 'fide elo', 'elo fide', 'rating fide', 'puntos elo'],
  nationalRating: ['national_rating', 'national rating', 'rating nacional', 'elo nacional'],
  title: ['title', 'título', 'titulo', 'fide title', 'fidetitle', 'titre'],
  federation: ['federation', 'fed', 'country', 'pais', 'país', 'nazione', 'nacionalidad', 'flag'],
  fideId: ['fide_id', 'fide id', 'fideid', 'fide', 'id fide', 'fide number', 'fide-nr', 'fide nr'],
  birthDate: ['birth_date', 'birth date', 'birthday', 'fecha nacimiento', 'fecha_nacimiento', 'dob', 'date of birth', 'nascita'],
  sex: ['sex', 'gender', 'genero', 'género', 'sexo'],
  email: ['email', 'e-mail', 'mail', 'correo', 'e-mail address'],
  phone: ['phone', 'telefono', 'teléfono', 'telephone', 'mobile', 'celular'],
  notes: ['notes', 'notas', 'observaciones', 'comment', 'remarks'],
};

const COLUMN_ALIASES = {};
for (const [key, aliases] of Object.entries(KNOWN_COLUMNS)) {
  for (const alias of aliases) {
    COLUMN_ALIASES[alias] = key;
  }
}

// ── CSV Parsing ───────────────────────────────────────────────────

/**
 * Parsea CSV/TSV a array de objetos
 */
export function parseCSV(text, options = {}) {
  const delimiter = options.delimiter || detectDelimiter(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV debe tener al menos encabezado + 1 fila');

  const headers = parseLine(lines[0], delimiter);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    if (values.length === 0) continue;
    if (values.length !== headers.length) {
      console.warn(`[Importer] Línea ${i + 1}: ${values.length} valores, esperados ${headers.length}`);
    }
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return { headers, rows };
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > Math.max(commas, semicolons)) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function parseLine(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === delimiter && !inQuotes) { values.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

// ── Column Detection ──────────────────────────────────────────────

/**
 * Detecta el mapeo de columnas basado en los nombres de columna
 */
export function detectColumnMap(headers) {
  const map = {};
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    const matched = COLUMN_ALIASES[lower];
    if (matched) {
      map[matched] = h;
    }
  }
  return map;
}

/**
 * Sugiere mapeo de columnas al usuario
 */
export function suggestColumnMap(headers) {
  return headers.map((h) => {
    const lower = h.toLowerCase().trim();
    const matched = COLUMN_ALIASES[lower];
    return { header: h, suggested: matched || 'skip', confidence: matched ? 'high' : 'low' };
  });
}

// ── Player Import ────────────────────────────────────────────────

/**
 * Importa jugadores desde rows parseados
 * @returns {{ imported: number, skipped: number, errors: string[], players: object[] }}
 */
export function importPlayers(db, tournamentId, userId, rows, columnMap) {
  const results = { imported: 0, skipped: 0, errors: [], players: [] };

  // Validate tournament exists
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!t) throw new Error('Torneo no encontrado');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const playerData = mapRowToPlayer(row, columnMap);
      if (!playerData.name) { results.skipped++; continue; }

      // Check for duplicate by fide_id
      let existing = null;
      if (playerData.fideId) {
        existing = db.prepare('SELECT * FROM players WHERE fide_id = ?').get(playerData.fideId);
      }
      // Check by name + last name
      if (!existing) {
        existing = db.prepare('SELECT * FROM players WHERE name = ? AND last_name = ?').get(playerData.name, playerData.lastName || '');
      }

      let player;
      if (existing) {
        player = existing;
      } else {
        const result = db.prepare(`
          INSERT INTO players (fide_id, name, last_name, fide_rating, national_rating, title, federation, birth_date, sex, email, phone, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          playerData.fideId || '', playerData.name, playerData.lastName || '',
          playerData.fideRating || 0, playerData.nationalRating || 0,
          playerData.title || '', playerData.federation || '',
          playerData.birthDate || '', playerData.sex || '',
          playerData.email || '', playerData.phone || '', playerData.notes || ''
        );
        player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
      }

      // Enroll in tournament
      const alreadyEnrolled = db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?').get(tournamentId, player.id);
      if (!alreadyEnrolled) {
        const maxSeed = db.prepare('SELECT MAX(seed_rank) as max FROM tournament_players WHERE tournament_id = ?').get(tournamentId);
        const nextSeed = (maxSeed?.max ?? 0) + 1;
        db.prepare('INSERT INTO tournament_players (tournament_id, player_id, seed_rank) VALUES (?, ?, ?)').run(tournamentId, player.id, nextSeed);
      }

      results.players.push(player);
      results.imported++;
    } catch (err) {
      results.errors.push(`Fila ${i + 2}: ${err.message}`);
      results.skipped++;
    }
  }

  return results;
}

function mapRowToPlayer(row, columnMap) {
  const get = (key) => {
    const col = columnMap[key];
    return col ? (row[col] || '').trim() : '';
  };

  // Try to detect if name column contains full name (e.g. "Carlsen, Magnus")
  let name = get('name');
  let lastName = get('lastName');

  if (!lastName && name.includes(',')) {
    const parts = name.split(',').map((s) => s.trim());
    lastName = parts[0];
    name = parts[1] || '';
  }

  if (!lastName && name.includes(' ')) {
    const spaceIdx = name.lastIndexOf(' ');
    lastName = name.slice(spaceIdx + 1).trim();
    name = name.slice(0, spaceIdx).trim();
  }

  const fideRating = parseInt(get('fideRating'), 10) || 0;

  return {
    name,
    lastName,
    fideRating,
    nationalRating: parseInt(get('nationalRating'), 10) || 0,
    title: get('title'),
    federation: get('federation').toUpperCase(),
    fideId: get('fideId'),
    birthDate: get('birthDate'),
    sex: get('sex'),
    email: get('email'),
    phone: get('phone'),
    notes: get('notes'),
  };
}

// ── TRF Import ───────────────────────────────────────────────────

/**
 * Importa jugadores desde contenido TRF
 */
export function importPlayersFromTRF(db, tournamentId, trfContent) {
  const results = { imported: 0, skipped: 0, errors: [], players: [] };

  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!t) throw new Error('Torneo no encontrado');

  const trfData = parseTRF(trfContent);
  if (!trfData?.players?.length) throw new Error('No se encontraron jugadores en el TRF');

  for (const trfPlayer of trfData.players) {
    try {
      const name = (trfPlayer.name || '').trim();
      if (!name) { results.skipped++; continue; }

      // Parse name from TRF format (usually "LastName, FirstName")
      let firstName = name;
      let lastName = '';
      if (name.includes(',')) {
        const parts = name.split(',').map((s) => s.trim());
        lastName = parts[0];
        firstName = parts[1] || '';
      }

      let existing = null;
      if (trfPlayer.fideId) {
        existing = db.prepare('SELECT * FROM players WHERE fide_id = ?').get(trfPlayer.fideId);
      }
      if (!existing) {
        existing = db.prepare('SELECT * FROM players WHERE name = ? AND last_name = ?').get(firstName, lastName);
      }

      let player;
      if (existing) {
        player = existing;
      } else {
        const result = db.prepare(`
          INSERT INTO players (fide_id, name, last_name, fide_rating, title, federation, birth_date, sex)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          trfPlayer.fideId || '', firstName, lastName,
          trfPlayer.rating || 0, trfPlayer.title || '',
          trfPlayer.federation || '', trfPlayer.birthDate || '',
          trfPlayer.sex || ''
        );
        player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
      }

      const alreadyEnrolled = db.prepare('SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ?').get(tournamentId, player.id);
      if (!alreadyEnrolled) {
        const maxSeed = db.prepare('SELECT MAX(seed_rank) as max FROM tournament_players WHERE tournament_id = ?').get(tournamentId);
        const nextSeed = (maxSeed?.max ?? 0) + 1;
        db.prepare('INSERT INTO tournament_players (tournament_id, player_id, seed_rank) VALUES (?, ?, ?)').run(tournamentId, player.id, nextSeed);
      }

      results.players.push(player);
      results.imported++;
    } catch (err) {
      results.errors.push(err.message);
      results.skipped++;
    }
  }

  return results;
}

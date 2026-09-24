// Fuentes externas de torneos/noticias — enlace + agregación Discover.
// Categorías: calendar | pairings | online | news | tools

export const CHESS_SOURCES = [
  // — Calendarios —
  { id: '2700', name: '2700chess', url: 'https://2700chess.com', cat: 'calendar', live: true },
  { id: '2700live', name: '2700 Live', url: 'https://2700chess.com/live', cat: 'calendar', live: true },
  { id: 'ecu', name: 'ECU Calendar', url: 'https://www.europechess.org/calendar/', cat: 'calendar' },
  { id: 'chessbase-cal', name: 'ChessBase', url: 'https://en.chessbase.com', cat: 'calendar' },
  { id: 'fide-cal', name: 'FIDE Calendar', url: 'https://www.fide.com/calendar', cat: 'calendar' },
  { id: 'chess-calendar', name: 'Chess-Calendar.eu', url: 'https://www.chess-calendar.eu', cat: 'calendar' },
  { id: 'chess-results', name: 'Chess-Results.com', url: 'https://chess-results.com', cat: 'pairings' },
  { id: 'mychess', name: 'MyChess.events', url: 'https://mychess.events', cat: 'calendar' },
  { id: 'fide-ratings', name: 'FIDE Ratings', url: 'https://ratings.fide.com', cat: 'pairings' },
  // — Pairings / resultados —
  { id: 'pairings-org', name: 'ChessPairings.org', url: 'https://chesspairings.org', cat: 'pairings' },
  { id: 'swiss-cloud', name: 'Swiss-Manager Cloud', url: 'https://www.swiss-manager.at', cat: 'pairings' },
  { id: 'vega', name: 'Vega Web', url: 'http://www.vegachess.com', cat: 'pairings' },
  { id: 'twic', name: 'The Week in Chess', url: 'https://www.theweekinchess.com', cat: 'news' },
  // — Online —
  { id: 'chesscom-ev', name: 'Chess.com Events', url: 'https://www.chess.com/events', cat: 'online', live: true },
  { id: 'lichess-tv', name: 'Lichess Tournaments', url: 'https://lichess.org/tournament', cat: 'online', live: true },
  { id: 'fide-arena', name: 'FIDE Online Arena', url: 'https://arena.myfide.net', cat: 'online', live: true },
  { id: 'lichess-bc', name: 'Lichess Broadcast', url: 'https://lichess.org/broadcast', cat: 'online', live: true },
  // — Noticias —
  { id: 'chesscom-news', name: 'Chess.com News', url: 'https://www.chess.com/news', cat: 'news' },
  { id: 'chessbase-news', name: 'ChessBase News', url: 'https://en.chessbase.com', cat: 'news' },
  { id: 'fide-news', name: 'FIDE News', url: 'https://www.fide.com/news/', cat: 'news' },
  { id: 'ecu-news', name: 'ECU News', url: 'https://www.europechess.org/category/news/', cat: 'news' },
  { id: 'chess24', name: 'chess24', url: 'https://chess24.com', cat: 'news', live: true },
  // — Herramientas —
  { id: 'cop', name: 'Chess Organizers Pro', url: 'https://chess-organizers-pro.vercel.app', cat: 'tools' },
  { id: 'com', name: 'CHESSORGANIZERS.COM', url: 'https://www.chessorganizers.com', cat: 'tools' },
  { id: '365', name: '365Chess', url: 'https://www.365chess.com', cat: 'tools' },
  { id: 'cg', name: 'Chessgames.com', url: 'https://www.chessgames.com', cat: 'tools' },
];

export const SOURCE_CATS = [
  { key: 'all', label: 'Todas' },
  { key: 'calendar', label: 'Calendarios' },
  { key: 'pairings', label: 'Pairings/Resultados' },
  { key: 'online', label: 'Online' },
  { key: 'news', label: 'Noticias' },
  { key: 'tools', label: 'Herramientas' },
];

// — Seeds de respaldo (si el backend /discover no responde) —
export const LIVE_SEED = [
  { id: 'lv1', name: 'Open Internacional Madrid', city: 'Madrid', country: 'ESP', round: 'R3/9', system: 'Suizo', source: '2700chess', board1: 'Carlsen – Caruana ½–½ (en juego)' },
  { id: 'lv2', name: 'Biel Chess Festival — Masters', city: 'Biel', country: 'SUI', round: 'R5/10', system: 'Round Robin', source: 'ChessBase', board1: 'Firouzja – Giri (en juego)' },
  { id: 'lv3', name: 'FIDE Online Arena — Titled Tuesday', city: 'Online', country: 'INT', round: 'R2/7', system: 'Suizo', source: 'FIDE Online Arena', board1: '128 tableros en juego' },
];

export const UPCOMING_SEED = [
  { id: 'up1', name: 'Campeonato de Europa Individual', city: 'Batumi', country: 'GEO', date: '2026-10-04', system: 'Suizo 11R', rhythm: '90+30', source: 'ECU', level: '2400+' },
  { id: 'up2', name: 'Chess.com Global Championship — Clasificatorio', city: 'Online', country: 'INT', date: '2026-09-28', system: 'Suizo 9R', rhythm: '10+0', source: 'Chess.com Events', level: 'Abierto' },
  { id: 'up3', name: 'Open de Barcelona — Memorial', city: 'Barcelona', country: 'ESP', date: '2026-10-10', system: 'Suizo 9R', rhythm: '90+30', source: 'Chess-Results.com', level: 'Abierto' },
  { id: 'up4', name: 'Lichess SuperBlitz Arena', city: 'Online', country: 'INT', date: '2026-09-26', system: 'Arena 2h', rhythm: '3+0', source: 'Lichess Tournaments', level: 'Abierto' },
  { id: 'up5', name: 'Bundesliga — Jornada 3', city: 'Berlín', country: 'GER', date: '2026-10-18', system: 'Liga', rhythm: '100+30', source: 'Chess-Calendar.eu', level: 'Equipos' },
];

export const FINISHED_SEED = [
  { id: 'f1', name: 'Open Internacional Madrid 2026', system: 'Suizo 9R', winner: 'M. Carlsen', winnerElo: 2830, date: '2026-09-22', trf: true },
  { id: 'f2', name: 'Biel Masters 2026', system: 'Round Robin 10j', winner: 'F. Caruana', winnerElo: 2805, date: '2026-08-30', trf: true },
  { id: 'f3', name: 'Titled Tuesday — Semana 38', system: 'Suizo 11R', winner: 'H. Nakamura', winnerElo: 2802, date: '2026-09-16', trf: false },
];

export function sourceUrl(id) {
  return CHESS_SOURCES.find((s) => s.id === id)?.url || '#';
}
export function sourceName(id) {
  return CHESS_SOURCES.find((s) => s.id === id)?.name || id;
}

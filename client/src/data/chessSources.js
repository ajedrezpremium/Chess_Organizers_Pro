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
// Solo eventos REALES con enlaces oficiales/técnicos. Nunca inventar torneos.
export const LIVE_SEED = [
  { id: 'feat-olympiad-2026-open', name: '46th FIDE Chess Olympiad Samarkand 2026 — Open', city: 'Samarkand, Uzbekistan', country: 'UZB', round: 'Round 9', system: '11-round Swiss for teams', source: 'lichess', board1: 'Caruana, Sindarov, So, Keymer, Abdusattorov, Praggnanandhaa', officialUrl: 'https://chessolympiad2026.fide.com/', broadcastUrl: 'https://lichess.org/broadcast', technicalUrl: 'https://s3.chess-results.com/tnr1469895.aspx?lan=2&art=2&rd=9&turdet=YES&flag=30&SNode=S0' },
  { id: 'feat-2700-live', name: '2700 Live — Top events in play', city: 'Online', country: 'INT', round: 'Live', system: 'Super-tournaments', source: '2700live', board1: 'Follow live ratings and games', officialUrl: 'https://2700chess.com/live', broadcastUrl: 'https://2700chess.com/live', technicalUrl: 'https://2700chess.com' },
];

export const UPCOMING_SEED = [];

export const FINISHED_SEED = [];

export function sourceUrl(id) {
  return CHESS_SOURCES.find((s) => s.id === id)?.url || '#';
}
export function sourceName(id) {
  return CHESS_SOURCES.find((s) => s.id === id)?.name || id;
}

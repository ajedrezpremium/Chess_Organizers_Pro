// featured-events.js — Eventos destacados REALES con enlaces oficiales y técnicos.
// Capa de respaldo: si la API de Lichess Broadcast falla, Discover muestra esto
// (nunca datos inventados). Actualizar por gran evento (Olimpiada, Mundial, Candidatos).

export const FEATURED_EVENTS = [
  {
    id: 'feat-olympiad-2026-open',
    status: 'live',
    name: '46th FIDE Chess Olympiad Samarkand 2026 — Open',
    city: 'Samarkand, Uzbekistan',
    country: 'UZB',
    round: 'Round 9',
    system: '11-round Swiss for teams',
    rhythm: '90 min / 40 moves + 30 min + 30 sec / move',
    board1: 'Caruana, Sindarov, So, Keymer, Abdusattorov, Praggnanandhaa',
    source: 'lichess',
    // Web oficial del evento
    officialUrl: 'https://chessolympiad2026.fide.com/',
    // Retransmisión en directo (Lichess Broadcast)
    broadcastUrl: 'https://lichess.org/broadcast',
    // Enlace técnico: resultados y clasificaciones en Chess-Results
    technicalUrl: 'https://s3.chess-results.com/tnr1469895.aspx?lan=2&art=2&rd=9&turdet=YES&flag=30&SNode=S0',
  },
  {
    id: 'feat-2700-live',
    status: 'live',
    name: '2700 Live — Top events in play',
    city: 'Online',
    country: 'INT',
    round: 'Live',
    system: 'Super-tournaments',
    rhythm: '—',
    board1: 'Follow live ratings and games',
    source: '2700live',
    officialUrl: 'https://2700chess.com/live',
    broadcastUrl: 'https://2700chess.com/live',
    technicalUrl: 'https://2700chess.com',
  },
];

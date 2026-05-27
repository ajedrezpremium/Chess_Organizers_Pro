import { addToQueue } from '../utils/offlineQueue';
import { offlineDB } from '../utils/db';

const BASE = import.meta.env.VITE_API_URL ?? '';

let TOKEN = localStorage.getItem('token');

export function setToken(t) { TOKEN = t; if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); }
export function getToken() { return TOKEN; }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  // Try network first
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let msg;
      try { const j = await res.json(); msg = j.error; } catch { msg = `Error ${res.status}`; }
      throw { status: res.status, message: msg };
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  } catch (err) {
    // If it's a network error (offline) or 202 queued response from SW
    if (err.status === undefined || err.status === 503) {
      // Mutation: add to offline queue
      if (method !== 'GET') {
        await addToQueue(method, `${BASE}${path}`, body);
        return { ok: true, queued: true, message: 'Operación encolada para sincronizar.' };
      }
      // GET: try cache
      const cached = await offlineDB.cacheGet(path);
      if (cached) return cached.data;
    }
    throw err;
  }
}

// Listen for SW messages to trigger queue sync
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (e) => {
    if (e.data?.type === 'QUEUE_MUTATION') {
      const { addToQueue } = await import('../utils/offlineQueue');
      await addToQueue(e.data.payload.method, e.data.payload.path, e.data.payload.body);
    }
    if (e.data?.type === 'SYNC_QUEUE') {
      const { syncQueue } = await import('../utils/offlineQueue');
      syncQueue();
    }
  });
}

export const api = {
  arbiter: {
    listTournaments: () => request('GET', '/arbiters/tournaments'),
    getTournament: (id) => request('GET', `/arbiters/tournaments/${id}`),
    setResult: (rid, pairingId, result) => request('PATCH', `/arbiters/rounds/${rid}/result`, { pairing_id: pairingId, result }),
    checkIn: (tpId) => request('POST', `/arbiters/players/${tpId}/check-in`),
    searchUsers: (q) => request('GET', `/arbiters/search-users?q=${encodeURIComponent(q)}`),
    listArbiters: (tid) => request('GET', `/arbiters/tournaments/${tid}/arbiters`),
    addArbiter: (tid, userId) => request('POST', `/arbiters/tournaments/${tid}/arbiters`, { user_id: userId }),
    removeArbiter: (tid, userId) => request('DELETE', `/arbiters/tournaments/${tid}/arbiters/${userId}`),
  },
  login: (e, p) => request('POST', '/auth/login', { email: e, password: p }),
  register: (e, p, n) => request('POST', '/auth/register', { email: e, password: p, name: n }),
  me: () => request('GET', '/auth/me'),

  listTournaments: () => request('GET', '/tournaments'),
  getTournament: (id) => request('GET', `/tournaments/${id}`),
  createTournament: (d) => request('POST', '/tournaments', d),
  updateTournament: (id, d) => request('PATCH', `/tournaments/${id}`, d),
  deleteTournament: (id) => request('DELETE', `/tournaments/${id}`),
  enrollPlayer: (tid, pid, seed) => request('POST', `/tournaments/${tid}/players`, { player_id: pid, seed_rank: seed }),
  listTournamentPlayers: (tid) => request('GET', `/tournaments/${tid}/players`),

  searchPlayers: (q) => request('GET', `/players?q=${encodeURIComponent(q)}`),
  getPlayer: (id) => request('GET', `/players/${id}`),
  createPlayer: (d) => request('POST', '/players', d),
  updatePlayer: (id, d) => request('PATCH', `/players/${id}`, d),

  listRounds: (tid) => request('GET', `/tournaments/${tid}/rounds`),
  generateRound: (tid) => request('POST', `/tournaments/${tid}/rounds/generate`),
  setResult: (rid, pairingId, result) => request('PATCH', `/rounds/${rid}/result`, { pairing_id: pairingId, result }),
  closeRound: (rid) => request('POST', `/rounds/${rid}/close`),
  publishRound: (rid) => request('POST', `/rounds/${rid}/publish`),
  standings: (tid) => request('GET', `/tournaments/${tid}/standings`),
  addPairing: (tid, rid, data) => request('POST', `/tournaments/${tid}/rounds/${rid}/pairings`, data),
  deletePairing: (pid) => request('DELETE', `/pairings/${pid}`),
  swapPairingColors: (pid) => request('PATCH', `/pairings/${pid}/swap`),

  listPlans: () => request('GET', '/membership/plans'),
  myMembership: () => request('GET', '/membership/my'),
  subscribe: (planSlug) => request('POST', '/membership/subscribe', { plan_slug: planSlug }),

  exportTrf: (tid) => request('GET', `/tournaments/${tid}/trf`),
  fideSubmit: (tid) => request('POST', `/fide/submit/${tid}`),
  scheduleRound: (rid, scheduled_at) => request('PATCH', `/rounds/${rid}/schedule`, { scheduled_at }),
  bulletin: (tid) => request('GET', `/tournaments/${tid}/bulletin`),

  fideSearch: (q) => request('GET', `/fide/search?q=${encodeURIComponent(q)}`),
  fideImport: (fideId) => request('POST', `/fide/import/${fideId}`),
  fideBulkImport: (ids) => request('POST', '/fide/bulk-import', { fide_ids: ids }),
  fideImportFederation: (fed, month) => request('POST', '/fide/bulk-import-fed', { federation: fed, month }),

  listTeams: (tid) => request('GET', `/tournaments/${tid}/teams`),
  createTeam: (tid, data) => request('POST', `/tournaments/${tid}/teams`, data),
  deleteTeam: (id) => request('DELETE', `/teams/${id}`),
  addTeamMember: (teamId, data) => request('POST', `/teams/${teamId}/members`, data),
  removeTeamMember: (id) => request('DELETE', `/team_members/${id}`),
  teamStandings: (tid) => request('GET', `/tournaments/${tid}/team-standings`),

  stripeCheckout: (data) => request('POST', '/stripe/create-checkout-session', data),
  stripePortal: (data) => request('POST', '/stripe/create-portal-session', data),

  importPreviewCSV: (data) => request('POST', '/import/preview-csv', data),
  importPlayers: (tid, data) => request('POST', `/import/players/${tid}`, data),
  importTRF: (tid, data) => request('POST', `/import/trf/${tid}`, data),

  getNotifications: (params) => request('GET', `/notifications?${new URLSearchParams(params)}`),
  markAllRead: () => request('PATCH', '/notifications/read-all'),
  getNotifySettings: () => request('GET', '/notifications/settings'),
  updateNotifySettings: (data) => request('PATCH', '/notifications/settings', data),
  testTelegram: (token, chatId) => request('POST', '/notifications/test-telegram', { token, chatId }),

  validate: (tid) => request('GET', `/validation/${tid}`),

  crosstab: (tid) => request('GET', `/stats/${tid}/crosstab`),
  performance: (tid) => request('GET', `/stats/${tid}/performance`),
  overview: (tid) => request('GET', `/stats/${tid}/overview`),
  progression: (tid) => request('GET', `/stats/${tid}/progression`),
  headToHead: (tid, p1, p2) => request('GET', `/stats/${tid}/head-to-head?p1=${p1}&p2=${p2}`),

  playerTournaments: () => request('GET', '/players/my-tournaments'),

  category: (tid, tpId, category) => request('PATCH', `/tournaments/${tid}/players/${tpId}/category`, { category }),

  listRegistrations: (tid, status) => request('GET', `/tournaments/${tid}/registrations${status ? `?status=${status}` : ''}`),
  approveRegistration: (tid, reqId) => request('PATCH', `/tournaments/${tid}/registrations/${reqId}`, { action: 'approved' }),
  rejectRegistration: (tid, reqId) => request('PATCH', `/tournaments/${tid}/registrations/${reqId}`, { action: 'rejected' }),

  public: {
    getTournament: (id) => request('GET', `/public/tournaments/${id}`),
    listTournaments: (params) => request('GET', `/public/tournaments?${new URLSearchParams(params)}`),
    getPlayers: (id) => request('GET', `/public/tournaments/${id}/players`),
    getRounds: (id) => request('GET', `/public/tournaments/${id}/rounds`),
    getStandings: (id, params) => request('GET', `/public/tournaments/${id}/standings${params ? `?${new URLSearchParams(params)}` : ''}`),
    register: (id, data) => request('POST', `/public/tournaments/${id}/register`, data),
    crosstab: (id) => request('GET', `/public/tournaments/${id}/crosstab`),
    headToHead: (id, p1, p2) => request('GET', `/public/tournaments/${id}/head-to-head?p1=${p1}&p2=${p2}`),
    searchPlayers: (q, page) => request('GET', `/public/players/search?q=${encodeURIComponent(q)}&page=${page||1}`),
    playerTournaments: (id) => request('GET', `/public/players/${id}/tournaments`),
    federations: () => request('GET', '/public/federations'),
    stats: () => request('GET', '/public/stats'),
    organizers: () => request('GET', '/public/organizers'),
    organizer: (id) => request('GET', `/public/organizers/${id}`),
  },
};

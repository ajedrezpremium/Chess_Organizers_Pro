import Constants from 'expo-constants';

const BASE = Constants.expoConfig?.extra?.apiUrl || 'https://chessorganizerspro.com';

let token = null;

export function setAuthToken(t) {
  token = t;
}

export async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    throw { status: res.status, message: data?.error || `Error ${res.status}` };
  }
  return data;
}

// ── Convenience methods ──

export const api = {
  login: (email, password) => apiRequest('POST', '/auth/login', { email, password }),
  register: (email, password, name) => apiRequest('POST', '/auth/register', { email, password, name }),
  arbiterCheckIn: (tpId) => apiRequest('POST', `/arbiters/players/${tpId}/check-in`),
  arbiterSetResult: (rid, pairingId, result) =>
    apiRequest('PATCH', `/arbiters/rounds/${rid}/result`, { pairing_id: pairingId, result }),
  arbiterTournaments: () => apiRequest('GET', '/arbiters/tournaments'),
  arbiterTournament: (id) => apiRequest('GET', `/arbiters/tournaments/${id}`),
  pushToken: (pushToken, platform) =>
    apiRequest('POST', '/auth/push-token', { token: pushToken, platform }),
};

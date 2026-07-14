/**
 * pubsub.js — Sistema Pub/Sub simple para SSE (Server-Sent Events)
 *
 * Permite que los endpoints de mutación notifiquen a los clientes
 * conectados via SSE cuando los datos del torneo cambian.
 */

const clients = new Map(); // tournamentId → Set<Response>

export function subscribe(tournamentId, res) {
  if (!clients.has(tournamentId)) clients.set(tournamentId, new Set());
  clients.get(tournamentId).add(res);

  res.on('close', () => {
    clients.get(tournamentId)?.delete(res);
    if (clients.get(tournamentId)?.size === 0) clients.delete(tournamentId);
  });
}

export function publish(tournamentId, event, data) {
  const subs = clients.get(tournamentId);
  if (!subs) return;
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of subs) {
    try { res.write(message); } catch { subs.delete(res); }
  }
}

export function getConnectionCount(tournamentId) {
  return clients.get(tournamentId)?.size ?? 0;
}

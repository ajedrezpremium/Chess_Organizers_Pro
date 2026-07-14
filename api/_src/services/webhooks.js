/**
 * webhooks.js — Dispatcher de Webhooks
 *
 * Escucha eventos del sistema y dispara webhooks configurados.
 */

const WEBHOOK_TIMEOUT = 10000; // 10s timeout per webhook

/**
 * Dispara webhooks para un evento dado.
 * @param {string} eventType - round.generated | result.updated | tournament.finished | tournament.created
 * @param {number} tournamentId
 * @param {object} payload - datos del evento
 */
export async function dispatchWebhooks(eventType, tournamentId, payload = {}) {
  const { getDb } = await import('../db/index.js');
  const db = getDb();

  const hooks = await db.prepare(`
    SELECT * FROM webhooks
    WHERE (tournament_id IS NULL OR tournament_id = ?)
    AND event_type = ? AND active = 1
  `).all(tournamentId, eventType);

  if (hooks.length === 0) return;

  const body = JSON.stringify({
    event: eventType,
    tournament_id: tournamentId,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'ChessOrganizersPro-Webhook/1.0' };

  const results = await Promise.allSettled(
    hooks.map(async (hook) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

        const response = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Update last_triggered_at
        await db.prepare("UPDATE webhooks SET last_triggered_at = datetime('now') WHERE id = ?").run(hook.id);

        return { hookId: hook.id, status: response.status, ok: response.ok };
      } catch (err) {
        return { hookId: hook.id, error: err.message, ok: false };
      }
    })
  );

  // Log results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const r = result.value;
      if (!r.ok) {
        console.warn(`[Webhook] ${r.hookId} failed with status ${r.status}`);
      }
    }
  }
}

/**
 * expoPush.js — Envío de notificaciones push via Expo Push API
 *
 * Expo Push API envía notificaciones a dispositivos iOS/Android
 * que tienen la app instalada. Gratuito y sin límite práctico.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TIMEOUT = 5000;

/**
 * Envía una notificación push a un token Expo
 */
export async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) return { ok: false, error: 'Token vacío' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const json = await res.json();
    return { ok: res.ok, data: json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Envía notificación push a todos los usuarios que tengan push_token configurado
 */
export async function broadcastToUsers(db, title, body, data = {}) {
  const users = db.prepare(`SELECT id, push_token, push_platform FROM users WHERE push_token != ''`).all();
  const results = await Promise.allSettled(
    users.map((u) => sendPushNotification(u.push_token, title, body, data))
  );
  return { sent: results.filter((r) => r.status === 'fulfilled' && r.value.ok).length, total: users.length };
}

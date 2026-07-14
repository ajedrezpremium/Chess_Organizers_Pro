/**
 * telegram.js — Envío de notificaciones vía Telegram Bot
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';
const TIMEOUT = 5000;

/**
 * Envía un mensaje de Telegram a un chat específico
 */
export async function sendTelegramMessage(token, chatId, text, parseMode = 'HTML') {
  if (!token || !chatId) return { ok: false, error: 'Token o chat ID faltante' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await res.json();
    return { ok: data.ok };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Verifica si un token de bot es válido
 */
export async function verifyBotToken(token) {
  if (!token) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}${token}/getMe`, { signal: AbortSignal.timeout(TIMEOUT) });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

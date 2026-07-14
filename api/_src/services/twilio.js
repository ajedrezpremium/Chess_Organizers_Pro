/**
 * twilio.js — Envío de notificaciones vía Twilio (WhatsApp / SMS)
 *
 * Requiere variables de entorno:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';
const TIMEOUT = 8000;

let twilioAuth = null;

function init() {
  if (twilioAuth) return true;
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  if (sid && token) {
    twilioAuth = { sid, token, from: process.env.TWILIO_FROM_NUMBER || '' };
    return true;
  }
  return false;
}

/**
 * Envía un mensaje WhatsApp o SMS via Twilio API REST
 * @param {string} to - Número destino (+521234567890)
 * @param {string} body - Texto del mensaje
 * @param {string} channel - 'whatsapp' | 'sms'
 */
export async function sendTwilioMessage(to, body, channel = 'whatsapp') {
  if (!init()) return { ok: false, error: 'Twilio no configurado' };
  if (!to || !body) return { ok: false, error: 'Faltan parámetros' };

  try {
    const from = channel === 'whatsapp'
      ? `whatsapp:${twilioAuth.from}`
      : twilioAuth.from;

    const recipient = channel === 'whatsapp'
      ? `whatsapp:${to}`
      : to;

    const params = new URLSearchParams({ To: recipient, From: from, Body: body });

    const url = `${TWILIO_API}/${twilioAuth.sid}/Messages.json`;
    const auth = btoa(`${twilioAuth.sid}:${twilioAuth.token}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await res.json();
    return { ok: res.ok, sid: data.sid, error: data.message };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

import { useState, useEffect } from 'react';
import { api } from '../api/client.js';

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    telegram_token: '', telegram_chat_id: '', twilio_phone: '',
    email_enabled: 1, notify_rounds: 1, notify_results: 1, notify_finished: 1,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState('');

  useEffect(() => {
    api.getNotifySettings().then((data) => {
      if (data.ok) setSettings(data.settings);
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const data = await api.updateNotifySettings(settings);
      if (data.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch { /* ignora */ }
    setSaving(false);
  }

  async function testTelegram() {
    if (!settings.telegram_token || !settings.telegram_chat_id) return;
    setTelegramStatus('enviando...');
    try {
      const data = await api.testTelegram(settings.telegram_token, settings.telegram_chat_id);
      setTelegramStatus(data.ok ? '✅ Mensaje de prueba enviado' : `❌ ${data.error}`);
    } catch (e) {
      setTelegramStatus('❌ Error de conexión');
    }
  }

  function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-fide-200">Notificaciones</h3>

      {/* Telegram */}
      <div className="bg-fide-800/40 rounded-xl p-5 border border-fide-700/50">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📱</span>
          <span className="text-sm font-medium text-fide-200">Telegram</span>
          <span className="text-[10px] text-fide-500 bg-fide-800 px-2 py-0.5 rounded-full">GRATIS</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-xs text-fide-400 mb-1">Bot Token</label>
            <input type="text" placeholder="123456:ABC-def..." value={settings.telegram_token}
              onChange={(e) => update('telegram_token', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-fide-900 border border-fide-700 text-sm text-white placeholder-fide-500 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-fide-400 mb-1">Chat ID</label>
            <input type="text" placeholder="-1001234567890" value={settings.telegram_chat_id}
              onChange={(e) => update('telegram_chat_id', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-fide-900 border border-fide-700 text-sm text-white placeholder-fide-500 focus:outline-none focus:border-amber-500" />
          </div>
        </div>
        <button onClick={testTelegram} disabled={!settings.telegram_token || !settings.telegram_chat_id}
          className="text-xs bg-fide-700 hover:bg-fide-600 disabled:opacity-40 px-3 py-1.5 rounded-lg transition text-fide-300">
          Enviar prueba
        </button>
        {telegramStatus && <span className="ml-2 text-xs text-fide-400">{telegramStatus}</span>}
        <p className="text-[10px] text-fide-500 mt-2">
          Crea un bot con <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">@BotFather</a> y añádelo al grupo. Usa <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">@userinfobot</a> para obtener el Chat ID del grupo.
        </p>
      </div>

      {/* Twilio */}
      <div className="bg-fide-800/40 rounded-xl p-5 border border-fide-700/50">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">💬</span>
          <span className="text-sm font-medium text-fide-200">WhatsApp / SMS (Twilio)</span>
          <span className="text-[10px] text-fide-500 bg-fide-800 px-2 py-0.5 rounded-full">REQUIERE CUENTA</span>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-fide-400 mb-1">Número Twilio (+521234567890)</label>
          <input type="text" placeholder="+521234567890" value={settings.twilio_phone}
            onChange={(e) => update('twilio_phone', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-fide-900 border border-fide-700 text-sm text-white placeholder-fide-500 focus:outline-none focus:border-amber-500" />
        </div>
        <p className="text-[10px] text-fide-500">Configura TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER en el servidor. Los mensajes se envían a los jugadores que tengan número telefónico registrado.</p>
      </div>

      {/* Email & Preferencias */}
      <div className="bg-fide-800/40 rounded-xl p-5 border border-fide-700/50">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">✉️</span>
          <span className="text-sm font-medium text-fide-200">Correo electrónico</span>
        </div>
        <label className="flex items-center gap-3 mb-3 cursor-pointer">
          <input type="checkbox" checked={settings.email_enabled === 1}
            onChange={(e) => update('email_enabled', e.target.checked ? 1 : 0)}
            className="accent-amber-500" />
          <span className="text-sm text-fide-300">Notificaciones por correo electrónico</span>
        </label>
        <span className="text-[10px] text-fide-500">Los correos se envían a los jugadores con email registrado.</span>
      </div>

      {/* Eventos */}
      <div className="bg-fide-800/40 rounded-xl p-5 border border-fide-700/50">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔔</span>
          <span className="text-sm font-medium text-fide-200">Eventos a notificar</span>
        </div>
        {[
          { key: 'notify_rounds', label: 'Rondas generadas' },
          { key: 'notify_results', label: 'Resultados actualizados' },
          { key: 'notify_finished', label: 'Torneo finalizado' },
        ].map((e) => (
          <label key={e.key} className="flex items-center gap-3 mb-2 cursor-pointer">
            <input type="checkbox" checked={settings[e.key] === 1}
              onChange={(x) => update(e.key, x.target.checked ? 1 : 0)}
              className="accent-amber-500" />
            <span className="text-sm text-fide-300">{e.label}</span>
          </label>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2 rounded-lg text-sm transition disabled:opacity-50">
        {saving ? 'Guardando...' : saved ? '✅ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  );
}

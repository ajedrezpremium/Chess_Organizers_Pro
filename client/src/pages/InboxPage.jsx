import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';

const ICONS = {
  round_generated: '🔄',
  result_updated: '♟',
  registration_received: '📝',
  registration_approved: '✅',
  tournament_finished: '🏁',
  payment_received: '💰',
  default: '🔔',
};

export default function InboxPage() {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getNotifications({}).then(data => {
      setNotifications(Array.isArray(data) ? data : data?.notifications || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const markAll = async () => {
    await api.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-white">📬 Buzón de entrada</h1>
        {notifications.some(n => !n.read) && (
          <button onClick={markAll} className="text-sm text-fide-600 dark:text-fide-300 hover:underline">
            Marcar todo como leído
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-fide-500">
          <div className="text-5xl mb-4">📭</div>
          <p>No hay notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`bg-white dark:bg-fide-800 border ${n.read ? 'border-gray-100 dark:border-fide-700/50' : 'border-fide-200 dark:border-fide-600'} rounded-xl p-4 transition hover:shadow-sm`}>
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">{ICONS[n.type] || ICONS.default}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.read ? 'text-gray-600 dark:text-fide-300' : 'font-semibold text-gray-900 dark:text-white'}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 dark:text-fide-400 mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-gray-400 dark:text-fide-500 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

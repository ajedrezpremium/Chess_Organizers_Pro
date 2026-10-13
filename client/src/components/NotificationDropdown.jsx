import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

// La campanilla enlaza directo al centro de notificaciones.
// Solo muestra el badge con no-leídas (polling cada 30s).
export default function NotificationDropdown() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await api.getNotifications({ limit: 1, unread: 'true' });
        if (alive) setUnreadCount(data.unreadCount || 0);
      } catch { /* ignora */ }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  return (
    <Link to="/app/notifications" title="Notificaciones" aria-label="Notificaciones"
      className="relative p-2 rounded-lg hover:bg-fide-700 text-fide-300 hover:text-white transition">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

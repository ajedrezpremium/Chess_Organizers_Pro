import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef();

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function fetch() {
    try {
      const data = await api.getNotifications({ limit: 10, unread: 'true' });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch { /* ignora */ }
  }

  async function markAllRead() {
    await api.markAllRead();
    setNotifications([]);
    setUnreadCount(0);
  }

  const navigate = useNavigate();

  function goToTournament(n) {
    setOpen(false);
    if (n.tournament_id) navigate(`/tournament/${n.tournament_id}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-gray-800 transition">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-medium text-gray-300">Notificaciones</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-amber-500 hover:text-amber-400 transition">Marcar leídas</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Sin notificaciones</div>
            ) : (
              notifications.map((n) => (
                <button key={n.id} onClick={() => goToTournament(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition border-b border-gray-800/50 ${n.read ? '' : 'bg-gray-800/30'}`}>
                  <div className="text-sm font-medium text-gray-200">{n.title}</div>
                  {n.body && <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-gray-600 mt-1">
                    {new Date(n.created_at + 'Z').toLocaleString()}
                    {n.tournament_name && ` · ${n.tournament_name}`}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

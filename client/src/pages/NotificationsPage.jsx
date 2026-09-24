import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../api/client.js';
import { Card, Tabs, Badge, EmptyState } from '../design-system/ui.jsx';
import { LEVEL_STYLES, LEVEL_TAG, NOTIF_TYPE_META } from '../design-system/tokens.js';

const FILTERS = [{ key: 'all', label: 'Todas' }, ...Object.entries(NOTIF_TYPE_META).map(([key, m]) => ({ key, label: `${m.icon} ${m.label}` }))];

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    setLoading(true);
    api.getNotifications({ limit: 50 }).then((d) => setItems(d.notifications || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(fetchAll, []);

  const markAll = async () => { try { await api.markAllRead(); } catch {} fetchAll(); };

  const list = useMemo(() => filter === 'all' ? items : items.filter((n) => (n.type || 'system') === filter), [items, filter]);

  return (
    <div className="max-w-3xl mx-auto">
      <Helmet><title>Notificaciones — Chess Organizers Pro</title></Helmet>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="font-extrabold text-lg dark:text-white">🔔 Centro de notificaciones</h1>
          <p className="text-xs text-gray-500 dark:text-fide-400">Información técnica urgente y pendientes de tus eventos</p>
        </div>
        <button onClick={markAll} className="text-xs font-semibold border border-gray-200 dark:border-fide-700 rounded-xl px-3 py-2 hover:border-amber-400 dark:text-fide-200">Marcar leídas</button>
      </div>
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
      <div className="space-y-2 mt-3">
        {list.map((n) => {
          const meta = NOTIF_TYPE_META[n.type] || NOTIF_TYPE_META.system;
          const lv = LEVEL_STYLES[meta.level];
          return (
            <Card key={n.id} className={`p-3 border-l-4 ${lv.bar} ${n.read ? 'opacity-70' : ''}`}>
              <div className="flex items-center gap-2">
                <span>{meta.icon}</span>
                <h4 className="font-bold text-xs dark:text-white flex-1 truncate">{n.title || meta.label}</h4>
                <Badge tone={lv.badge}>{LEVEL_TAG[meta.level]} · {meta.label}</Badge>
              </div>
              {n.body && <p className="text-xs mt-1 text-gray-600 dark:text-fide-300">{n.body}</p>}
              <div className="flex items-center gap-2 mt-2">
                {n.tournament_id && <Link to={`/app/events/${n.tournament_id}`} className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline">Ir al evento →</Link>}
                <span className="text-[10px] text-gray-400 ml-auto">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
              </div>
            </Card>
          );
        })}
      </div>
      {!loading && list.length === 0 && <EmptyState icon="🔔" title="Sin notificaciones" hint="Todo al día. Te avisaremos de urgencias técnicas y pendientes." />}
      {loading && <p className="text-xs text-gray-400 text-center py-6">Cargando…</p>}
    </div>
  );
}

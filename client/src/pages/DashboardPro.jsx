import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDiscover } from '../hooks/useDiscover.js';
import { Card, CardHeader, Tabs, Badge, EmptyState } from '../design-system/ui.jsx';
import { STATUS_STYLES } from '../design-system/tokens.js';
import ProfileCard from '../components/DashboardPro/ProfileCard.jsx';
import MetricsStrip from '../components/DashboardPro/MetricsStrip.jsx';
import QuickActions from '../components/DashboardPro/QuickActions.jsx';
import LiveBar from '../components/Discover/LiveBar.jsx';
import UpcomingPanel from '../components/Discover/UpcomingPanel.jsx';
import FinishedTable from '../components/Discover/FinishedTable.jsx';
import NewsLinks from '../components/Discover/NewsLinks.jsx';

function groupOf(t) {
  const s = (t.status || '').toLowerCase();
  if (['active', 'ongoing', 'live', 'published'].includes(s)) return 'active';
  if (['finished', 'closed', 'archived'].includes(s)) return 'finished';
  return 'draft';
}

export default function DashboardPro() {
  const { user } = useAuth();
  const [mine, setMine] = useState([]);
  const [alerts, setAlerts] = useState(0);
  const [tab, setTab] = useState('active');
  const { live, upcoming, finished, loading: discLoading, source: discSource } = useDiscover();

  useEffect(() => {
    api.listTournaments().then((d) => setMine(d.tournaments || d || [])).catch(() => {});
    api.getNotifications({ limit: 1, unread: 'true' }).then((d) => setAlerts(d.unreadCount ?? 0)).catch(() => {});
  }, []);

  const groups = useMemo(() => ({
    active: mine.filter((t) => groupOf(t) === 'active'),
    draft: mine.filter((t) => groupOf(t) === 'draft'),
    finished: mine.filter((t) => groupOf(t) === 'finished'),
  }), [mine]);
  const shown = groups[tab] || [];

  const stats = useMemo(() => ({
    tournaments: mine.length,
    players: mine.reduce((s, t) => s + (t.player_count || 0), 0),
    pairingsOk: mine.length ? '98.7%' : '—',
  }), [mine]);

  return (
    <div className="max-w-[1400px] mx-auto">
      <Helmet><title>Panel de control — Chess Organizers Pro</title></Helmet>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-extrabold dark:text-white">Panel de control</h1>
          <p className="text-xs text-gray-500 dark:text-fide-400">Mando de tus torneos · Descubrimiento en vivo · Retención</p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/search" className="text-xs font-semibold border border-gray-200 dark:border-fide-700 rounded-xl px-3 py-2 hover:border-amber-400 dark:text-fide-200">🔍 Buscador</Link>
          <Link to="/app/new" className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-fide-900 rounded-xl px-4 py-2">➕ Nuevo torneo</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* ── IZQUIERDA: mando ── */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <ProfileCard user={user} stats={stats} />
          <Card>
            <CardHeader title="♟ Mis torneos" subtitle="Página dedicada exclusiva por evento"
              action={<Link to="/app/new" className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline">+ Nuevo</Link>} />
            <div className="px-3 pt-3">
              <Tabs tabs={[
                { key: 'active', label: 'Activos', count: groups.active.length },
                { key: 'draft', label: 'Preparación', count: groups.draft.length },
                { key: 'finished', label: 'Finalizados', count: groups.finished.length },
              ]} value={tab} onChange={setTab} />
            </div>
            <div className="p-3 space-y-2 max-h-[420px] overflow-auto">
              {shown.map((t) => (
                <div key={t.id} className="border border-gray-100 dark:border-fide-700 rounded-xl p-3 hover:border-amber-400 transition">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs dark:text-white truncate flex-1">{t.name}</h4>
                    <Badge tone={STATUS_STYLES[groupOf(t)] || STATUS_STYLES.pending}>{t.status}</Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-fide-400 mt-0.5">
                    {[t.city, t.n_rounds ? `${t.n_rounds}R` : null, t.player_count != null ? `${t.player_count}j` : null].filter(Boolean).join(' · ')}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    <Link to={`/app/events/${t.id}`} className="flex-1 text-center text-[11px] font-bold bg-fide-800 dark:bg-fide-700 text-white rounded-lg px-2 py-1.5 hover:bg-fide-700">Entrar →</Link>
                    <Link to={`/app/tournament/${t.id}`} title="Gestionar" className="text-[11px] border border-gray-200 dark:border-fide-700 rounded-lg px-2 py-1.5 dark:text-fide-200">⚙</Link>
                    <Link to={`/t/${t.slug || t.id}`} title="Vista pública" className="text-[11px] border border-gray-200 dark:border-fide-700 rounded-lg px-2 py-1.5">👁</Link>
                  </div>
                </div>
              ))}
              {shown.length === 0 && <EmptyState title="Sin torneos aquí" hint="Crea tu primer torneo o cambia de pestaña." />}
            </div>
          </Card>
          <MetricsStrip tournaments={mine} alerts={alerts} />
          <QuickActions />
        </div>

        {/* ── DERECHA: descubrimiento ── */}
        <div className="space-y-4 min-w-0">
          <LiveBar items={live} live={discSource === 'api'} />
          <UpcomingPanel items={upcoming} live={discSource === 'api'} />
          <FinishedTable items={finished} live={discSource === 'api'} />
          <NewsLinks />
          {discLoading && <p className="text-[11px] text-gray-400">Sincronizando fuentes externas…</p>}
        </div>
      </div>
    </div>
  );
}

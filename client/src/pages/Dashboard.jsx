import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import { CardSkeleton } from '../components/Skeleton.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../components/Toast.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import MyTournamentsList from '../components/Dashboard/MyTournamentsList.jsx';
import DemoTournamentsPanel from '../components/Dashboard/DemoTournamentsPanel.jsx';
import ActiveTournamentsFeed from '../components/Dashboard/ActiveTournamentsFeed.jsx';
import PastTournamentsFeed from '../components/Dashboard/PastTournamentsFeed.jsx';
import PendingTournamentsFeed from '../components/Dashboard/PendingTournamentsFeed.jsx';
import LiveBroadcastPanel from '../components/Dashboard/LiveBroadcastPanel.jsx';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  finished: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800',
  demo: 'bg-fide-100 text-fide-700 dark:bg-fide-900/50 dark:text-fide-300 border-fide-200 dark:border-fide-800',
};

export default function Dashboard() {
  const { t } = useI18n();
  const location = useLocation();
  const [myTournaments, setMyTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [membership, setMembership] = useState(null);
  const [tab, setTab] = useState('tournaments');
  const { toast } = useToast();

  const handleManageBilling = async () => {
    try {
      const result = await api.stripePortal({ return_url: window.location.origin + '/' });
      window.location.href = result.url;
    } catch (e) {
      toast.error(e.message || t('dashboard.billingError'));
    }
  };

  const [syncing, setSyncing] = useState(false);
  const handleSyncPlatform = async () => {
    setSyncing(true);
    try {
      const payload = { tournaments: myTournaments.slice(0, 5).map((t) => ({ id: t.id, name: t.name, status: t.status, n_rounds: t.n_rounds })) };
      try { await fetch('https://chessorganizers.com/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch {}
      toast.success(t('dashboard.syncSuccess'));
    } catch { toast.error(t('dashboard.syncError')); }
    finally { setSyncing(false); }
  };

  const fetchData = useCallback(() => {
    setLoading(true);
    const timeout = setTimeout(() => { setLoading(false); }, 5000);
    api.listTournaments().then((d) => setMyTournaments(d.tournaments)).catch(() => {}).finally(() => clearTimeout(timeout));
    api.myMembership().then((d) => setMembership(d.membership)).catch(() => {}).finally(() => { clearTimeout(timeout); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [location.key]);

  useEffect(() => {
    const onShow = (e) => { if (e.persisted) fetchData(); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await api.deleteTournament(id);
      setMyTournaments((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('dashboard.tournamentDeleted'));
    } catch (e) { toast.error(e.message); }
  };

  const handleOpenTournament = (tournament) => {
    if (tournament.source && tournament.source !== 'internal') {
      window.open(tournament.source_url || `/public/tournament/${tournament.id}`, '_blank');
    } else {
      window.location.href = `/app/tournament/${tournament.id}`;
    }
  };

  const handleSelectDemo = (demo) => {
    // Clonar torneo demo y redirigir a edición
    api.createTournament({
      name: demo.name.replace('🏆 ', '').replace('🌐 ', '').replace('🏟️ ', ''),
      system: demo.system,
      n_rounds: demo.n_rounds,
      start_date: demo.start_date,
      end_date: demo.end_date,
      city: demo.city,
      federation: demo.federation,
      time_control: demo.time_control,
      rated: demo.rated,
      chief_arbiter: demo.chief_arbiter,
      description: demo.description,
      status: 'pending',
      primary_color: demo.primary_color,
      secondary_color: demo.secondary_color,
    }).then((result) => {
      window.location.href = `/app/tournament/${result.id}`;
    }).catch((e) => toast.error(e.message));
  };

  if (loading) return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <div className="animate-pulse"><div className="h-8 w-48 bg-gray-200 dark:bg-fide-700 rounded-lg mb-2" /><div className="h-4 w-32 bg-gray-200 dark:bg-fide-700 rounded" /></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-6">
          <CardSkeleton className="h-64" />
          <CardSkeleton className="h-64" />
        </div>
        <div className="lg:col-span-7 space-y-6">
          <CardSkeleton className="h-72" />
          <CardSkeleton className="h-96" />
        </div>
      </div>
    </div>
  );

  const activeCount = myTournaments.filter((item) => item.status === 'active').length;
  const finishedCount = myTournaments.filter((item) => item.status === 'finished').length;
  const pendingCount = myTournaments.filter((item) => item.status === 'pending').length;

  return (
    <div className="animate-fadeIn">
      {/* Membership banner */}
      {membership && (
        <div className="mb-6 bg-gradient-to-r from-amber-900/30 to-fide-900/30 border border-amber-800/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-400">♛</span>
            <span className="text-fide-300">{t('dashboard.plan')}:</span>
            <span className="font-semibold text-amber-300">{membership.plan_name}</span>
            {membership.max_tournaments > 0 && (
              <span className="text-fide-400 ml-2">
                {membership.active_tournaments}/{membership.max_tournaments} {t('nav.tournaments').toLowerCase()}
              </span>
            )}
            {membership.current_period_end && (
              <span className="text-fide-400 text-xs ml-2">
                {membership.cancel_at_period_end ? 'Termina' : 'Renueva'} {new Date(membership.current_period_end).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {membership.stripe_subscription_id && (
              <button onClick={handleManageBilling} className="text-xs text-amber-400 hover:text-amber-300 underline shrink-0">
                {t('dashboard.billing')}
              </button>
            )}
            <Link to="/pricing" className="text-xs text-amber-400 hover:text-amber-300 underline shrink-0">{t('dashboard.changePlan')}</Link>
          </div>
        </div>
      )}

      {/* Pro header — 3 botones coloreados enlazados + Sync plataforma madre */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Link to="/catalog?status=active" title="En directo — torneos en juego" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold tracking-widest hover:bg-emerald-500 transition shadow-sm hover:shadow-md active:scale-95"><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {t('dashboard.live')} <span className="bg-white text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px]">{activeCount}</span></Link>
          <Link to="/catalog?status=pending" title="Próximos — torneos pendientes" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-bold tracking-widest hover:bg-amber-400 transition shadow-sm hover:shadow-md active:scale-95"><span className="w-2 h-2 rounded-full bg-black" /> {t('dashboard.upcoming')} <span className="bg-black text-amber-400 px-1.5 py-0.5 rounded-full text-[10px]">{pendingCount}</span></Link>
          <Link to="/catalog?status=finished" title="Historial — torneos finalizados" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-600 text-white text-xs font-bold tracking-widest hover:bg-sky-500 transition shadow-sm hover:shadow-md active:scale-95"><span className="w-2 h-2 rounded-full bg-white" /> {t('dashboard.history')} <span className="bg-white text-sky-700 px-1.5 py-0.5 rounded-full text-[10px]">{finishedCount}</span></Link>
        </div>
        <button onClick={handleSyncPlatform} disabled={syncing} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-bold border border-zinc-800 dark:border-zinc-200 hover:opacity-90 disabled:opacity-50">
          {syncing ? '…' : '⬆'} {t('dashboard.connectPlatform')}
        </button>
      </div>

      {/* CTA chessorganizers.com */}
      <a href="https://chessorganizers.com" target="_blank" rel="noopener noreferrer"
        className="block mb-6 bg-gradient-to-r from-amber-900/40 via-fide-800 to-amber-900/40 border border-amber-700/30 rounded-xl p-5 hover:border-amber-600/50 transition group">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition">♛ Chess Organizers Pro</h3>
            <p className="text-sm text-fide-400 mt-1">Organiza tu evento profesional de ajedrez — Torneos, Ligas, Matches y más</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-amber-700/20 px-4 py-2 rounded-lg text-amber-400 text-sm font-medium">
            <span>chessorganizers.com</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </div>
        </div>
      </a>

      {/* Nav tabs */}
      <div className="flex gap-1 border-b border-fide-700/50 mb-6">
        <button onClick={() => setTab('tournaments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'tournaments' ? 'border-amber-500 text-amber-400' : 'border-transparent text-fide-400 hover:text-fide-300'}`}>{t('dashboard.tabTournaments')}</button>
        <button onClick={() => setTab('notifications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'notifications' ? 'border-amber-500 text-amber-400' : 'border-transparent text-fide-400 hover:text-fide-300'}`}>{t('dashboard.notifications')}</button>
      </div>

      {tab === 'notifications' ? (
        <NotificationSettings />
      ) : (
        <>
          {/* Botón Nuevo — el header duplicado "Mis Torneos" se eliminó, queda solo en el card */}
          <div className="flex justify-end mb-4">
            <Link to="/app/new"
              className="inline-flex items-center gap-2 bg-fide-700 hover:bg-fide-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              {t('dashboard.newTournament')}
            </Link>
          </div>

          {/* LAYOUT DE DOS COLUMNAS */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* COLUMNA IZQUIERDA (5/12): MI HISTORIAL → DEMOS → ACTIVOS (efecto llamada) */}
            <div className="lg:col-span-5 space-y-6">
              {/* 1. Mis Torneos (MI HISTORIAL) */}
              <MyTournamentsList
                tournaments={myTournaments}
                onOpen={handleOpenTournament}
                emptyMessage={t('dashboard.noTournaments')}
              />

              {/* 2. Torneos Demo Preconfigurados (3 modalidades) */}
              <DemoTournamentsPanel onSelectDemo={handleSelectDemo} />

              {/* 3. 10 Torneos ACTIVOS — Efecto Llamada */}
              <ActiveTournamentsFeed
                title={`🔥 ${t('dashboard.activeFeedTitle')}`}
                subtitle={t('dashboard.activeFeedSubtitle')}
                linkTo="/catalog?status=active"
                linkText={t('dashboard.viewAllActive')}
                limit={10}
                onOpen={handleOpenTournament}
              />
            </div>

            {/* COLUMNA DERECHA (7/12): PENDIENTES (enlaces externos) → PASADOS */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-gradient-to-r from-fide-900/80 to-amber-900/80 border border-amber-700/30 rounded-3xl p-6 shadow-lg text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">{t('dashboard.scannerTitle')}</h2>
                    <p className="mt-2 text-sm text-gray-200 max-w-2xl">{t('dashboard.scannerSubtitle')}</p>
                  </div>
                  <div className="text-4xl">📸</div>
                </div>
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <Link to="/app/scan" className="inline-flex items-center justify-center rounded-xl bg-amber-400 text-fide-950 font-semibold px-5 py-3 text-sm transition hover:bg-amber-300">
                    {t('dashboard.scannerButton')}
                  </Link>
                  <span className="text-sm text-gray-200">{t('dashboard.scannerNote')}</span>
                </div>
              </div>
 
              {/* 0. LIVE — En Directo desde Lichess Broadcast */}
              <LiveBroadcastPanel />
 
              {/* 1. 10 Torneos PENDIENTES — Próximos eventos */}
              <PendingTournamentsFeed
                limit={10}
                onOpen={handleOpenTournament}
              />
 
              {/* 2. 10 Torneos PASADOS */}
              <PastTournamentsFeed
                title={`📜 ${t('dashboard.pastFeedTitle')}`}
                subtitle={t('dashboard.pastFeedSubtitle')}
                linkTo="/catalog?status=finished"
                linkText={t('dashboard.viewAllPast')}
                limit={10}
                onOpen={handleOpenTournament}
              />
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t('dashboard.deleteTitle')}
        message={t('dashboard.deleteConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={() => handleDelete(deleteTarget?.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
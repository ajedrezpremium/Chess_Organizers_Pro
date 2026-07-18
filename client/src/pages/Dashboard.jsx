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
  const [activeTournaments, setActiveTournaments] = useState([]);
  const [pastTournaments, setPastTournaments] = useState([]);
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

  const fetchData = useCallback(() => {
    setLoading(true);
    api.listTournaments().then((d) => setMyTournaments(d.tournaments)).catch(() => {});
    api.external.listTournaments({ status: 'active', limit: 20, sort: 'start_date', order: 'desc' })
      .then((d) => setActiveTournaments(d.tournaments)).catch(() => {});
    api.external.listTournaments({ status: 'finished', limit: 20, sort: 'start_date', order: 'desc' })
      .then((d) => setPastTournaments(d.tournaments)).catch(() => {});
    api.myMembership().then((d) => setMembership(d.membership)).catch(() => {}).finally(() => setLoading(false));
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
          {/* Header con contador y botón nuevo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t('dashboard.myTournaments')}</h1>
              <p className="text-sm text-gray-600 dark:text-fide-400 mt-1">
                {t('dashboard.tournamentsCount', { n: myTournaments.length })} &middot;
                {activeCount > 0 && <span className="text-emerald-700 dark:text-emerald-400 ml-1">{activeCount} {t('dashboard.active')}</span>}
                {pendingCount > 0 && <span className="text-amber-700 dark:text-amber-400 ml-1">{pendingCount} {t('dashboard.pending')}</span>}
                {finishedCount > 0 && <span className="text-blue-700 dark:text-blue-400 ml-1">{finishedCount} {t('dashboard.finished')}</span>}
              </p>
            </div>
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
                tournaments={activeTournaments}
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
              {/* 0. LIVE — En Directo desde Lichess Broadcast */}
              <LiveBroadcastPanel />

              {/* 1. 10 Torneos PENDIENTES — Próximos eventos */}
              <PendingTournamentsFeed
                limit={10}
                onOpen={handleOpenTournament}
              />

              {/* 2. 10 Torneos PASADOS */}
              <PastTournamentsFeed
                tournaments={pastTournaments}
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
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import { CardSkeleton } from '../components/Skeleton.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../components/Toast.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  finished: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800',
};

export default function Dashboard() {
  const { t } = useI18n();
  const [tournaments, setTournaments] = useState([]);
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

  useEffect(() => {
    api.listTournaments().then((d) => setTournaments(d.tournaments)).catch(() => {});
    api.myMembership().then((d) => setMembership(d.membership)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.deleteTournament(id);
      setTournaments((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('dashboard.tournamentDeleted'));
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div><SkeletonHeader /></div>
      </div>
      <div className="grid gap-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
    </div>
  );

  const activeCount = tournaments.filter((item) => item.status === 'active').length;
  const finishedCount = tournaments.filter((item) => item.status === 'finished').length;
  const pendingCount = tournaments.filter((item) => item.status === 'pending').length;

  return (
    <div className="animate-fadeIn">
      {membership && (
        <div className="mb-4 bg-gradient-to-r from-amber-900/30 to-fide-900/30 border border-amber-800/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-500">♛</span>
            <span className="text-gray-400">{t('dashboard.plan')}:</span>
            <span className="font-semibold text-amber-400">{membership.plan_name}</span>
            {membership.max_tournaments > 0 && (
              <span className="text-gray-600 ml-2">
                {membership.active_tournaments}/{membership.max_tournaments} {t('nav.tournaments').toLowerCase()}
              </span>
            )}
            {membership.current_period_end && (
              <span className="text-gray-600 text-xs ml-2">
                {membership.cancel_at_period_end ? 'Termina' : 'Renueva'} {new Date(membership.current_period_end).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {membership.stripe_subscription_id && (
              <button onClick={handleManageBilling} className="text-xs text-amber-500 hover:text-amber-400 underline shrink-0">
                {t('dashboard.billing')}
              </button>
            )}
            <Link to="/pricing" className="text-xs text-amber-500 hover:text-amber-400 underline shrink-0">{t('dashboard.changePlan')}</Link>
          </div>
        </div>
      )}

      {/* CTA chessorganizers.com */}
      <a href="https://chessorganizers.com" target="_blank" rel="noopener noreferrer"
        className="block bg-gradient-to-r from-amber-900/40 via-fide-800 to-amber-900/40 border border-amber-700/30 rounded-xl p-5 hover:border-amber-600/50 transition group">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t('dashboard.myTournaments')}</h1>
          <p className="text-sm text-gray-500 dark:text-fide-400 mt-1">
            {t('dashboard.tournamentsCount', { n: tournaments.length })} &middot;
            {activeCount > 0 && <span className="text-emerald-600 dark:text-emerald-400 ml-1">{activeCount} {t('dashboard.active')}</span>}
            {pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400 ml-1">{pendingCount} {t('dashboard.pending')}</span>}
          </p>
        </div>
        <Link to="/app/new"
          className="inline-flex items-center gap-2 bg-fide-700 hover:bg-fide-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          {t('dashboard.newTournament')}
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-7xl mb-6 opacity-30">♛</div>
          <p className="text-xl text-gray-400 dark:text-fide-400 mb-2">{t('dashboard.noTournaments')}</p>
          <p className="text-sm text-gray-400 dark:text-fide-500 mb-6">{t('dashboard.startPrompt')}</p>
          <Link to="/app/new"
            className="inline-flex items-center gap-2 bg-fide-700 hover:bg-fide-800 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            {t('dashboard.createFirst')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {tournaments.map((tournament) => (
            <div key={tournament.id}
              className="group bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700/50 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm hover:shadow-md transition-all duration-200 gap-4 hover:border-fide-300 dark:hover:border-fide-600">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <Link to={`/app/tournament/${tournament.id}`} className="font-semibold text-lg text-gray-900 dark:text-white hover:text-fide-600 dark:hover:text-fide-300 transition-colors truncate">
                    {tournament.name}
                  </Link>
                  <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[tournament.status] || 'bg-gray-100 text-gray-600'}`}>
                    {tournament.status === 'active' ? t('dashboard.statusActive') : tournament.status === 'finished' ? t('dashboard.statusFinished') : tournament.status === 'pending' ? t('dashboard.statusPending') : tournament.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-500 dark:text-fide-400">
                  <span>{tournament.system}</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {t('dashboard.round', { n: tournament.n_rounds })}
                  </span>
                  {tournament.federation && <span>{tournament.federation}</span>}
                  {tournament.created_at && <span className="text-xs text-gray-400">{new Date(tournament.created_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={`/app/tournament/${tournament.id}`}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-fide-50 text-fide-700 hover:bg-fide-100 dark:bg-fide-700 dark:text-fide-200 dark:hover:bg-fide-600 transition-all duration-200">
                  {t('common.open')}
                </Link>
                <button onClick={() => setDeleteTarget(tournament)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                  title={t('dashboard.deleteTitle')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal open={!!deleteTarget} title={t('dashboard.deleteTitle')} message={t('dashboard.deleteConfirm', { name: deleteTarget?.name })} confirmLabel={t('common.delete')} variant="danger" onConfirm={() => handleDelete(deleteTarget?.id)} onCancel={() => setDeleteTarget(null)} />
        </>
      )}
    </div>
  );
}

function SkeletonHeader() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-fide-700 rounded-lg mb-2" />
      <div className="h-4 w-32 bg-gray-200 dark:bg-fide-700 rounded" />
    </div>
  );
}
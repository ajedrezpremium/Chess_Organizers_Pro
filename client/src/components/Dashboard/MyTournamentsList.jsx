import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/context.jsx';
import TournamentCard from './TournamentCard.jsx';
import SectionHeader from './SectionHeader.jsx';
import { CardSkeleton } from '../Skeleton.jsx';

export default function MyTournamentsList({ tournaments: initialTournaments, onOpen, emptyMessage }) {
  const { t } = useI18n();
  const [tournaments, setTournaments] = useState(initialTournaments || []);
  const [loading, setLoading] = useState(initialTournaments === undefined);
  const [tab, setTab] = useState('all'); // all, active, pending, finished

  useEffect(() => {
    if (initialTournaments !== undefined) {
      setTournaments(initialTournaments);
      setLoading(false);
      return;
    }

    api.listTournaments()
      .then((d) => setTournaments(d.tournaments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialTournaments]);

  const filtered = tournaments.filter((t) => {
    if (tab === 'all') return true;
    if (tab === 'active') return t.status === 'active';
    if (tab === 'pending') return t.status === 'pending';
    if (tab === 'finished') return t.status === 'finished';
    return true;
  });

  const counts = {
    all: tournaments.length,
    active: tournaments.filter((t) => t.status === 'active').length,
    pending: tournaments.filter((t) => t.status === 'pending').length,
    finished: tournaments.filter((t) => t.status === 'finished').length,
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <SectionHeader
          title={t('dashboard.myTournaments')}
          subtitle={t('dashboard.tournamentsCount', { n: 0 })}
          icon="📋"
        />
        <div className="grid gap-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title={t('dashboard.myTournaments')}
          subtitle={t('dashboard.tournamentsCount', { n: counts.all })}
          count={counts.all}
          icon="📋"
        />
        <div className="text-center py-12">
          <div className="text-6xl mb-4 opacity-30">📋</div>
          <p className="text-xl text-gray-400 dark:text-fide-400 mb-2">{t('dashboard.noTournaments')}</p>
          <p className="text-sm text-gray-400 dark:text-fide-500 mb-6">{t('dashboard.startPrompt')}</p>
          <Link to="/app/new" className="inline-flex items-center gap-2 bg-fide-700 hover:bg-fide-800 text-white px-6 py-3 rounded-xl text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            {t('dashboard.createFirst')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('dashboard.myTournaments')}
        subtitle={t('dashboard.tournamentsCount', { n: counts.all })}
        count={counts.all}
        icon="📋"
      />

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-fide-700/50 mb-4">
        {[
          { id: 'all', label: 'Todos', count: counts.all },
          { id: 'active', label: t('dashboard.active'), count: counts.active },
          { id: 'pending', label: t('dashboard.pending'), count: counts.pending },
          { id: 'finished', label: t('dashboard.finished'), count: counts.finished },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-fide-400 hover:text-fide-300'
            }`}
          >
            {label} <span className="ml-1 text-xs opacity-70">({count})</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            variant="default"
            onClick={() => onOpen?.(tournament)}
          />
        ))}
      </div>
    </div>
  );
}
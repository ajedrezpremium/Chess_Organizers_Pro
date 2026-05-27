import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/context.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

export default function ArbiterTournamentsList() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.arbiter.listTournaments().then(setTournaments).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">⚖️ {t('arbiter.panel')}</h1>
          <span className="text-xs text-gray-400">{user?.name}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{t('arbiter.myTournaments')}</p>
      </header>

      <div className="p-4 space-y-2">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">⚖️</div>
            <p className="text-sm">{t('arbiter.noTournaments')}</p>
            <Link to="/" className="text-amber-500 text-xs hover:underline mt-2 inline-block">{t('arbiter.dashboard')}</Link>
          </div>
        ) : (
          tournaments.map((t) => (
            <Link key={t.id} to={`/arbiter/tournament/${t.id}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 block hover:border-gray-700 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-sm truncate">{t.name}</h2>
                  <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-500">
                    <span>{t.system}</span>
                    <span>{t('tournament.roundsCount', { n: t.n_rounds })}</span>
                    {t.federation && <span>{t.federation}</span>}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${t.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>{t.status === 'active' ? t('tournament.live') : t('tournament.finished')}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <OfflineIndicator />
    </div>
  );
}

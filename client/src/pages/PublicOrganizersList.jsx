import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';

export default function PublicOrganizersList() {
  const { t } = useI18n();
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.public.organizers().then(setOrganizers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4 text-xs">
          <Link to="/public" className="text-amber-500 hover:underline">♛ Torneos</Link>
          <span className="text-gray-300">Organizadores</span>
          <Link to="/public/players" className="text-gray-500 hover:text-gray-300">{t('nav.players')}</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">Organizadores</h1>
        <p className="text-gray-500 text-sm mb-6">Todos los organizadores de torneos en la plataforma</p>

        {loading ? (
          <div className="grid gap-3">
            {[1,2,3].map((i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-gray-800 rounded w-40 mb-2" />
                <div className="h-4 bg-gray-800 rounded w-56" />
              </div>
            ))}
          </div>
        ) : organizers.length === 0 ? (
          <div className="text-center py-16 text-gray-600"><p>Sin organizadores</p></div>
        ) : (
          <div className="grid gap-3">
            {organizers.map((o) => (
              <Link key={o.id} to={`/public/organizers/${o.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:bg-gray-800/50 transition block">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-900/50 flex items-center justify-center text-lg font-bold text-amber-400 shrink-0">
                    {o.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-white">{o.name}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5 text-sm text-gray-500">
                      {o.email && <span>{o.email}</span>}
                      {o.federation && <span>{o.federation}</span>}
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0 text-xs">
                    <div className="text-center"><div className="font-bold text-white">{o.tournament_count}</div><div className="text-gray-500">Torneos</div></div>
                    <div className="text-center"><div className="font-bold text-green-400">{o.active_count}</div><div className="text-gray-500">Activos</div></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

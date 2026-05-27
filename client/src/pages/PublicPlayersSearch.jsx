import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import LangSwitcher from '../components/LangSwitcher.jsx';

export default function PublicPlayersSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) { setQuery(q); search(q); }
  }, []);

  const search = async (q) => {
    if (!q || q.trim().length < 2) return;
    setLoading(true); setSearched(true);
    try {
      const data = await api.public.searchPlayers(q.trim());
      setPlayers(data.players); setTotal(data.total);
    } catch {} finally { setLoading(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    window.history.replaceState(null, '', `?q=${encodeURIComponent(query)}`);
    search(query);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/public" className="flex items-center gap-2 hover:opacity-80 transition">
            <span className="text-amber-500 text-xl">♛</span>
            <span className="font-bold text-white">{t('app.title')}</span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <LangSwitcher />
            <Link to="/public" className="text-gray-500 hover:text-gray-300 transition">{t('nav.tournaments')}</Link>
            <span className="text-gray-300">{t('nav.players')}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t('player.searchTitle')}</h1>
        <p className="text-gray-400 mb-6">{t('player.searchSubtitle')}</p>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t('player.searchPlaceholder')}
            className="flex-1 border border-gray-700 bg-gray-900 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-fide-500 focus:border-transparent" />
          <button type="submit" disabled={loading}
            className="bg-fide-700 hover:bg-fide-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition">
            {loading ? t('player.searching') : t('player.search')}
          </button>
        </form>

        {searched && !loading && (
          <div className="mb-4 text-sm text-gray-500">{t('player.results', { n: total })}</div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-48 mb-1" />
                <div className="h-3 bg-gray-800 rounded w-32" />
              </div>
            ))}
          </div>
        ) : players.length === 0 && searched ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-6xl mb-4">🔍</div>
            <p>{t('player.noResults')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <Link key={p.id} to={`/public/players/${p.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 hover:bg-gray-800/50 transition block">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">
                      {p.title && <span className="text-amber-400 mr-1">{p.title}</span>}
                      {p.name} {p.last_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 space-x-3">
                      {p.federation && <span>{p.federation}</span>}
                      {p.fide_id && <span>{t('player.fideId')}: {p.fide_id}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {p.fide_rating > 0 && <div className="text-lg font-bold text-amber-400">{p.fide_rating}</div>}
                    {p.fide_rating > 0 && <div className="text-xs text-gray-500">{t('player.rating')}</div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-gray-800 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-600">{t('app.footer')}</div>
      </footer>
    </div>
  );
}

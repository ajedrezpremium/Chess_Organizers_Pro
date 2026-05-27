import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import LangSwitcher from '../components/LangSwitcher.jsx';

const SYS_LABELS = { dutch: 'Suizo Holandés', roundrobin: 'Round Robin', burstein: 'Burstein', dubov: 'Dubov' };

export default function PublicTournamentsList() {
  const { t } = useI18n();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [federations, setFederations] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [filters, setFilters] = useState({ status: '', federation: '', system: '', search: '', from: '', to: '', sort: 'created_at' });

  useEffect(() => {
    api.public.federations().then(setFederations).catch(() => {});
    api.public.stats().then(setGlobalStats).catch(() => {});
  }, []);

  const load = async (f) => {
    setLoading(true);
    try {
      const params = { limit: 50, ...f };
      if (f.sort === 'player_count') { params.sort = 'player_count'; delete params.sort; }
      const data = await api.public.listTournaments(params);
      let list = data.tournaments;
      if (f.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
      if (f.sort === 'player_count') list.sort((a, b) => (b.player_count || 0) - (a.player_count || 0));
      setTournaments(list);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(filters); }, []);

  const handleFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    load(next);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/public" className="flex items-center gap-2 hover:opacity-80 transition">
            <span className="text-amber-500 text-xl">♛</span>
            <span className="font-bold text-white">{t('app.title')}</span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <LangSwitcher />
            <span className="text-gray-300">{t('nav.tournaments')}</span>
            <Link to="/public/players" className="text-gray-500 hover:text-gray-300 transition">{t('nav.players')}</Link>
            <Link to="/public/organizers" className="text-gray-500 hover:text-gray-300 transition">Organizadores</Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Global stats */}
        {globalStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Torneos', value: globalStats.total },
              { label: 'En vivo', value: globalStats.active },
              { label: 'Jugadores', value: globalStats.totalPlayers },
              { label: 'Organizadores', value: globalStats.totalOrganizers },
            ].map((s) => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-500">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <input placeholder="Buscar torneo..."
            value={filters.search} onChange={(e) => handleFilter('search', e.target.value)}
            className="w-40 border border-gray-700 bg-gray-900 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-600" />
          <select value={filters.status} onChange={(e) => handleFilter('status', e.target.value)}
            className="border border-gray-700 bg-gray-900 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">Todos</option>
            <option value="active">{t('nav.live')}</option>
            <option value="finished">{t('nav.finished')}</option>
          </select>
          <select value={filters.system} onChange={(e) => handleFilter('system', e.target.value)}
            className="border border-gray-700 bg-gray-900 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">Todos los sistemas</option>
            {Object.entries(SYS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filters.federation} onChange={(e) => handleFilter('federation', e.target.value)}
            className="border border-gray-700 bg-gray-900 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">Todas las federaciones</option>
            {federations.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
          </select>
          <select value={filters.sort} onChange={(e) => handleFilter('sort', e.target.value)}
            className="border border-gray-700 bg-gray-900 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500">
            <option value="created_at">Más recientes</option>
            <option value="name">Nombre</option>
            <option value="player_count">Más jugadores</option>
          </select>
          <input type="date" value={filters.from} onChange={(e) => handleFilter('from', e.target.value)}
            className="border border-gray-700 bg-gray-900 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500 [color-scheme:dark]" title="Desde" />
          <input type="date" value={filters.to} onChange={(e) => handleFilter('to', e.target.value)}
            className="border border-gray-700 bg-gray-900 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500 [color-scheme:dark]" title="Hasta" />
          <Link to="/public/players"
            className="border border-amber-700 text-amber-400 rounded-lg px-3 py-2 text-xs font-medium hover:bg-amber-900/30 transition">
            {t('nav.searchPlayer')}
          </Link>
        </div>

        {/* List */}
        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-gray-800 rounded w-48 mb-2" />
                <div className="h-4 bg-gray-800 rounded w-64" />
              </div>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-6xl mb-4">♟</div>
            <p className="text-lg">{t('tournament.noResults')}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {tournaments.map((t) => (
              <Link key={t.id} to={`/public/tournament/${t.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:bg-gray-800/50 transition block"
                style={t.primary_color ? { borderLeftColor: t.primary_color, borderLeftWidth: '3px' } : {}}>
                <div className="flex items-center gap-3">
                  {t.logo_url && <img src={t.logo_url} alt="" className="w-8 h-8 object-contain rounded shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold text-white text-lg truncate">{t.name}</h2>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'
                      }`}>{t.status === 'active' ? t('nav.live') : t('nav.finished')}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                      <span>{SYS_LABELS[t.system] || t.system}</span>
                      <span>{t('tournament.roundsCount', { n: t.n_rounds })}</span>
                      {t.federation && <span>{t.federation}</span>}
                      {t.city && <span>{t.city}</span>}
                      {t.player_count > 0 && <span>{t('tournament.playerCount', { n: t.player_count })}</span>}
                      {t.start_date && <span>{t.start_date}</span>}
                    </div>
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

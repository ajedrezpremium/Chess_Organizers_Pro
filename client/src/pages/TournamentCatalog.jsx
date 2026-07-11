import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import { CardSkeleton } from '../components/Skeleton.jsx';
import TournamentCard from '../components/Dashboard/TournamentCard.jsx';
import SectionHeader from '../components/Dashboard/SectionHeader.jsx';

const SOURCE_LABELS = {
  internal: 'Chess Organizers Pro',
  'chess-results': 'Chess-Results.com',
  info64: 'Info64.org',
  'fide-calendar': 'FIDE Calendar',
  ajedrezmadrid: 'Ajedrez Madrid',
};

const STATUS_LABELS = {
  active: 'Activos',
  finished: 'Finalizados',
  upcoming: 'Próximos',
  all: 'Todos',
};

const SYSTEM_LABELS = {
  dutch: 'Suizo (Holandés)',
  roundrobin: 'Round Robin',
  burstein: 'Burstein',
  dubov: 'Dubov',
  knockout: 'Eliminatorias',
};

export default function TournamentCatalogPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sources, setSources] = useState([]);

  // Leer parámetros de URL
  const status = searchParams.get('status') || 'all';
  const source = searchParams.get('source') || 'all';
  const federation = searchParams.get('federation') || '';
  const city = searchParams.get('city') || '';
  const system = searchParams.get('system') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'start_date';
  const order = searchParams.get('order') || 'desc';

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        status,
        source,
        federation,
        city,
        system,
        search,
        sort,
        order,
      };
      // Filtrar params vacíos
      Object.keys(params).forEach(k => params[k] === '' && delete params[k]);

      const data = await api.external.listTournaments(params);
      setTournaments(data.tournaments);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSources = async () => {
    try {
      const data = await api.external.getSources();
      setSources(data);
    } catch (err) {
      console.error('Error fetching sources:', err);
    }
  };

  useEffect(() => {
    fetchTournaments();
    fetchSources();
  }, [page, status, source, federation, city, system, search, sort, order]);

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
    setPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    handleFilterChange('search', e.target.elements.search.value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getSourceInfo = (srcId) => {
    return sources.find(s => s.id === srcId) || { name: srcId, icon: '🏆', color: 'gray' };
  };

  return (
    <div className="min-h-screen bg-white dark:bg-fide-900">
      {/* Header */}
      <header className="bg-white dark:bg-fide-900 border-b dark:border-fide-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold text-fide-600 dark:text-fide-300">♛ Chess Organizers</Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/catalog" className="text-sm font-medium text-fide-600 dark:text-fide-300 hover:text-fide-500">Catálogo</Link>
              <Link to="/public" className="text-sm font-medium text-fide-600 dark:text-fide-300 hover:text-fide-500">Torneos Públicos</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Título de página */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Catálogo Global de Torneos</h1>
          <p className="text-gray-500 dark:text-fide-400 mt-1">
            Busca torneos de Chess-Results, Info64, FIDE Calendar, Ajedrez Madrid y nuestra plataforma
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Búsqueda principal */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[250px] relative">
                <input
                  name="search"
                  type="text"
                  placeholder="Buscar por nombre, ciudad, federación..."
                  defaultValue={search}
                  className="w-full px-4 py-2 border dark:border-fide-700 rounded-lg bg-white dark:bg-fide-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-fide-500 focus:border-transparent"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-fide-700 hover:bg-fide-800 text-white rounded-lg font-medium transition">
                Buscar
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('search', '')}
                  className="px-4 py-2 border dark:border-fide-700 text-gray-600 dark:text-fide-300 rounded-lg hover:bg-gray-100 dark:hover:bg-fide-800 transition"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Filtros avanzados */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <select
                value={status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 border dark:border-fide-700 rounded-lg bg-white dark:bg-fide-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-fide-500"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="finished">Finalizados</option>
                <option value="upcoming">Próximos</option>
              </select>

              <select
                value={source}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                className="px-3 py-2 border dark:border-fide-700 rounded-lg bg-white dark:bg-fide-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-fide-500"
              >
                <option value="all">Todas las fuentes</option>
                <option value="internal">Chess Organizers Pro</option>
                <option value="chess-results">Chess-Results.com</option>
                <option value="info64">Info64.org</option>
                <option value="fide-calendar">FIDE Calendar</option>
                <option value="ajedrezmadrid">Ajedrez Madrid</option>
              </select>

              <select
                value={system}
                onChange={(e) => handleFilterChange('system', e.target.value)}
                className="px-3 py-2 border dark:border-fide-700 rounded-lg bg-white dark:bg-fide-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-fide-500"
              >
                <option value="">Todos los sistemas</option>
                <option value="dutch">Suizo (Holandés)</option>
                <option value="roundrobin">Round Robin</option>
                <option value="burstein">Burstein</option>
                <option value="dubov">Dubov</option>
                <option value="knockout">Eliminatorias</option>
              </select>

              <input
                type="text"
                placeholder="Federación (FIDE, FEDA, ECU...)"
                value={federation}
                onChange={(e) => handleFilterChange('federation', e.target.value)}
                className="px-3 py-2 border dark:border-fide-700 rounded-lg bg-white dark:bg-fide-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-fide-500"
              />

              <input
                type="text"
                placeholder="Ciudad"
                value={city}
                onChange={(e) => handleFilterChange('city', e.target.value)}
                className="px-3 py-2 border dark:border-fide-700 rounded-lg bg-white dark:bg-fide-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-fide-500"
              />

              <select
                value={sort}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
                className="px-3 py-2 border dark:border-fide-700 rounded-lg bg-white dark:bg-fide-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-fide-500"
              >
                <option value="start_date">Fecha inicio</option>
                <option value="name">Nombre</option>
                <option value="players">Jugadores</option>
                <option value="created_at">Creado</option>
              </select>
            </div>

            {/* Orden ASC/DESC */}
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-fide-400">
              <span>Orden:</span>
              <button
                onClick={() => handleFilterChange('order', order === 'asc' ? 'desc' : 'asc')}
                className={`px-3 py-1 rounded ${order === 'asc' ? 'bg-fide-700 text-white' : 'bg-gray-100 dark:bg-fide-800'}`}
              >
                {order === 'asc' ? '↑ Ascendente' : '↓ Descendente'}
              </button>
              <span className="text-xs">({total} torneos)</span>
            </div>
          </form>
        </div>

        {/* Resultados */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <CardSkeleton key={i} className="h-56" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 opacity-30">🏆</div>
            <h2 className="text-xl text-gray-400 dark:text-fide-400 mb-2">No se encontraron torneos</h2>
            <p className="text-gray-500 dark:text-fide-500">Intenta ajustar los filtros o busca con otros términos</p>
            <button
              onClick={() => setSearchParams({})}
              className="mt-4 px-4 py-2 bg-fide-700 hover:bg-fide-800 text-white rounded-lg transition"
            >
              Resetear filtros
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
              {tournaments.map((tournament) => {
                const sourceInfo = getSourceInfo(tournament.source);
                return (
                  <TournamentCard
                    key={tournament.id || tournament.external_id || tournament.source_id}
                    tournament={{
                      ...tournament,
                      source: sourceInfo.name,
                      source_url: tournament.source_url,
                    }}
                    variant="feed"
                    showSource
                  />
                );
              })}
            </div>

            {/* Paginación */}
            {total > 20 && (
              <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border dark:border-fide-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-fide-800 transition"
                >
                  Anterior
                </button>
                <span className="px-4 text-gray-600 dark:text-fide-300">
                  Página {page} de {Math.ceil(total / 20)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / 20), p + 1))}
                  disabled={page >= Math.ceil(total / 20)}
                  className="px-4 py-2 border dark:border-fide-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-fide-800 transition"
                >
                  Siguiente
                </button>
              </nav>
            )}
          </>
        )}

        {/* Footer con fuentes */}
        <div className="mt-12 pt-8 border-t dark:border-fide-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-fide-300 mb-4">Fuentes de datos</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {sources.map((src) => (
              <Link
                key={src.id}
                to={`/catalog?source=${src.id}`}
                className="p-4 bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl hover:border-fide-300 dark:hover:border-fide-600 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{src.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{src.name}</p>
                    <p className="text-xs text-gray-500 dark:text-fide-400">{src.description}</p>
                    {src.rateLimit && <p className="text-xs text-gray-400">{src.rateLimit}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
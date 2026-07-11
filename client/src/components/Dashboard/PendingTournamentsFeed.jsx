import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import TournamentCard from './TournamentCard.jsx';
import SectionHeader from './SectionHeader.jsx';

const EXTERNAL_SOURCES = [
  { name: 'Chess-Results', url: 'https://chess-results.com', icon: '♟' },
  { name: 'Info64', url: 'https://info64.org', icon: 'ℹ' },
  { name: 'FIDE Calendar', url: 'https://fide.com/calendar', icon: '📅' },
  { name: 'Ajedrez en Madrid', url: 'https://ajedrez.en.madrid', icon: '📍' },
];

export default function PendingTournamentsFeed({ limit = 10, onOpen }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.external.listTournaments({ status: 'pending', limit: limit * 2, sort: 'start_date', order: 'asc' })
      .then((d) => {
        const all = (d.tournaments || []).filter(t => t.status === 'pending');
        setTournaments(all.slice(0, limit));
      })
      .catch((e) => {
        console.error('Pending feed error:', e);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-3">
        <SectionHeader
          title="📋 Torneos Pendientes — Próximos"
          subtitle="10 próximos eventos — Regístrate ya"
          count={limit}
          linkTo="/catalog?status=pending"
          linkText="Ver todos los pendientes →"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <TournamentCard key={i} tournament={{}} variant="skeleton" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>Error cargando torneos pendientes: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="📋 Torneos Pendientes — Próximos"
        subtitle="10 próximos eventos — Inscríbete ahora"
        count={tournaments.length}
        icon="📋"
        linkTo="/catalog?status=pending"
        linkText="Ver todos los pendientes →"
      />

      {/* Enlaces rápidos a fuentes externas */}
      <div className="flex flex-wrap gap-2 mb-2">
        {EXTERNAL_SOURCES.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-fide-100 dark:bg-fide-800 text-fide-700 dark:text-fide-300 rounded-lg hover:bg-fide-200 dark:hover:bg-fide-700 transition border border-fide-200 dark:border-fide-700"
          >
            <span>{s.icon}</span> {s.name}
          </a>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tournaments.map((tournament) => (
          <TournamentCard
            key={tournament.id || tournament.source_id}
            tournament={tournament}
            variant="feed"
            isCompact
            showSource
            onClick={() => onOpen?.(tournament)}
          />
        ))}

        {tournaments.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="text-4xl mb-2 opacity-30">📋</div>
            <p className="text-gray-400 dark:text-fide-400">No hay torneos pendientes próximamente</p>
          </div>
        )}
      </div>
    </div>
  );
}

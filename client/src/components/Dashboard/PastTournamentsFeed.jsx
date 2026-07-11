import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import TournamentCard from './TournamentCard.jsx';
import SectionHeader from './SectionHeader.jsx';

export default function PastTournamentsFeed({ title, subtitle, linkTo, linkText, limit = 10, onOpen }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.external.listTournaments({ status: 'finished', limit: limit * 2, sort: 'end_date', order: 'desc' })
      .then((d) => {
        const all = (d.tournaments || []).filter(t => t.status === 'finished');
        setTournaments(all.slice(0, limit));
      })
      .catch((e) => {
        console.error('Past feed error:', e);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-3">
        <SectionHeader
          title={title || 'Torneos Finalizados — Histórico'}
          subtitle={subtitle || '10 torneos recientes con resultados'}
          count={limit}
          icon="📜"
          linkTo={linkTo || '/catalog?status=finished'}
          linkText={linkText || 'Ver todos los pasados →'}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <TournamentCard key={i} tournament={{}} variant="skeleton" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>Error cargando torneos pasados: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={title || 'Torneos Finalizados — Histórico'}
        subtitle={subtitle || '10 torneos recientes con resultados disponibles'}
        count={tournaments.length}
        icon="📜"
        linkTo={linkTo || '/catalog?status=finished'}
        linkText={linkText || 'Ver todos los pasados →'}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            <div className="text-4xl mb-2 opacity-30">🏁</div>
            <p className="text-gray-500 dark:text-fide-400">No hay torneos finalizados recientemente</p>
          </div>
        )}
      </div>
    </div>
  );
}
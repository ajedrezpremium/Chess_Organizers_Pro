import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';

const SYS_LABELS = { dutch: 'Suizo Holandés', roundrobin: 'Round Robin', burstein: 'Burstein', dubov: 'Dubov' };

export default function PublicOrganizerProfile() {
  const { id } = useParams();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.public.organizer(id).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
      <div className="text-center"><div className="text-4xl mb-3">👤</div><p>Organizador no encontrado</p></div>
    </div>
  );

  const { organizer, tournaments } = data;
  const active = tournaments.filter((t) => t.status === 'active').length;
  const finished = tournaments.filter((t) => t.status === 'finished').length;
  const totalPlayers = tournaments.reduce((sum, t) => sum + (t.player_count || 0), 0);

  return (
    <>
    <Helmet>
      <title>{organizer.name || 'Organizador'} — Chess Organizers Pro</title>
      <meta name="description" content={`Perfil de ${organizer.name || 'organizador'} — ${active} torneos activos, ${finished} finalizados, ${totalPlayers} jugadores.`} />
      <meta property="og:title" content={`${organizer.name || 'Organizador'} — Chess Organizers Pro`} />
      <meta property="og:description" content={`Organizador de torneos de ajedrez. ${tournaments.length} torneos organizados.`} />
      <meta property="og:type" content="profile" />
      <meta property="og:url" content={`https://chess-organizers-pro.vercel.app/public/organizers/${organizer.id}`} />
    </Helmet>
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4 text-xs">
          <Link to="/public" className="text-amber-500 hover:underline">♛ Torneos</Link>
          <Link to="/public/organizers" className="text-gray-500 hover:text-gray-300">Organizadores</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile header */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-900/50 flex items-center justify-center text-2xl font-bold text-amber-400 shrink-0">
              {organizer.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{organizer.name}</h1>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                {organizer.email && <span>{organizer.email}</span>}
                {organizer.federation && <span>{organizer.federation}</span>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="text-center bg-gray-800/50 rounded-lg py-3"><div className="text-xl font-bold text-amber-500">{tournaments.length}</div><div className="text-xs text-gray-500">Torneos</div></div>
            <div className="text-center bg-gray-800/50 rounded-lg py-3"><div className="text-xl font-bold text-green-400">{active}</div><div className="text-xs text-gray-500">Activos</div></div>
            <div className="text-center bg-gray-800/50 rounded-lg py-3"><div className="text-xl font-bold text-blue-400">{totalPlayers}</div><div className="text-xs text-gray-500">Jugadores</div></div>
          </div>
        </div>

        {/* Tournament list */}
        <h2 className="text-lg font-bold text-white mb-4">Torneos</h2>
        {tournaments.length === 0 ? (
          <div className="text-center py-12 text-gray-600"><p>Sin torneos</p></div>
        ) : (
          <div className="grid gap-3">
            {tournaments.map((t) => (
              <Link key={t.id} to={`/public/tournament/${t.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 hover:bg-gray-800/50 transition block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{t.name}</h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                      <span>{SYS_LABELS[t.system] || t.system}</span>
                      <span>{t.n_rounds} rondas</span>
                      {t.federation && <span>{t.federation}</span>}
                      {t.city && <span>{t.city}</span>}
                      {t.start_date && <span>{t.start_date}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">{t.player_count || 0} jug.</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'
                    }`}>{t.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

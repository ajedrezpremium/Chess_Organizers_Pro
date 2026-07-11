import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import LangSwitcher from '../components/LangSwitcher.jsx';

export default function PublicPlayerProfile() {
  const { t } = useI18n();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.public.playerTournaments(id).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-fide-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">{t('common.notFound') || 'Jugador no encontrado'}</div>
  );

  const { player, tournaments } = data;

  const fullName = `${player.title ? player.title + ' ' : ''}${player.name || ''} ${player.last_name || ''}`.trim();

  return (
    <>
    <Helmet>
      <title>{fullName || 'Jugador'} — Chess Organizers Pro</title>
      <meta name="description" content={`Perfil de ${fullName} — Rating FIDE: ${player.fide_rating || '—'} | Federación: ${player.federation || '—'} | ${tournaments?.length || 0} torneos jugados`} />
      <meta property="og:title" content={`${fullName} — Chess Organizers Pro`} />
      <meta property="og:description" content={`Jugador de ajedrez ${player.federation ? 'de ' + player.federation : ''} | Rating: ${player.fide_rating || '—'} | Título: ${player.title || '—'}`} />
      <meta property="og:type" content="profile" />
      <meta property="og:url" content={`https://chess-organizers-pro.vercel.app/public/players/${player.id}`} />
    </Helmet>
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
            <Link to="/public/players" className="text-gray-500 hover:text-gray-300 transition">{t('nav.players')}</Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                {player.title && <span className="text-amber-400 text-2xl">{player.title}</span>}
                {player.name} {player.last_name}
              </h1>
              <div className="flex gap-4 mt-2 text-sm text-gray-400">
                {player.federation && <span>{player.federation}</span>}
                {player.fide_id && <span>{t('player.fideId')}: {player.fide_id}</span>}
              </div>
            </div>
            {player.fide_rating > 0 && (
              <div className="text-right">
                <div className="text-4xl font-bold text-amber-400">{player.fide_rating}</div>
                <div className="text-xs text-gray-500">{t('player.elo')}</div>
              </div>
            )}
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-4">{t('player.history')}</h2>

        {tournaments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>{t('player.noHistory')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tournaments.map((t) => (
              <Link key={t.id} to={`/public/tournament/${t.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 hover:bg-gray-800/50 transition block">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{t.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 space-x-3">
                      <span>{t.system === 'dutch' ? 'Suizo' : t.system}</span>
                      <span>{t('tournament.roundsCount', { n: t.n_rounds })}</span>
                      {t.city && <span>{t.city}</span>}
                      <span>{t.start_date}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-amber-400">{t.current_points?.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">
                      {t.final_position ? `#${t.final_position}` : t('player.inProgress')}
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
    </>
  );
}

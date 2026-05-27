import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/context.jsx';

const RESULT_LABELS = { '1': '1-0', '0': '0-1', '=': '½-½', U: 'BYE', '-': '-' };

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTournament, setExpandedTournament] = useState(null);

  useEffect(() => {
    api.me().then(() => {
      return api.playerTournaments();
    }).then((data) => {
      setPlayerData(data);
    }).catch(() => {
      setPlayerData(null);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!playerData) return (
    <div className="text-center py-20">
      <div className="text-6xl mb-4 opacity-30">♟</div>
      <h2 className="text-xl font-bold text-white mb-2">{t('player.noProfile')}</h2>
      <p className="text-gray-400 text-sm mb-4">{t('player.associatedEmail', { email: user?.email })}</p>
      <p className="text-gray-500 text-xs">{t('player.askOrganizer')}</p>
    </div>
  );

  const { player, tournaments, stats } = playerData;

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-fide-800 border border-fide-700/50 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-fide-700 flex items-center justify-center text-2xl font-bold text-amber-400">
            {player.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{player.name} {player.last_name}</h1>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-fide-400">
              {player.fide_rating > 0 && <span>{t('player.elo')}: <strong className="text-white">{player.fide_rating}</strong></span>}
              {player.title && <span>{t('player.title')}: <strong className="text-amber-400">{player.title}</strong></span>}
              {player.federation && <span>{t('player.federation')}: <strong className="text-white">{player.federation}</strong></span>}
              {player.fide_id && <span>{t('player.fideId')}: <strong className="text-white">{player.fide_id}</strong></span>}
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t('player.tournaments'), value: stats.tournaments, color: 'text-blue-400' },
            { label: t('player.games'), value: stats.games, color: 'text-white' },
            { label: t('player.wins'), value: stats.wins, color: 'text-emerald-400' },
            { label: t('player.points'), value: stats.points.toFixed(1), color: 'text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="bg-fide-800/40 border border-fide-700/50 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-fide-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">{t('player.history')}</h2>
        {tournaments.length === 0 ? (
          <div className="text-center py-12 text-fide-500">
            <p>{t('player.noTournaments')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => {
              const isExpanded = expandedTournament === t.id;
              return (
                <div key={t.id} className="bg-fide-800 border border-fide-700/50 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedTournament(isExpanded ? null : t.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-fide-700/30 transition">
                    <div className="text-left">
                      <div className="font-medium text-white">{t.name}</div>
                      <div className="text-xs text-fide-500 mt-0.5">
                        {t.federation && <span>{t.federation} · </span>}
                        {t.system} · {t('tournament.roundsCount', { n: t.n_rounds })}
                        {t.finished_date && <span> · {new Date(t.finished_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-400">{t.player_score?.toFixed(1) || '-'}</div>
                        <div className="text-[10px] text-fide-500">/{t.n_rounds}</div>
                      </div>
                      <svg className={`w-4 h-4 text-fide-500 transition ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && t.rounds && (
                    <div className="border-t border-fide-700/50 px-5 py-3">
                      <div className="table-wrap">
                        <table className="w-full text-sm">
                          <thead className="text-fide-400 text-xs">
                            <tr>
                              <th className="text-left px-2 py-1 font-medium">{t('tournament.round')}</th>
                              <th className="text-left px-2 py-1 font-medium">{t('pairings.white')}</th>
                              <th className="text-center px-2 py-1 font-medium">{t('pairings.result')}</th>
                              <th className="text-left px-2 py-1 font-medium">{t('pairings.black')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-fide-700/30">
                            {t.rounds.map((r) => (
                              <tr key={r.round_number} className="text-fide-300">
                                <td className="px-2 py-2 text-fide-500">{r.round_number}</td>
                                <td className="px-2 py-2">{r.white_name}{r.white_rating ? ` (${r.white_rating})` : ''}</td>
                                <td className="px-2 py-2 text-center font-mono font-bold">{RESULT_LABELS[r.result] || r.result}</td>
                                <td className="px-2 py-2">{r.black_name}{r.black_rating ? ` (${r.black_rating})` : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

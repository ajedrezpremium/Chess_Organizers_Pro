import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';
import LiveStreamEmbed from '../components/LiveStreamEmbed.jsx';

export default function PublicTV() {
  const { id } = useParams();
  const { t } = useI18n();
  const [tournament, setTournament] = useState(null);
  const [standings, setStandings] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [mode, setMode] = useState('standings');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        api.public.getTournament(id),
        api.public.getRounds(id),
      ]);
      setTournament(t); setRounds(r);
    } catch {}
  }, [id]);

  const loadStandings = useCallback(async () => {
    try { setStandings(await api.public.getStandings(id)); } catch {}
  }, [id]);

  const loadPerformance = useCallback(async () => {
    try { setPerformance(await api.public.performance(id)); } catch {}
  }, [id]);

  useEffect(() => { load(); loadStandings(); loadPerformance(); }, [load, loadStandings, loadPerformance]);

  useEffect(() => {
    const BASE = (import.meta.env.VITE_API_URL ?? '').includes('onrender.com') ? '' : (import.meta.env.VITE_API_URL ?? '');
    const es = new EventSource(`${BASE}/public/tournaments/${id}/sse`);
    es.addEventListener('result:updated', () => { loadStandings(); loadPerformance(); });
    es.addEventListener('round:generated', () => load());
    es.addEventListener('round:closed', () => { loadStandings(); load(); loadPerformance(); });
    return () => es.close();
  }, [id, load, loadStandings, loadPerformance]);

  const cycleModes = ['standings', 'pairings', 'performance'];
  useEffect(() => {
    const timer = setInterval(() => {
      setMode((m) => {
        const idx = cycleModes.indexOf(m);
        const next = cycleModes[(idx + 1) % cycleModes.length];
        if (next === 'stream' && !tournament?.stream_url) return cycleModes[(idx + 2) % cycleModes.length];
        return next;
      });
      setPage(0);
    }, 15000);
    return () => clearInterval(timer);
  }, [tournament]);

  const allModes = ['standings', 'pairings', 'performance', ...(tournament?.stream_url ? ['stream'] : [])];

  if (!tournament) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="animate-spin h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  const pc = tournament.primary_color || '#f59e0b';
  const logoUrl = tournament.logo_url || '';
  const activeRound = rounds.filter((r) => r.status === 'generated' || r.status === 'published').pop();
  const closedRounds = rounds.filter((r) => r.status === 'closed');
  const perfRounds = performance && performance.length > 0 ? Math.max(0, ...performance.map((p) => (p.roundChanges || []).length)) : 0;

  return (
    <div className="h-screen text-white overflow-hidden flex flex-col" style={{ background: `linear-gradient(180deg, ${tournament.secondary_color || '#030712'} 0%, #030712 100%)` }}>
      <style>{`
        .tv-accent { color: ${pc}; }
        .tv-btn { background: ${pc}; color: #000; }
        .tv-btn:hover { filter: brightness(1.1); }
      `}</style>
      <div className="px-8 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-10 w-10 object-contain rounded" />
          ) : (
            <span className="text-3xl" style={{ color: pc }}>♛</span>
          )}
          <div>
            <div className="text-xl font-bold">{t('app.title')}</div>
            <div className="tv-accent text-sm">{tournament.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {t('tv.live')}
          </span>
          <span>{t('tournament.roundsCount', { n: tournament.n_rounds })}</span>
          <span>{tournament.system}</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {mode === 'stream' && tournament.stream_url && tournament.stream_platform && (
          <div className="flex-1 flex items-center justify-center px-8 py-4">
            <div className="w-full max-w-4xl">
              <div className="text-2xl font-bold tv-accent mb-4">{t('tv.stream')}</div>
              <LiveStreamEmbed platform={tournament.stream_platform} url={tournament.stream_url} tournamentId={id} compact={false} />
            </div>
          </div>
        )}
        {mode === 'standings' && standings && (
          <div className="flex-1 overflow-hidden flex flex-col px-8 py-4">
            <div className="text-2xl font-bold tv-accent mb-4 shrink-0">🏆 {t('tv.standings')}</div>
            <div className="flex-1 overflow-hidden">
              <table className="w-full text-left">
                <thead className="text-gray-500 text-sm uppercase tracking-wider">
                  <tr>
                    <th className="py-3 w-16">{t('tv.pos')}</th>
                    <th className="py-3">{t('standings.player')}</th>
                    <th className="py-3 text-center w-24">{t('standings.elo')}</th>
                    <th className="py-3 text-center w-20">{t('player.ratingChange')}</th>
                    <th className="py-3 text-center w-20">{t('standings.pts')}</th>
                    {standings.tiebreaks?.slice(0, 3).map((tb) => (
                      <th key={tb} className="py-3 text-center w-24 text-[10px]">{tb}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {standings.standings.slice(0, 15).map((s, i) => {
                    const rank = i + 1;
                    const isTop3 = rank <= 3;
                    const rc = s.ratingChange ?? 0;
                    return (
                      <tr key={s.id} className={`${isTop3 ? 'pub-bg' : ''} ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                        <td className={`py-3 text-2xl font-bold ${isTop3 ? 'tv-accent' : 'text-gray-500'}`}>
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                        </td>
                        <td className="py-3">
                          <span className="text-xl font-medium">{s.name} {s.lastName}</span>
                          {s.title && <span className="tv-accent text-sm ml-2 font-bold">{s.title}</span>}
                        </td>
                        <td className="py-3 text-center text-lg text-gray-400">{s.fideRating || '-'}</td>
                        <td className={`py-3 text-center text-lg font-medium ${rc > 0 ? 'text-green-400' : rc < 0 ? 'text-red-400' : 'text-gray-500'}`}>{rc > 0 ? '+' : ''}{rc}</td>
                        <td className="py-3 text-center text-3xl font-bold">{s.points}</td>
                        {s.tiebreakValues?.slice(0, 3).map((tv, j) => (
                          <td key={j} className="py-3 text-center text-lg text-gray-500">{typeof tv === 'number' ? tv.toFixed(2) : tv}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {mode === 'pairings' && (
          <div className="flex-1 overflow-hidden flex flex-col px-8 py-4">
            <div className="text-2xl font-bold tv-accent mb-4 shrink-0">
              {activeRound ? `♟ ${t('tournament.round')} ${activeRound.round_number}` : closedRounds.length > 0 ? `📋 ${t('tv.lastRound', { n: closedRounds[closedRounds.length - 1].round_number })}` : t('tv.waitingRounds')}
            </div>
            <div className="flex-1 overflow-hidden">
              {(activeRound || closedRounds[closedRounds.length - 1]) && (() => {
                const r = activeRound || closedRounds[closedRounds.length - 1];
                if (!r.pairings || r.pairings.length === 0) return <div className="text-center text-gray-500 text-xl py-20">{t('tv.noPairings')}</div>;
                return (
                  <table className="w-full text-left">
                    <thead className="text-gray-500 text-sm uppercase tracking-wider">
                      <tr><th className="py-3 w-16">{t('tv.board')}</th><th className="py-3">{t('tv.white')}</th><th className="py-3 text-center w-24">{t('tv.result')}</th><th className="py-3">{t('tv.black')}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {r.pairings.map((p) => (
                        <tr key={p.id} className="hover:bg-white/5">
                          <td className="py-3 text-2xl text-gray-500 font-bold">{p.board}</td>
                          <td className="py-3 text-xl">{p.white_name}{p.white_last ? ` ${p.white_last}` : ''}</td>
                          <td className={`py-3 text-center text-2xl font-bold ${p.result === '1' ? 'text-green-400' : p.result === '0' ? 'text-red-400' : p.result === '=' ? 'text-amber-400' : 'text-gray-600'}`}>{p.result === '-' ? 'vs' : p.result}</td>
                          <td className="py-3 text-xl">{p.is_bye ? <span className="text-gray-600 italic">{t('arbiter.bye')}</span> : `${p.black_name} ${p.black_last || ''}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )}

        {mode === 'performance' && performance && (
          <div className="flex-1 overflow-hidden flex flex-col px-8 py-4">
            <div className="text-2xl font-bold tv-accent mb-4 shrink-0">📊 Rendimiento</div>
            <div className="flex-1 overflow-hidden">
              <table className="w-full text-left">
                <thead className="text-gray-500 text-sm uppercase tracking-wider">
                  <tr>
                    <th className="py-3 w-16">#</th>
                    <th className="py-3">{t('standings.player')}</th>
                    <th className="py-3 text-center w-20">Elo</th>
                    <th className="py-3 text-center w-16">Pts</th>
                    <th className="py-3 text-center w-24">TPR</th>
                    {perfRounds > 0 && Array.from({ length: perfRounds }, (_, i) => (
                      <th key={`pr${i}`} className="py-3 text-center w-16 text-[10px]">R{i + 1}</th>
                    ))}
                    <th className="py-3 text-center w-20">ΔR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {performance
                    .sort((a, b) => b.points - a.points || (b.rating || 0) - (a.rating || 0))
                    .slice(0, 15).map((p, i) => {
                      const kf = p.kFactor || 20;
                      const tprDiff = p.tpr && p.rating ? p.tpr - p.rating : null;
                      return (
                        <tr key={p.id} className={`${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                          <td className="py-2 text-2xl font-bold text-gray-500">{i + 1}</td>
                          <td className="py-2">
                            <span className="text-xl font-medium">{p.name} {p.lastName || ''}</span>
                            {p.title && <span className="tv-accent text-sm ml-2 font-bold">{p.title}</span>}
                          </td>
                          <td className="py-2 text-center text-lg text-gray-400">{p.rating || '-'}</td>
                          <td className="py-2 text-center text-xl font-bold">{p.points}/{p.games}</td>
                          <td className={`py-2 text-center text-lg font-bold ${tprDiff !== null ? (tprDiff > 100 ? 'text-green-400' : tprDiff > 0 ? 'text-green-300' : tprDiff > -100 ? 'text-amber-300' : 'text-red-400') : 'text-gray-500'}`}>
                            {p.tpr !== null ? p.tpr : '-'}
                          </td>
                          {perfRounds > 0 && Array.from({ length: perfRounds }, (_, ri) => {
                            const d = (p.roundChanges || [])[ri];
                            if (d === undefined || d === null) return <td key={`rd${ri}`} className="py-2 text-center text-sm text-gray-600">-</td>;
                            const dv = Math.round(d * kf);
                            return <td key={`rd${ri}`} className={`py-2 text-center text-base font-medium ${dv > 0 ? 'text-green-400' : dv < 0 ? 'text-red-400' : 'text-gray-500'}`}>{dv > 0 ? '+' : ''}{dv}</td>;
                          })}
                          <td className={`py-2 text-center text-xl font-bold ${p.ratingChg > 0 ? 'text-green-400' : p.ratingChg < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {p.ratingChg !== null ? (p.ratingChg > 0 ? '+' : '') + p.ratingChg : '-'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="px-8 py-3 border-t border-gray-800 flex items-center justify-between text-sm text-gray-500 shrink-0">
        <span>{t('tv.autoCycle')}</span>
        <span className="flex items-center gap-4">
          <button onClick={() => { setMode('standings'); setPage(0); }} className={`px-3 py-1 rounded ${mode === 'standings' ? 'tv-btn' : 'text-gray-400 hover:text-white'}`}>{t('tv.standings')}</button>
          <button onClick={() => { setMode('pairings'); setPage(0); }} className={`px-3 py-1 rounded ${mode === 'pairings' ? 'tv-btn' : 'text-gray-400 hover:text-white'}`}>{t('tv.pairings')}</button>
          <button onClick={() => { setMode('performance'); setPage(0); }} className={`px-3 py-1 rounded ${mode === 'performance' ? 'tv-btn' : 'text-gray-400 hover:text-white'}`}>Rendimiento</button>
          {tournament.stream_url && tournament.stream_platform && (
            <button onClick={() => { setMode('stream'); setPage(0); }} className={`px-3 py-1 rounded ${mode === 'stream' ? 'tv-btn' : 'text-gray-400 hover:text-white'}`}>
              {t('tv.stream')}
            </button>
          )}
        </span>
        <span>{t('app.title')}</span>
      </div>
      <OfflineIndicator />
    </div>
  );
}

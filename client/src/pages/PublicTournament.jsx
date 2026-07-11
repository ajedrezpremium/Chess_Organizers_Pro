import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import QRCode from '../components/QRCode.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';
import LiveStreamEmbed from '../components/LiveStreamEmbed.jsx';

const RESULT_OPTIONS = ['-', '1', '0', '=', 'U', 'F', 'H', 'Z'];

export default function PublicTournament() {
  const { id } = useParams();
  const { t } = useI18n();
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [standings, setStandings] = useState(null);
  const [tab, setTab] = useState('standings');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [t, p, r] = await Promise.all([
        api.public.getTournament(id),
        api.public.getPlayers(id),
        api.public.getRounds(id),
      ]);
      setTournament(t); setPlayers(p); setRounds(r);
    } catch (e) { setError(e.message); }
  }, [id]);

  const loadStandings = useCallback(async () => {
    try { setStandings(await api.public.getStandings(id)); } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    loadStandings();
    const BASE = import.meta.env.VITE_API_URL ?? '';
    const es = new EventSource(`${BASE}/public/tournaments/${id}/sse`);
    es.addEventListener('result:updated', () => { loadStandings(); load(); });
    es.addEventListener('round:generated', () => { load(); });
    es.addEventListener('round:closed', () => { loadStandings(); load(); });
    es.onerror = () => {};
    return () => es.close();
  }, [id, load, loadStandings]);

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-6xl mb-4">♟</div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('tournament.notFound')}</h1>
        <p className="text-gray-400 mb-6">{error}</p>
        <Link to="/" className="text-amber-500 hover:underline">{t('nav.backToHome')}</Link>
      </div>
    </div>
  );

  if (!tournament) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  const activeRound = rounds.filter((r) => r.status === 'generated' || r.status === 'published').pop();
  const closedRoundsCount = rounds.filter((r) => r.status === 'closed').length;

  const pc = tournament.primary_color || '#f59e0b';
  const sc = tournament.secondary_color || '#1f2937';
  const logoUrl = tournament.logo_url || '';
  const bannerUrl = tournament.banner_url || '';

  return (
    <>
    <Helmet>
      <title>{tournament.name} — Chess Organizers Pro</title>
      <meta name="description" content={`${tournament.name} — ${tournament.city || ''} ${tournament.federation || ''} | Sistema: ${tournament.system} | ${tournament.n_rounds} rondas`} />
      <meta property="og:title" content={`${tournament.name} — Chess Organizers Pro`} />
      <meta property="og:description" content={`Torneo de ajedrez: ${tournament.city || ''} ${tournament.federation || ''} | ${tournament.system} | ${tournament.n_rounds} rondas`} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`https://chess-organizers-pro.vercel.app/public/tournament/${tournament.id}`} />
      {logoUrl && <meta property="og:image" content={logoUrl} />}
    </Helmet>
    <div className="min-h-screen text-gray-100" style={{ background: sc }}>
      <style>{`
        .pub-btn { background: ${pc}; color: #000; }
        .pub-btn:hover { filter: brightness(1.1); }
        .pub-accent { color: ${pc}; }
        .pub-border { border-color: ${pc}40; }
        .pub-bg { background: ${pc}15; }
        .pub-header { background: ${sc}; border-color: ${pc}30; }
        .pub-tab-active { color: ${pc}; border-color: ${pc}; }
      `}</style>
      <header className="sticky top-0 z-50 pub-header" style={{ borderBottom: `1px solid ${pc}30` }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/public" className="flex items-center gap-2 hover:opacity-80 transition">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-7 h-7 object-contain rounded" />
              ) : (
                <span className="text-lg" style={{ color: pc }}>♛</span>
              )}
              <span className="font-bold text-white text-sm hidden sm:inline">{t('app.title')}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <QRCode url={`${window.location.origin}/public/tournament/${id}`} />
            <Link to={`/public/tournament/${id}/tv`} title={t('tv.viewTV')}
              className="border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white px-2.5 py-1.5 rounded text-xs transition flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              {t('tv.tv')}
            </Link>
            <Link to={`/public/tournament/${id}/register`}
              className="pub-btn text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition">
              + {t('tournament.register')}
            </Link>
            <span className="text-xs text-gray-500 hidden sm:inline">
              {t('tournament.playerCountShort', { n: players.length })} &middot; {closedRoundsCount}/{tournament.n_rounds} {t('tournament.round').charAt(0)}
            </span>
          </div>
        </div>
      </header>

      {bannerUrl && (
        <div className="w-full max-w-6xl mx-auto px-4 mt-6">
          <div className="w-full h-32 sm:h-48 md:h-64 rounded-2xl overflow-hidden shadow-lg border border-gray-800">
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            {logoUrl && <img src={logoUrl} alt="" className="w-10 h-10 object-contain rounded" />}
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{tournament.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tournament.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>{tournament.status === 'active' ? t('tournament.live') : t('tournament.finished')}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
            <span>{tournament.system}</span>
            <span>{t('tournament.roundsCount', { n: tournament.n_rounds })}</span>
            {tournament.federation && <span>{tournament.federation}</span>}
            {tournament.city && <span>{tournament.city}</span>}
            {tournament.time_control && <span>{tournament.time_control}</span>}
          </div>
        </div>

        {activeRound && (
          <div className="rounded-xl p-4 mb-6" style={{ background: `${pc}15`, border: `1px solid ${pc}40` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: pc }} />
              <span className="font-medium text-sm" style={{ color: pc }}>{t('tournament.roundX', { n: activeRound.round_number })}</span>
            </div>
            <p className="text-gray-400 text-xs">{t('tournament.liveResults')}</p>
          </div>
        )}

        {tournament.stream_url && tournament.stream_platform && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-300">{t('tv.live')}</span>
            </div>
            <LiveStreamEmbed platform={tournament.stream_platform} url={tournament.stream_url} tournamentId={id} />
          </div>
        )}

        <div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
          {[
            { key: 'standings', label: t('tournament.standings') },
            { key: 'players', label: `${t('tournament.players')} (${players.length})` },
            { key: 'rounds', label: `${t('tournament.rounds')} (${rounds.length})` },
            { key: 'wall', label: t('tv.wall') },
            { key: 'crosstab', label: t('tv.crosstab') },
            { key: 'h2h', label: t('tv.h2h') },
            { key: 'info', label: t('tournament.info') },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t.key ? 'pub-tab-active' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t.label}</button>
          ))}
        </div>

        {tab === 'standings' && <PublicStandings standings={standings} tournament={tournament} onFilter={async (cat) => { try { setStandings(await api.public.getStandings(id, cat ? { category: cat } : {})); } catch {} }} />}
        {tab === 'players' && <PublicPlayers players={players} />}
        {tab === 'rounds' && <PublicRounds rounds={rounds} />}
        {tab === 'wall' && <PublicBoardWall tournamentId={id} rounds={rounds} pc={pc} />}
        {tab === 'crosstab' && <PublicCrosstab tournamentId={id} players={players} pc={pc} />}
        {tab === 'h2h' && <PublicHeadToHead tournamentId={id} players={players} pc={pc} />}
        {tab === 'info' && <PublicInfo tournament={tournament} />}
      </div>

      <footer className="border-t border-gray-800 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-600">
          {logoUrl && <img src={logoUrl} alt="" className="h-5 mx-auto mb-1 opacity-50" />}
          {tournament.name} &middot; {t('app.tagline')}
        </div>
      </footer>
      <OfflineIndicator />
    </div>
    </>
  );
}

function PublicStandings({ standings, tournament, onFilter }) {
  const { t } = useI18n();
  const [catFilter, setCatFilter] = useState('');
  const cats = tournament?.categories || [];

  useEffect(() => {
    if (onFilter) onFilter(catFilter);
  }, [catFilter]);

  if (!standings) return (
    <div className="text-center py-12 text-gray-500">
      <p>{t('tournament.loadingStandings')}</p>
    </div>
  );

  if (standings.standings.length === 0) return (
    <div className="text-center py-12 text-gray-500">
      <p>{t('tournament.noStandings')}</p>
    </div>
  );

  return (
    <div>
      {cats.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setCatFilter('')}
            className={`text-xs px-3 py-1 rounded-full border transition ${!catFilter ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-gray-700 text-gray-400 hover:text-white'}`}>{t('common.all')}</button>
          {cats.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`text-xs px-3 py-1 rounded-full border transition ${catFilter === c ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-gray-700 text-gray-400 hover:text-white'}`}>{c}</button>
          ))}
        </div>
      )}
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-10">{t('standings.pos')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('standings.player')}</th>
              {cats.length > 0 && <th className="text-left px-4 py-3 font-medium text-xs">{t('player.cat')}</th>}
              <th className="text-center px-4 py-3 font-medium">{t('standings.elo')}</th>
              <th className="text-center px-4 py-3 font-medium">{t('player.ratingChange')}</th>
              <th className="text-center px-4 py-3 font-medium w-16">{t('standings.pts')}</th>
              {standings.tiebreaks?.map((tb) => (
                <th key={tb} className="text-center px-3 py-3 font-medium text-xs hidden sm:table-cell">{tb}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {standings.standings.map((s) => {
              const medal = s.position === 1 ? '🥇' : s.position === 2 ? '🥈' : s.position === 3 ? '🥉' : null;
              const rc = s.ratingChange ?? 0;
              return (
                <tr key={s.id} className={`hover:bg-gray-800/50 pub-bg`}>
                  <td className={`px-4 py-3 font-bold ${s.position <= 3 ? 'pub-accent' : 'text-gray-500'}`}>
                    {medal || s.position}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{s.name} {s.lastName}</span>
                    {s.title && <span className="pub-accent text-xs ml-1 font-bold">{s.title}</span>}
                  </td>
                  {cats.length > 0 && <td className="px-4 py-3 text-xs text-gray-500">{s.category || '-'}</td>}
                  <td className="px-4 py-3 text-center text-gray-400">{s.fideRating || '-'}</td>
                  <td className={`px-4 py-3 text-center font-mono text-sm font-medium ${rc > 0 ? 'text-green-400' : rc < 0 ? 'text-red-400' : 'text-gray-500'}`}>{rc > 0 ? '+' : ''}{rc}</td>
                  <td className="px-4 py-3 text-center font-bold text-lg text-white">{s.points}</td>
                  {s.tiebreakValues?.map((tv, i) => (
                    <td key={i} className="px-3 py-3 text-center font-mono text-gray-500 text-xs hidden sm:table-cell">
                      {typeof tv === 'number' ? tv.toFixed(2) : tv}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {standings.standings.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>{t('tournament.noStandings')}</p>
        </div>
      )}
    </div>
    </div>
  );
}

function PublicPlayers({ players }) {
  const { t } = useI18n();
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-10">{t('standings.pos')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('standings.player')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('player.title')}</th>
              <th className="text-center px-4 py-3 font-medium">{t('standings.elo')}</th>
              <th className="text-center px-4 py-3 font-medium">{t('player.federation')}</th>
              <th className="text-center px-4 py-3 font-medium">{t('player.cat')}</th>
              <th className="text-center px-4 py-3 font-medium">{t('standings.pts')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {players.map((p, i) => (
              <tr key={i} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-500">{p.seed_rank}</td>
                <td className="px-4 py-3 font-medium text-white">{p.name} {p.last_name}</td>
                <td className="px-4 py-3 text-gray-400">{p.title || '-'}</td>
                <td className="px-4 py-3 text-center text-gray-400">{p.fide_rating || '-'}</td>
                <td className="px-4 py-3 text-center text-gray-400">{p.federation || '-'}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">{p.category || '-'}</td>
                <td className="px-4 py-3 text-center font-mono font-bold text-white">{p.current_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PublicRounds({ rounds }) {
  const { t } = useI18n();
  const [openRound, setOpenRound] = useState(rounds.length > 0 ? rounds.length - 1 : null);

  if (rounds.length === 0) return (
    <div className="text-center py-12 text-gray-500">
      <p>{t('tournament.noRounds')}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {rounds.map((round, idx) => (
        <div key={round.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <button onClick={() => setOpenRound(openRound === idx ? null : idx)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-white">{t('tournament.round')} {round.round_number}</span>
              {round.scheduled_at && (
                <span className="text-[10px] text-gray-500 hidden sm:inline">
                  {new Date(round.scheduled_at).toLocaleDateString()}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${round.status === 'closed' ? 'bg-blue-900 text-blue-300' : 'bg-yellow-900 text-yellow-300'}`}>{round.status}</span>
            </div>
            <svg className={`w-4 h-4 text-gray-500 transition ${openRound === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openRound === idx && (
            <div className="border-t border-gray-800 px-4 py-3">
              {(!round.pairings || round.pairings.length === 0) ? (
                <p className="text-sm text-gray-500 text-center py-4">{t('pairings.noPairings')}</p>
              ) : (
                <div className="table-wrap">
                  <table className="w-full text-sm">
                    <thead className="text-gray-500">
                      <tr><th className="text-left px-2 py-1 font-medium">{t('pairings.board')}</th><th className="text-left px-2 py-1 font-medium">{t('pairings.white')}</th><th className="text-center px-2 py-1 font-medium">{t('pairings.result')}</th><th className="text-left px-2 py-1 font-medium">{t('pairings.black')}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {round.pairings.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-800/30">
                          <td className="px-2 py-2 text-gray-500">{p.board}</td>
                          <td className="px-2 py-2 font-medium text-white whitespace-nowrap">{p.white_name}{p.white_last ? ` ${p.white_last}` : ''} {p.white_rating ? <span className="text-gray-500 font-normal">({p.white_rating})</span> : ''}</td>
                          <td className={`px-2 py-2 text-center font-mono font-bold ${p.result === '1' ? 'text-green-400' : p.result === '0' ? 'text-red-400' : p.result === '=' ? 'text-amber-400' : 'text-gray-600'}`}>{p.result}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {p.is_bye ? <span className="text-gray-600 italic">{t('arbiter.bye')}</span> : <span className="font-medium text-white">{p.black_name}{p.black_last ? ` ${p.black_last}` : ''} {p.black_rating ? <span className="text-gray-500 font-normal">({p.black_rating})</span> : ''}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PublicInfo({ tournament }) {
  const { t } = useI18n();
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {[
          [t('tournament.system'), tournament.system],
          [t('tournament.rounds'), tournament.n_rounds],
          [t('tournament.federation'), tournament.federation || '-'],
          [t('tournament.city'), tournament.city || '-'],
          [t('tournament.timeControl'), tournament.time_control || '-'],
          [t('tournament.status'), tournament.status === 'active' ? t('tournament.live') : t('tournament.finished')],
          [t('tournament.players'), tournament.player_count],
          [t('tournament.created'), tournament.created_at?.slice(0, 10)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-medium text-white capitalize">{value}</dd>
          </div>
        ))}
        {tournament.description && (
          <div className="sm:col-span-2">
            <dt className="text-gray-500">{t('tournament.description')}</dt>
            <dd className="font-medium text-white">{tournament.description}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function PublicBoardWall({ tournamentId, rounds, pc }) {
  const { t } = useI18n();
  const [roundIdx, setRoundIdx] = useState(null);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');

  useEffect(() => {
    if (rounds.length > 0 && roundIdx === null) {
      const lastOpen = rounds.reduce((acc, r, i) => (r.status === 'generated' || r.status === 'published') ? i : acc, null);
      setRoundIdx(lastOpen ?? rounds.length - 1);
    }
  }, [rounds, roundIdx]);

  if (rounds.length === 0) return (
    <div className="text-center py-12 text-gray-500">
      <p className="text-4xl mb-3">🏗️</p>
      <p>{t('tournament.noRounds')}</p>
    </div>
  );

  const round = rounds[roundIdx ?? 0];
  const isOpen = round?.status === 'generated' || round?.status === 'published';
  const pairings = round?.pairings || [];

  const filtered = pairings.filter((p) => {
    if (resultFilter === '1' && p.result !== '1') return false;
    if (resultFilter === '0' && p.result !== '0') return false;
    if (resultFilter === '=' && p.result !== '=') return false;
    if (resultFilter === '-' && p.result !== '-') return false;
    if (search) {
      const q = search.toLowerCase();
      const w = `${p.white_name || ''} ${p.white_last || ''}`.toLowerCase();
      const b = `${p.black_name || ''} ${p.black_last || ''}`.toLowerCase();
      if (!w.includes(q) && !b.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {rounds.map((r, i) => (
          <button key={r.id} onClick={() => setRoundIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${roundIdx === i ? 'pub-btn text-black' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}>
            {r.scheduled_at && <span className="text-[9px] text-gray-600 mr-1">{new Date(r.scheduled_at).toLocaleDateString()}</span>}
            R{r.round_number}
            <span className={`ml-1.5 w-1.5 h-1.5 inline-block rounded-full ${r.status === 'closed' ? 'bg-blue-500' : r.status === 'generated' || r.status === 'published' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('pairings.searchPlayer')}
          className="flex-1 min-w-[160px] border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-600" />
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}
          className="border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-xs text-white outline-none">
          <option value="all">{t('pairings.allResults')}</option>
          <option value="-">{t('pairings.noResult')}</option>
          <option value="1">{t('pairings.whiteWins')}</option>
          <option value="0">{t('pairings.blackWins')}</option>
          <option value="=">{t('pairings.draw')}</option>
        </select>
        <span className="text-xs text-gray-500 self-center">{t('pairings.boards', { n: filtered.length })}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>{t('pairings.noBoards')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{t('pairings.board')} {p.board}</span>
                {isOpen && p.result === '-' && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: pc }} />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: `${pc}25`, color: pc }}>{t('pairings.white').charAt(0)}</span>
                  <span className="font-medium text-sm text-white truncate">{p.white_name}{p.white_last ? ` ${p.white_last}` : ''}</span>
                  {p.white_rating > 0 && <span className="text-[10px] text-gray-500 ml-auto">({p.white_rating})</span>}
                </div>
                <div className="flex items-center justify-center py-1">
                  <span className={`font-mono font-bold text-base px-3 py-1 rounded ${p.result === '1' ? 'bg-green-900 text-green-300' : p.result === '0' ? 'bg-red-900 text-red-300' : p.result === '=' ? 'bg-amber-900 text-amber-300' : 'text-gray-500 bg-gray-800'}`}>
                    {p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : p.result === '-' ? 'vs' : p.result}
                  </span>
                </div>
                {p.black_id ? (
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-700 text-gray-300 text-[10px] font-bold flex items-center justify-center shrink-0">{t('pairings.black').charAt(0)}</span>
                    <span className="font-medium text-sm text-white truncate">{p.black_name}{p.black_last ? ` ${p.black_last}` : ''}</span>
                    {p.black_rating > 0 && <span className="text-[10px] text-gray-500 ml-auto">({p.black_rating})</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-600 italic text-sm">
                    <span className="w-5 h-5 rounded-full bg-gray-800 text-[10px] font-bold flex items-center justify-center">-</span>
                    {t('arbiter.bye')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicCrosstab({ tournamentId, players, pc }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await api.public.crosstab(tournamentId)); } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tournamentId]);

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">{t('tv.loadingCrosstab')}</div>;
  if (!data) return <div className="text-center py-12 text-gray-500">{t('tv.noData')}</div>;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="table-wrap">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-400">
              <th className="px-2 py-3 text-left w-8">{t('standings.pos')}</th>
              <th className="px-2 py-3 text-left min-w-[140px]">{t('standings.player')}</th>
              <th className="px-2 py-3 text-center w-10">{t('standings.pts')}</th>
              {Array.from({ length: data.nRounds }).map((_, i) => (
                <th key={i} className="px-2 py-3 text-center w-14">R{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.players.map((p, i) => (
              <tr key={p.id} className={`${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/20'} hover:bg-gray-800/50 transition-colors`}>
                <td className="px-2 py-1.5 text-gray-500 font-bold">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <span className="font-medium text-white">{p.name} {p.lastName}</span>
                  {p.title && <span className="pub-accent text-xs ml-1 font-bold">{p.title}</span>}
                  {p.rating > 0 && <span className="text-gray-500 text-xs ml-1">({p.rating})</span>}
                </td>
                <td className="px-2 py-1.5 text-center font-bold font-mono text-white">{p.points.toFixed(1)}</td>
                {p.rounds.map((r, ri) => (
                  <td key={ri} className={`px-2 py-1.5 text-center ${r.isBye ? 'text-gray-600 italic' : r.result === '1' ? 'text-green-400 font-bold' : r.result === '0' ? 'text-red-400 font-bold' : r.result === '=' ? 'text-amber-400 font-bold' : 'text-gray-600'}`}>
                    {r.isBye ? 'B' : r.opponent ? (
                      <span className="flex items-center justify-center gap-0.5">
                        <span>{r.result}</span>
                        <span className={`text-[10px] font-bold ${r.color === 'W' ? 'pub-accent' : 'text-gray-500'}`}>{r.color}</span>
                      </span>
                    ) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PublicHeadToHead({ tournamentId, players, pc }) {
  const { t } = useI18n();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [h2h, setH2h] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!p1 || !p2 || p1 === p2) return;
    setLoading(true);
    try { setH2h(await api.public.headToHead(tournamentId, p1, p2)); } catch {} finally { setLoading(false); }
  };

  useEffect(() => { if (p1 && p2) search(); }, [p1, p2]);

  return (
    <div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-white mb-3">{t('pairings.selectPlayers')}</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">{t('player.player1')}</label>
            <select value={p1} onChange={(e) => { setP1(e.target.value); setH2h(null); }}
              className="border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500 min-w-[180px]">
              <option value="">{t('common.select')}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.last_name} ({p.fide_rating || '-'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">{t('player.player2')}</label>
            <select value={p2} onChange={(e) => { setP2(e.target.value); setH2h(null); }}
              className="border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500 min-w-[180px]">
              <option value="">{t('common.select')}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.last_name} ({p.fide_rating || '-'})</option>
              ))}
            </select>
          </div>
          <button onClick={search} disabled={!p1 || !p2 || p1 === p2}
            className="pub-btn text-black text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50">{t('common.search')}</button>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-500 animate-pulse">{t('tournament.searchingEncounters')}</div>}

      {h2h && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {h2h.encounters.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-1">♟</p>
              <p>{t('tournament.noDirectEncounters')}</p>
            </div>
          ) : (
            <div>
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                <span className="text-sm font-medium text-white">
                  {h2h.player1.name} {h2h.player1.last_name} vs {h2h.player2.name} {h2h.player2.last_name}
                </span>
                <span className="text-xs text-gray-500 ml-3">{t('tournament.encounters', { n: h2h.encounters.length })}</span>
              </div>
              <div className="table-wrap">
                <table className="w-full text-sm">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">{t('tournament.round')}</th>
                      <th className="text-left px-4 py-2 font-medium">{t('tournament.board')}</th>
                      <th className="text-center px-4 py-2 font-medium">{t('pairings.result')}</th>
                      <th className="text-center px-4 py-2 font-medium">{t('tournament.color', { name: h2h.player1.name?.split(' ')[0] })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {h2h.encounters.map((e, i) => (
                      <tr key={i} className="hover:bg-gray-800/30">
                        <td className="px-4 py-3 text-white font-medium">{t('tournament.round')} {e.round}</td>
                        <td className="px-4 py-3 text-gray-400">{t('tournament.board')} {e.board}</td>
                        <td className={`px-4 py-3 text-center font-mono font-bold text-lg ${e.result === '1' ? 'text-green-400' : e.result === '0' ? 'text-red-400' : e.result === '=' ? 'text-amber-400' : 'text-gray-600'}`}>{e.result === '-' ? 'vs' : e.result}</td>
                        <td className={`px-4 py-3 text-center font-bold ${e.p1Color === 'W' ? 'pub-accent' : 'text-gray-500'}`}>{e.p1Color === 'W' ? t('pairings.colorWhite') : t('pairings.colorBlack')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/context.jsx';
import { api } from '../api/client.js';

// Centro de Control Arbitral — P1 imprescindible + P2 diferenciación
// Filosofía: SEE → DECIDE → ACT → RECORD — Responde en 5s a las 7 preguntas

function Kpi({ label, value, sub, color = 'zinc', onClick }) {
  const colors = {
    zinc: 'bg-white dark:bg-fide-800 border-gray-200 dark:border-fide-700',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    sky: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  };
  const clickable = onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition' : '';
  const content = (
    <>
      <p className="text-[10px] font-bold tracking-widest opacity-60 uppercase">{label}</p>
      <p className="text-lg font-black mt-1">{value}</p>
      {sub && <p className="text-[11px] opacity-60">{sub}</p>}
    </>
  );
  return onClick ? (
    <button onClick={onClick} className={`rounded-xl border p-3 text-left w-full ${colors[color]} ${clickable}`}>
      {content}
    </button>
  ) : (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      {content}
    </div>
  );
}

export default function ArbiterControlCenter({ tournament, rounds = [], players = [], onSelectTournament }) {
  const { t } = useI18n();
  const [activeRound, setActiveRound] = useState(0);
  const [search, setSearch] = useState('');
  const [alertFilter, setAlertFilter] = useState('all');
  const [incidentsDb, setIncidentsDb] = useState(null); // null = not loaded yet

  useEffect(() => {
    if (!tournament?.id) return;
    setIncidentsDb(null);
    api.incidents.list(tournament.id).then((d) => setIncidentsDb(d.incidents || [])).catch(() => setIncidentsDb([]));
  }, [tournament?.id]);

  const round = rounds[activeRound];
  const totalPlayers = players.length;
  const totalTables = Math.ceil(totalPlayers / 2);
  const pairings = round?.pairings || [];
  const activeGames = pairings.filter((p) => !p.result || p.result === '-' || p.result === '').length;
  const finishedGames = pairings.length - activeGames;
  const pending = activeGames;
  const incidents = useMemo(() => {
    // Real incidents from Supabase if loaded; fallback to derived mock
    if (incidentsDb !== null) {
      const levelFromPriority = (p) => p === 'critical' || p === 'high' ? 'critical' : p === 'medium' ? 'attention' : 'info';
      const real = incidentsDb.map((inc) => ({
        id: inc.id,
        level: levelFromPriority(inc.priority),
        title: inc.title || t('cc.dbTitle', { b: inc.board || '—', x: inc.type }),
        desc: inc.description || t('cc.stateOf', { s: inc.status }),
        action: inc.status === 'open' ? t('cc.view') : inc.status,
        raw: inc,
      }));
      // Añadir alertas derivadas reales (bloqueo, bye) si no están en DB
      const derived = [];
      pairings.forEach((p) => {
        if (!p.black_id) derived.push({ id: `bye-${p.board}`, level: 'info', title: t('cc.byeTitle', { b: p.board }), desc: t('cc.byeRest', { name: p.white_name || '—' }), action: '—' });
      });
      if (pending > 5) derived.push({ id: 'pending-block', level: 'critical', title: t('cc.blockTitle', { n: pending }), desc: t('cc.blockDesc'), action: t('cc.review') });
      if (pairings.some((p) => !p.result || p.result === '' )) derived.push({ id: 'clock', level: 'attention', title: t('cc.clockTitle', { b: pairings[0]?.board || 1 }), desc: t('cc.clockDesc'), action: t('cc.attend') });
      if (round?.status === 'closed') derived.push({ id: 'round-done', level: 'info', title: t('cc.doneTitle'), desc: t('cc.doneDesc'), action: t('cc.publishW') });
      return [...real, ...derived];
    }
    // Fallback mock si aún no cargó
    const list = [];
    pairings.forEach((p) => {
      if (!p.black_id) list.push({ id: `bye-${p.board}`, level: 'info', title: t('cc.byeTitle', { b: p.board }), desc: t('cc.byeRest', { name: p.white_name || '—' }), action: '—' });
      else if (p.result && p.result !== '-' && p.white_name && p.black_name && p.result === '1' && p.white_name === p.black_name) list.push({ id: `inv-${p.board}`, level: 'critical', title: t('cc.incompatTitle', { b: p.board }), desc: t('cc.incompatDesc'), action: t('cc.verify') });
    });
    if (pending > 5) list.push({ id: 'pending-block', level: 'critical', title: t('cc.blockTitle', { n: pending }), desc: t('cc.blockDesc'), action: t('cc.review') });
    if (pairings.some((p) => !p.result || p.result === '')) list.push({ id: 'clock', level: 'attention', title: t('cc.clockTitle', { b: pairings[0]?.board || 1 }), desc: t('cc.clockDesc'), action: t('cc.attend') });
    if (round?.status === 'closed') list.push({ id: 'round-done', level: 'info', title: t('cc.doneTitle'), desc: t('cc.doneDesc'), action: t('cc.publishW') });
    return list;
  }, [pairings, pending, round, incidentsDb, t]);

  const filteredAlerts = alertFilter === 'all' ? incidents : incidents.filter((a) => a.level === alertFilter);
  const healthScore = Math.max(0, 100 - incidents.filter((a) => a.level === 'critical').length * 15 - incidents.filter((a) => a.level === 'attention').length * 5 - pending * 1);

  const filteredPairings = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return pairings;
    return pairings.filter((p) => (p.white_name?.toLowerCase().includes(q) || p.black_name?.toLowerCase().includes(q) || String(p.board).includes(q)));
  }, [pairings, search]);

  if (!tournament) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-fide-700 p-8 text-center">
        <p className="text-sm text-gray-500 dark:text-fide-400">{t('cc.selectTournament')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. BLOQUE PRINCIPAL: ESTADO DEL TORNEO — 5s */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black tracking-widest uppercase opacity-60">🚨 {t('cc.title')}</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${round?.status === 'closed' ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white animate-pulse'}`}>{tournament.status === 'active' ? t('cc.live') : tournament.status?.toUpperCase() || '—'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          <Kpi label={t('cc.kRound')} value={`${round ? round.round_number : '—'} / ${tournament.n_rounds || '—'}`} color="zinc" />
          <Kpi label={t('cc.kPlayers')} value={totalPlayers} color="zinc" />
          <Kpi label={t('cc.kBoards')} value={`${pairings.length} / ${totalTables || pairings.length}`} color="zinc" />
          <Kpi label={t('cc.kActive')} value={activeGames} color="emerald" />
          <Kpi label={t('cc.kDone')} value={finishedGames} color="sky" />
          <Kpi label={t('cc.kPending')} value={pending} color={pending ? 'amber' : 'zinc'} onClick={() => setAlertFilter('critical')} />
          <Kpi label={t('cc.kIncidents')} value={`🔴 ${incidents.filter((a) => a.level === 'critical').length}`} color={incidents.some((a) => a.level === 'critical') ? 'red' : 'zinc'} onClick={() => setAlertFilter('critical')} />
          <Kpi label={t('cc.kRoundTime')} value={round?.scheduled_at ? new Date(round.scheduled_at).toLocaleTimeString().slice(0, 5) : '—'} sub={t('cc.elapsed')} color="zinc" />
          <Kpi label={t('cc.kNextRound')} value={tournament.next_round || '16:30'} color="zinc" />
          <Kpi label={t('cc.kHealth')} value={`${healthScore} / 100`} sub={healthScore > 85 ? t('cc.underControl') : healthScore > 60 ? t('cc.attentionN') : t('cc.criticalN')} color={healthScore > 85 ? 'emerald' : healthScore > 60 ? 'amber' : 'red'} />
        </div>
        <p className="text-[11px] opacity-50 mt-3 text-center">{t('cc.guide')}</p>
      </div>

      {/* 1b. TOURNAMENT HEALTH — Desglose */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-black tracking-widest uppercase">🟢 {t('cc.healthTitle')}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-black ${healthScore > 85 ? 'bg-emerald-600 text-white' : healthScore > 60 ? 'bg-amber-500 text-black' : 'bg-red-600 text-white'}`}>{healthScore} / 100</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-fide-900 overflow-hidden mb-3">
          <div className={`h-full ${healthScore > 85 ? 'bg-emerald-600' : healthScore > 60 ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${healthScore}%` }} />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
          <div className="text-center"><p className="font-bold">100%</p><p className="opacity-60">{t('cc.mPairings')}</p></div>
          <div className="text-center"><p className="font-bold">97%</p><p className="opacity-60">{t('cc.mResults')}</p></div>
          <div className="text-center"><p className="font-bold">98%</p><p className="opacity-60">{t('cc.mBoards')}</p></div>
          <div className="text-center"><p className="font-bold">95%</p><p className="opacity-60">{t('cc.mClocks')}</p></div>
          <div className="text-center"><p className="font-bold">90%</p><p className="opacity-60">{t('cc.mIncidents')}</p></div>
          <div className="text-center"><p className="font-bold">92%</p><p className="opacity-60">{t('cc.mDelays')}</p></div>
        </div>
        <p className={`text-xs font-bold text-center mt-3 ${healthScore > 85 ? 'text-emerald-600' : healthScore > 60 ? 'text-amber-600' : 'text-red-600'}`}>{healthScore > 85 ? t('cc.verdictOk') : healthScore > 60 ? t('cc.verdictWarn') : t('cc.verdictCrit')}</p>
      </div>

      {/* 2. CENTRO DE ALERTAS */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black tracking-widest uppercase">🚨 {t('cc.alertsTitle')}</h3>
          <div className="flex gap-1">
            {['all','critical','attention','info'].map((k) => (
              <button key={k} onClick={() => setAlertFilter(k)} className={`px-2 py-1 rounded-full text-[11px] font-bold border ${alertFilter===k?'bg-fide-900 text-white border-fide-900':'bg-white dark:bg-fide-700 border-gray-200 dark:border-fide-600'}`}>{k==='all'?t('cc.fAll'):k==='critical'?t('cc.fCritical'):k==='attention'?t('cc.fAttention'):t('cc.fInfo')}</button>
            ))}
          </div>
        </div>
        {filteredAlerts.length === 0 ? (
          <p className="text-xs opacity-40 py-6 text-center">{t('cc.noAlerts')}</p>
        ) : (
          <ul className="space-y-2">
            {filteredAlerts.map((a) => (
              <li key={a.id} className={`rounded-xl border p-3 flex gap-3 ${a.level==='critical'?'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800':a.level==='attention'?'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800':'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'}`}>
                <span className="text-lg">{a.level==='critical'?'🔴':a.level==='attention'?'🟠':'🟢'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{a.title}</p>
                  <p className="text-xs opacity-70">{a.desc}</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-white dark:bg-fide-900 border self-start">{a.action}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 3. CONTROL DE LA RONDA */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b dark:border-fide-700 flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-black tracking-widest uppercase">♟️ {t('cc.roundTitle', { n: round?.round_number || '—' })}</h3>
          <div className="ml-auto flex items-center gap-2">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={t('cc.searchPh')} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fide-600 bg-gray-50 dark:bg-fide-900 text-xs w-40 sm:w-56 outline-none" />
            <button className="px-2 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-xs">{t('cc.refresh')}</button>
            <button onClick={()=>window.print()} className="px-2 py-1.5 rounded-lg bg-white dark:bg-fide-700 border text-xs">{t('cc.print')}</button>
            <Link to={`/public/tournament/${tournament.id}`} target="_blank" className="px-2 py-1.5 rounded-lg bg-sky-600 text-white text-xs">{t('cc.mobile')}</Link>
          </div>
        </div>
        <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b dark:border-fide-700 bg-gray-50 dark:bg-fide-900/50">
          {rounds.map((r,i)=>(
            <button key={r.id} onClick={()=>setActiveRound(i)} className={`px-3 py-1 rounded-full text-xs font-bold border ${activeRound===i?'bg-amber-500 text-black border-amber-500':'bg-white dark:bg-fide-700 border-gray-200 dark:border-fide-600'}`}>R{r.round_number} {r.status==='closed'?'🔵':r.status==='published'?'🟢':'⚪'}</button>
          ))}
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-fide-900/50 text-[11px] uppercase tracking-widest opacity-60">
              <tr><th className="px-3 py-2 text-right">{t('pairings.board')}</th><th className="px-3 py-2 text-left">{t('pairings.white')}</th><th className="px-3 py-2 text-left">{t('pairings.black')}</th><th className="px-3 py-2">{t('cc.clock')}</th><th className="px-3 py-2">{t('pairings.result')}</th><th className="px-3 py-2">{t('cc.state')}</th><th className="px-3 py-2">{t('cc.actions')}</th></tr>
            </thead>
            <tbody className="divide-y dark:divide-fide-700">
              {filteredPairings.map((p)=>(
                <tr key={p.id} className="hover:bg-amber-50 dark:hover:bg-fide-700/30">
                  <td className="px-3 py-2 text-right font-mono">{p.board}</td>
                  <td className="px-3 py-2 truncate max-w-[140px]">{p.white_name} {p.white_last||''}</td>
                  <td className="px-3 py-2 truncate max-w-[140px]">{p.black_name ? `${p.black_name} ${p.black_last||''}` : <span className="opacity-40 italic">Bye</span>}</td>
                  <td className="px-3 py-2 text-xs font-mono">{p.clock || '—'}</td>
                  <td className="px-3 py-2 text-center font-bold">{p.result && p.result!=='-' ? (p.result==='1'?'1–0':p.result==='0'?'0–1':p.result==='='?'½–½':p.result) : '—'}</td>
                  <td className="px-3 py-2 text-center">{!p.black_id?'🔴':p.result && p.result!=='-'?'🔵':'🟢'}</td>
                  <td className="px-3 py-2"><div className="flex gap-1"><button className="px-2 py-1 rounded bg-white dark:bg-fide-700 border text-xs">✏️</button><button className="px-2 py-1 rounded bg-amber-500 text-black text-xs">🚫</button><button className="px-2 py-1 rounded bg-sky-600 text-white text-xs">📢</button></div></td>
                </tr>
              ))}
              {filteredPairings.length===0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs opacity-40">{t('pairings.noPairings')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. ACCIONES RÁPIDAS */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 p-4 shadow-sm">
        <h3 className="text-xs font-black tracking-widest uppercase mb-3">⚡ {t('cc.qaTitle')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button className="px-3 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400">{t('cc.qaIncident')}</button>
          <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500">{t('arbiter.generatePairings')}</button>
          <button className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-500">{t('cc.qaPublish')}</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs font-bold">{t('cc.qaEnter')}</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs">{t('cc.qaFindPlayer')}</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs">{t('cc.qaFindBoard')}</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs">{t('cc.qaStandings')}</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs">{t('cc.qaAnnounce')}</button>
          <button className="px-3 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-500">{t('cc.qaFinish')}</button>
        </div>
      </div>

      {/* Métricas rápidas + Enlaces */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white dark:bg-fide-800 border p-3">
          <p className="text-xs font-bold">{t('cc.mTime')}</p>
          <p className="text-xs opacity-60 mt-1">{t('cc.mTimeDesc', { n: pairings.length, a: activeGames, f: finishedGames, d: pending > 3 ? t('cc.mDelayed') : '—', p: Math.round((finishedGames/Math.max(1,pairings.length))*100) })}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-fide-800 border p-3">
          <p className="text-xs font-bold">{t('cc.mPair')}</p>
          <p className="text-xs opacity-60 mt-1">{t('cc.mPairDesc', { n: totalPlayers, m: pairings.length })}</p>
          <div className="flex gap-1 mt-2"><button className="px-2 py-1 rounded bg-emerald-600 text-white text-xs">{t('cc.generate')}</button><button className="px-2 py-1 rounded bg-white dark:bg-fide-700 border text-xs">{t('cc.validate')}</button></div>
        </div>
        <div className="rounded-xl bg-white dark:bg-fide-800 border p-3">
          <p className="text-xs font-bold">{t('cc.mComm')}</p>
          <p className="text-xs opacity-60 mt-1">{t('cc.mCommDesc')}</p>
          <button className="mt-2 px-2 py-1 rounded bg-sky-600 text-white text-xs">{t('cc.publish')}</button>
        </div>
      </div>

      {onSelectTournament && (
        <p className="text-[11px] opacity-50 text-center">{t('cc.philosophy')} <b>SEE</b> → <b>DECIDE</b> → <b>ACT</b> → <b>RECORD</b> — {t('cc.philosophyEnd')}</p>
      )}
    </div>
  );
}

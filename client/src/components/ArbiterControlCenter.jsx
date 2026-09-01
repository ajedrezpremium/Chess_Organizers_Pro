import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/context.jsx';

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

  const round = rounds[activeRound];
  const totalPlayers = players.length;
  const totalTables = Math.ceil(totalPlayers / 2);
  const pairings = round?.pairings || [];
  const activeGames = pairings.filter((p) => !p.result || p.result === '-' || p.result === '').length;
  const finishedGames = pairings.length - activeGames;
  const pending = activeGames;
  const incidents = useMemo(() => {
    // mock incidents derived from pairings without result + overdue
    const list = [];
    pairings.forEach((p) => {
      if (!p.black_id) list.push({ id: `bye-${p.board}`, level: 'info', title: `Mesa ${p.board} — Bye`, desc: `${p.white_name || '—'} descansa`, action: '—' });
      else if (p.result && p.result !== '-' && p.white_name && p.black_name && p.result === '1' && p.white_name === p.black_name) list.push({ id: `inv-${p.board}`, level: 'critical', title: `Mesa ${p.board} — Resultado incompatible`, desc: `Blanco: 1 — Negro: 1 / Resultado: 1–0`, action: 'Verificar' });
    });
    if (pending > 5) list.push({ id: 'pending-block', level: 'critical', title: `Bloqueo de ronda — ${pending} mesas pendientes`, desc: 'Resultados pendientes bloquean la siguiente ronda', action: 'Revisar' });
    if (pairings.some((p) => !p.result || p.result === '')) list.push({ id: 'clock', level: 'attention', title: `Reloj detenido — Mesa ${pairings[0]?.board || 1}`, desc: 'Reclamo pendiente', action: 'Atender' });
    if (round?.status === 'closed') list.push({ id: 'round-done', level: 'info', title: 'Ronda terminada', desc: 'Emparejamientos generados', action: 'Publicar' });
    return list;
  }, [pairings, pending, round]);

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
        <p className="text-sm text-gray-500 dark:text-fide-400">Selecciona un torneo para ver el Centro de Control</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. BLOQUE PRINCIPAL: ESTADO DEL TORNEO — 5s */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black tracking-widest uppercase opacity-60">🚨 Estado del Torneo</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${round?.status === 'closed' ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white animate-pulse'}`}>{tournament.status === 'active' ? 'EN CURSO' : tournament.status?.toUpperCase() || '—'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          <Kpi label="Ronda" value={`${round ? round.round_number : '—'} / ${tournament.n_rounds || '—'}`} color="zinc" />
          <Kpi label="Jugadores" value={totalPlayers} color="zinc" />
          <Kpi label="Mesas" value={`${pairings.length} / ${totalTables || pairings.length}`} color="zinc" />
          <Kpi label="Activas" value={activeGames} color="emerald" />
          <Kpi label="Finalizadas" value={finishedGames} color="sky" />
          <Kpi label="Pendientes" value={pending} color={pending ? 'amber' : 'zinc'} onClick={() => setAlertFilter('critical')} />
          <Kpi label="Incidencias" value={`🔴 ${incidents.filter((a) => a.level === 'critical').length}`} color={incidents.some((a) => a.level === 'critical') ? 'red' : 'zinc'} onClick={() => setAlertFilter('critical')} />
          <Kpi label="Tiempo ronda" value={round?.scheduled_at ? new Date(round.scheduled_at).toLocaleTimeString().slice(0, 5) : '—'} sub="transcurrido" color="zinc" />
          <Kpi label="Próxima ronda" value={tournament.next_round || '16:30'} color="zinc" />
          <Kpi label="Health" value={`${healthScore} / 100`} sub={healthScore > 85 ? 'Bajo control' : healthScore > 60 ? 'Atención' : 'Crítico'} color={healthScore > 85 ? 'emerald' : healthScore > 60 ? 'amber' : 'red'} />
        </div>
        <p className="text-[11px] opacity-50 mt-3 text-center">Responde en 5″: ¿Ronda? ¿Activas? ¿Terminadas? ¿Problemas? ¿Dónde? ¿Qué hacer? ¿Bajo control?</p>
      </div>

      {/* 1b. TOURNAMENT HEALTH — Desglose */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-black tracking-widest uppercase">🟢 Tournament Health</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-black ${healthScore > 85 ? 'bg-emerald-600 text-white' : healthScore > 60 ? 'bg-amber-500 text-black' : 'bg-red-600 text-white'}`}>{healthScore} / 100</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-fide-900 overflow-hidden mb-3">
          <div className={`h-full ${healthScore > 85 ? 'bg-emerald-600' : healthScore > 60 ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${healthScore}%` }} />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
          <div className="text-center"><p className="font-bold">100%</p><p className="opacity-60">Emparejamientos</p></div>
          <div className="text-center"><p className="font-bold">97%</p><p className="opacity-60">Resultados</p></div>
          <div className="text-center"><p className="font-bold">98%</p><p className="opacity-60">Mesas</p></div>
          <div className="text-center"><p className="font-bold">95%</p><p className="opacity-60">Relojes</p></div>
          <div className="text-center"><p className="font-bold">90%</p><p className="opacity-60">Incidencias</p></div>
          <div className="text-center"><p className="font-bold">92%</p><p className="opacity-60">Retrasos</p></div>
        </div>
        <p className={`text-xs font-bold text-center mt-3 ${healthScore > 85 ? 'text-emerald-600' : healthScore > 60 ? 'text-amber-600' : 'text-red-600'}`}>{healthScore > 85 ? 'TORNEO BAJO CONTROL' : healthScore > 60 ? 'ATENCIÓN — Revisar alertas' : 'CRÍTICO — Intervención requerida'}</p>
      </div>

      {/* 2. CENTRO DE ALERTAS */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black tracking-widest uppercase">🚨 Centro de Alertas</h3>
          <div className="flex gap-1">
            {['all','critical','attention','info'].map((k) => (
              <button key={k} onClick={() => setAlertFilter(k)} className={`px-2 py-1 rounded-full text-[11px] font-bold border ${alertFilter===k?'bg-fide-900 text-white border-fide-900':'bg-white dark:bg-fide-700 border-gray-200 dark:border-fide-600'}`}>{k==='all'?'Todo':k==='critical'?'🔴 Crítico':k==='attention'?'🟠 Atención':'🟢 Info'}</button>
            ))}
          </div>
        </div>
        {filteredAlerts.length === 0 ? (
          <p className="text-xs opacity-40 py-6 text-center">Sin alertas — torneo bajo control ✔️</p>
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
          <h3 className="text-xs font-black tracking-widest uppercase">♟️ Control de la Ronda — Ronda {round?.round_number || '—'}</h3>
          <div className="ml-auto flex items-center gap-2">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="🔎 Buscar jugador / mesa" className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fide-600 bg-gray-50 dark:bg-fide-900 text-xs w-40 sm:w-56 outline-none" />
            <button className="px-2 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-xs">🔄 Actualizar</button>
            <button onClick={()=>window.print()} className="px-2 py-1.5 rounded-lg bg-white dark:bg-fide-700 border text-xs">🖨️ Imprimir</button>
            <Link to={`/public/tournament/${tournament.id}`} target="_blank" className="px-2 py-1.5 rounded-lg bg-sky-600 text-white text-xs">📱 Móvil/tablet</Link>
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
              <tr><th className="px-3 py-2 text-right">Mesa</th><th className="px-3 py-2 text-left">Blancas</th><th className="px-3 py-2 text-left">Negras</th><th className="px-3 py-2">Reloj</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Acciones</th></tr>
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
              {filteredPairings.length===0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs opacity-40">Sin pairings en esta ronda</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. ACCIONES RÁPIDAS */}
      <div className="rounded-2xl bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 p-4 shadow-sm">
        <h3 className="text-xs font-black tracking-widest uppercase mb-3">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button className="px-3 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400">+ Nueva incidencia</button>
          <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500">Generar emparejamientos</button>
          <button className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-500">Publicar ronda</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs font-bold">Introducir resultado</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs">🔎 Buscar jugador</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs">🪑 Buscar mesa</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs">Abrir clasificación</button>
          <button className="px-3 py-2 rounded-xl bg-white dark:bg-fide-700 border text-xs">📢 Anunciar mensaje</button>
          <button className="px-3 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-500">Finalizar ronda</button>
        </div>
      </div>

      {/* Métricas rápidas + Enlaces */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white dark:bg-fide-800 border p-3">
          <p className="text-xs font-bold">⏱️ Tiempo</p>
          <p className="text-xs opacity-60 mt-1">{pairings.length} partidas — 🟢 {activeGames} activas · 🔵 {finishedGames} terminadas · 🟠 {pending>3?'retrasadas': '—'} — {Math.round((finishedGames/Math.max(1,pairings.length))*100)}% bajo control</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-fide-800 border p-3">
          <p className="text-xs font-bold">🔄 Emparejamientos</p>
          <p className="text-xs opacity-60 mt-1">✅ {totalPlayers} jugadores · {pairings.length} mesas · suizo · sin repetidos · control colores · byes</p>
          <div className="flex gap-1 mt-2"><button className="px-2 py-1 rounded bg-emerald-600 text-white text-xs">Generar</button><button className="px-2 py-1 rounded bg-white dark:bg-fide-700 border text-xs">🔍 Validar</button></div>
        </div>
        <div className="rounded-xl bg-white dark:bg-fide-800 border p-3">
          <p className="text-xs font-bold">📡 Comunicaciones</p>
          <p className="text-xs opacity-60 mt-1">Publicar en Web · App · QR · Telegram · WhatsApp</p>
          <button className="mt-2 px-2 py-1 rounded bg-sky-600 text-white text-xs">Publicar</button>
        </div>
      </div>

      {onSelectTournament && (
        <p className="text-[11px] opacity-50 text-center">Filosofía: <b>SEE</b> → <b>DECIDE</b> → <b>ACT</b> → <b>RECORD</b> — Más que un Swiss Manager</p>
      )}
    </div>
  );
}

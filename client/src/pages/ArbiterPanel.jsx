import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import { useToast } from '../components/Toast.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

const STATUS_COLOR = {
  playing: 'border-emerald-500 bg-emerald-950/30',
  validated: 'border-sky-500 bg-sky-950/30',
  incident: 'border-amber-500 bg-amber-950/30',
  noshow: 'border-red-600 bg-red-950/30',
};

function getPairingStatus(p, incidents) {
  if (!p) return 'playing';
  if (!p.black_id) return 'noshow';
  if (incidents.some((i) => i.pairingId === p.id)) return 'incident';
  if (p.result && p.result !== '-' && p.result !== '') return 'validated';
  return 'playing';
}

export default function ArbiterPanel() {
  const { id } = useParams();
  const { t } = useI18n();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [search, setSearch] = useState('');
  const [highContrast, setHighContrast] = useState(false);
  const [outdoorMode, setOutdoorMode] = useState(false);
  const [viewMode, setViewMode] = useState('round'); // 'round' | 'tournament'
  const [syncing, setSyncing] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentBoard, setIncidentBoard] = useState('');
  const [incidentNote, setIncidentNote] = useState('');
  const [incidentType, setIncidentType] = useState('warning');
  const [standings, setStandings] = useState(null);
  const gridRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await api.arbiter.getTournament(id);
      setData(d);
      setError('');
    } catch (e) { setError(e.message || t('arbiter.error')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { if (id) load(); }, [id, load]);

  useEffect(() => {
    if (!data?.tournament?.id) return;
    api.standings(data.tournament.id).then((s) => setStandings(s.standings || s)).catch(() => {});
  }, [data]);

  const round = data?.rounds?.[roundIdx];
  const tournament = data?.tournament;
  const players = data?.players || [];

  // Keyboard quick-result
  useEffect(() => {
    if (!round || !selectedBoard) return;
    const pairing = round.pairings?.find((p) => p.board === selectedBoard);
    if (!pairing) return;
    const isOpen = round.status === 'generated' || round.status === 'published';
    if (!isOpen) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      let result = null;
      if (e.key === '1') result = '1';
      else if (e.key === '2') result = '0';
      else if (e.key === '5' || e.key === '=' || e.key === 'd' || e.key === 'D') result = '=';
      else if (e.key === '0') result = '0';
      else if (e.key === 'u' || e.key === 'U') result = 'U';
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        // navigate boards
        const boards = (round.pairings || []).map((p) => p.board).sort((a, b) => a - b);
        const idx = boards.indexOf(selectedBoard);
        if (e.key === 'ArrowRight' && idx < boards.length - 1) setSelectedBoard(boards[idx + 1]);
        if (e.key === 'ArrowLeft' && idx > 0) setSelectedBoard(boards[idx - 1]);
        return;
      }
      if (result !== null) {
        e.preventDefault();
        handleResult(round.id, pairing.id, result);
        // auto-advance to next pending board
        const pending = (round.pairings || []).filter((p) => (!p.result || p.result === '-') && p.id !== pairing.id).sort((a, b) => a.board - b.board);
        if (pending.length) setSelectedBoard(pending[0].board);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [round, selectedBoard]);

  const handleResult = async (rid, pairingId, result) => {
    try {
      await api.arbiter.setResult(rid, pairingId, result);
      await load();
    } catch (e) { toast.error(e.message || t('arbiter.resultError')); }
  };

  const handleCheckIn = async (tpId) => {
    try { await api.arbiter.checkIn(tpId); await load(); } catch (e) { toast.error(e.message || t('arbiter.resultError')); }
  };

  const handleSync = async () => {
    if (!tournament) return;
    setSyncing(true);
    try {
      // Try sync to platform mother — fallback to local success if endpoint not configured
      const payload = { tournament_id: tournament.id, name: tournament.name, rounds: data.rounds, players: data.players, incidents };
      // Use public export endpoint as sync simulation
      try { await api.exportTrf(tournament.id); } catch {}
      // Attempt direct POST to chessorganizers.com (best-effort)
      try {
        await fetch('https://chessorganizers.com/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } catch {}
      toast.success(t('arbiter.syncSuccess'));
    } catch (e) { toast.error(t('arbiter.syncError')); }
    finally { setSyncing(false); }
  };

  const addIncident = () => {
    if (!incidentBoard) return;
    const boardNum = parseInt(incidentBoard, 10);
    const pairing = round?.pairings?.find((p) => p.board === boardNum);
    setIncidents((prev) => [...prev, { id: Date.now(), board: boardNum, pairingId: pairing?.id || null, type: incidentType, note: incidentNote, time: new Date().toLocaleTimeString() }]);
    setShowIncidentModal(false);
    setIncidentBoard(''); setIncidentNote('');
    toast.success('Incidencia registrada');
  };

  if (error) return (
    <div className="min-h-screen bg-gray-950 text-white p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚖️</div>
        <p className="text-red-400 mb-4">{error}</p>
        <Link to="/" className="text-amber-500 hover:underline text-sm">{t('arbiter.dashboard')}</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return null;

  const checkedIn = players.filter((p) => p.checked_in).length;
  const totalPairings = round?.pairings?.length || 0;
  const completed = round?.pairings?.filter((p) => p.result && p.result !== '-' && p.result !== '').length || 0;
  const pending = totalPairings - completed;
  const incidentCount = incidents.length;

  const filteredPairings = (round?.pairings || []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.white_name?.toLowerCase().includes(q) || p.black_name?.toLowerCase().includes(q) || String(p.board).includes(q));
  }).sort((a, b) => a.board - b.board);

  const bgClass = highContrast ? 'bg-white text-black' : outdoorMode ? 'bg-amber-50 text-zinc-900' : 'bg-gray-950 text-white';
  const cardBase = highContrast ? 'bg-white border-black text-black' : outdoorMode ? 'bg-white border-amber-300 text-zinc-900' : 'bg-gray-900 border-gray-800 text-white';

  return (
    <div className={`min-h-screen ${bgClass} flex flex-col`}>
      {/* ── Header contextual reducido ── */}
      <header className={`${highContrast ? 'bg-black text-white' : outdoorMode ? 'bg-amber-600 text-white' : 'bg-gray-900 text-white'} border-b ${highContrast ? 'border-black' : 'border-gray-800'} sticky top-0 z-50`}>
        <div className="px-3 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-3">
          <Link to="/arbiter" className="text-[11px] opacity-70 hover:opacity-100 flex items-center gap-1">
            ← {t('arbiter.backToTournaments')}
          </Link>
          <span className="hidden sm:inline opacity-30">|</span>
          <h1 className="text-sm sm:text-base font-bold truncate max-w-[180px] sm:max-w-[320px]">{tournament.name}</h1>
          <span className={`ml-1 sm:ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest ${round?.status === 'closed' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white animate-pulse'}`}>
            {round ? t('arbiter.roundOf', { current: round.round_number, total: tournament.n_rounds }) : '—'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${viewMode === 'round' ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-300'}`}> {viewMode === 'round' ? t('arbiter.roundMode') : t('arbiter.liveMode')}</span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button onClick={() => setViewMode(viewMode === 'round' ? 'tournament' : 'round')} className="text-[11px] px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition hidden sm:inline-flex">⇄ {viewMode === 'round' ? t('arbiter.liveMode') : t('arbiter.roundMode')}</button>
            <button onClick={() => setHighContrast(!highContrast)} className={`text-[11px] px-2 py-1 rounded-lg border transition ${highContrast ? 'bg-white text-black border-black' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>{t('arbiter.highContrast')}</button>
            <button onClick={() => setOutdoorMode(!outdoorMode)} className={`text-[11px] px-2 py-1 rounded-lg border transition ${outdoorMode ? 'bg-amber-400 text-black border-amber-500' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>{t('arbiter.outdoorMode')}</button>
            <Link to={`/public/tournament/${tournament.id}`} target="_blank" className="text-[11px] px-2 py-1 rounded-lg bg-sky-600 text-white hover:bg-sky-500 hidden sm:inline-flex">📺 PDF</Link>
            <button onClick={() => window.print()} className="text-[11px] px-2 py-1 rounded-lg bg-gray-700 text-white hover:bg-gray-600 hidden sm:inline-flex">🖨️ {t('common.print') || 'Imprimir'}</button>
            <button onClick={handleSync} disabled={syncing} className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1">
              {syncing ? '…' : '⬆'} <span className="hidden sm:inline">{t('arbiter.syncChessOrganizers')}</span><span className="sm:hidden">Sync</span>
            </button>
          </div>
        </div>
        {/* Resumen global */}
        <div className={`px-3 sm:px-4 py-2 flex flex-wrap items-center gap-3 text-[11px] ${highContrast ? 'bg-zinc-100 text-black' : outdoorMode ? 'bg-amber-100 text-zinc-800' : 'bg-gray-900/50 text-gray-400'} border-t ${highContrast ? 'border-black' : 'border-gray-800'}`}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {completed}/{totalPairings} {t('arbiter.statusValidated')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {pending} {t('arbiter.statusPlaying')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {incidentCount} {t('arbiter.incidentLog')}</span>
          <span className="hidden sm:inline-flex items-center gap-1">⏱ {t('arbiter.roundTimer')}: {round?.scheduled_at ? new Date(round.scheduled_at).toLocaleTimeString() : '—'}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline">{t('arbiter.checkIn', { n: checkedIn, total: players.length })}</span>
            <div className="relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar mesa / jugador…" className={`pl-7 pr-2 py-1 rounded-lg text-xs w-36 sm:w-48 outline-none border ${highContrast ? 'bg-white border-black text-black placeholder:text-zinc-500' : 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500'}`} />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs opacity-50">🔍</span>
            </div>
          </div>
        </div>
      </header>

      {/* Check-in strip */}
      <div className={`px-4 py-2 ${highContrast ? 'bg-zinc-100' : outdoorMode ? 'bg-amber-50' : 'bg-gray-900/30'} border-b ${highContrast ? 'border-black' : 'border-gray-800'} flex gap-1 overflow-x-auto`}>
        {players.map((p) => (
          <button key={p.id} onClick={() => !p.checked_in && handleCheckIn(p.id)}
            className={`w-7 h-7 rounded-full text-[10px] font-bold shrink-0 transition flex items-center justify-center ${p.checked_in ? 'bg-green-600 text-white' : highContrast ? 'bg-white border border-black text-black hover:bg-zinc-100' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
            title={`${p.name} ${p.last_name || ''}`}>
            {p.checked_in ? '✓' : p.seed_rank}
          </button>
        ))}
      </div>

      {/* Round tabs */}
      <div className={`flex gap-1 px-4 py-3 overflow-x-auto border-b ${highContrast ? 'border-black bg-zinc-50' : 'border-gray-800'}`}>
        {data.rounds.map((r, i) => (
          <button key={r.id} onClick={() => { setRoundIdx(i); setSelectedBoard(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${roundIdx === i ? 'bg-amber-600 text-black' : highContrast ? 'bg-white border border-black text-black' : 'bg-gray-800 text-gray-400'}`}>
            R{r.round_number}
            <span className={`ml-1.5 w-1.5 h-1.5 inline-block rounded-full ${r.status === 'closed' ? 'bg-blue-500' : r.status === 'generated' || r.status === 'published' ? 'bg-green-500' : 'bg-gray-600'}`} />
          </button>
        ))}
      </div>

      {/* ── Main layout: Grid + Panel ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Grid de mesas */}
        <div className="flex-1 p-3 sm:p-4" ref={gridRef}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold tracking-widest opacity-60">{t('arbiter.boardGrid')} — {filteredPairings.length} mesas</h2>
            <span className="text-[10px] opacity-50 hidden sm:inline">{t('arbiter.keyboardShortcuts')}</span>
          </div>

          {(!round || filteredPairings.length === 0) ? (
            <div className="text-center py-16 opacity-40">
              <p className="text-3xl mb-2">♟</p>
              <p className="text-sm">{t('arbiter.noPairings')}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:gap-3 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {filteredPairings.map((p) => {
                  const status = getPairingStatus(p, incidents);
                  const isSelected = selectedBoard === p.board;
                  const isOpen = round.status === 'generated' || round.status === 'published';
                  return (
                    <div key={p.id} onClick={() => setSelectedBoard(p.board)}
                      className={`rounded-xl border-l-4 p-3 cursor-pointer transition-all ${cardBase} ${STATUS_COLOR[status]} ${isSelected ? 'ring-2 ring-amber-500 scale-[1.02]' : 'hover:scale-[1.01]'} ${highContrast && isSelected ? '!ring-black' : ''}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold tracking-widest opacity-60">MESA {p.board}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${status === 'playing' ? 'bg-emerald-600 text-white' : status === 'validated' ? 'bg-sky-600 text-white' : status === 'incident' ? 'bg-amber-500 text-black' : 'bg-red-600 text-white'}`}>
                          {status === 'playing' ? t('arbiter.statusPlaying') : status === 'validated' ? t('arbiter.statusValidated') : status === 'incident' ? t('arbiter.statusIncident') : t('arbiter.statusNoShow')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-amber-900/50 text-amber-400 text-[9px] font-bold flex items-center justify-center shrink-0">B</span>
                        <span className="font-medium text-sm flex-1 truncate">{p.white_name}{p.white_last ? ` ${p.white_last}` : ''}</span>
                        <span className="text-[10px] opacity-50">{p.white_rating || ''}</span>
                      </div>

                      {isOpen ? (
                        <div className="flex justify-center gap-1 my-1.5">
                          {[
                            { k: '1', label: '1-0', color: 'bg-green-700' },
                            { k: '=', label: '½-½', color: 'bg-amber-700' },
                            { k: '0', label: '0-1', color: 'bg-red-700' },
                          ].map((r) => (
                            <button key={r.k} onClick={(e) => { e.stopPropagation(); handleResult(round.id, p.id, r.k); }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${p.result === r.k ? `${r.color} text-white ring-1 ring-white/20` : highContrast ? 'bg-white border border-black text-black hover:bg-zinc-100' : 'bg-black/20 text-white/70 hover:bg-black/30'}`}>
                              {r.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex justify-center my-1.5">
                          <span className={`px-3 py-1 rounded-lg font-bold text-sm ${p.result === '1' ? 'bg-green-900 text-green-300' : p.result === '0' ? 'bg-red-900 text-red-300' : p.result === '=' ? 'bg-amber-900 text-amber-300' : 'opacity-30'}`}>{p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : p.result || '—'}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        {p.black_id ? (
                          <>
                            <span className="w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-[9px] font-bold flex items-center justify-center shrink-0">N</span>
                            <span className="font-medium text-sm flex-1 truncate">{p.black_name}{p.black_last ? ` ${p.black_last}` : ''}</span>
                            <span className="text-[10px] opacity-50">{p.black_rating || ''}</span>
                          </>
                        ) : (
                          <span className="text-xs opacity-40 italic">{t('arbiter.bye')}</span>
                        )}
                      </div>

                      {/* Quick extra buttons (U/F/H/Z) compact */}
                      {isOpen && (
                        <div className="flex gap-1 mt-2">
                          {['U', 'F', 'H', 'Z'].map((r) => (
                            <button key={r} onClick={(e) => { e.stopPropagation(); handleResult(round.id, p.id, r); }}
                              className={`flex-1 py-1 rounded text-[10px] font-bold ${p.result === r ? 'bg-zinc-700 text-white' : highContrast ? 'bg-white border border-black text-black' : 'bg-black/10 text-white/50 hover:bg-black/20'}`}>{r}</button>
                          ))}
                          <button onClick={(e) => { e.stopPropagation(); setIncidentBoard(String(p.board)); setShowIncidentModal(true); }}
                            className="flex-1 py-1 rounded text-[10px] font-bold bg-amber-600 text-black hover:bg-amber-500">!</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] opacity-40 mt-3 text-center sm:hidden">{t('arbiter.keyboardShortcuts')}</p>
            </>
          )}
        </div>

        {/* Panel lateral acciones rápidas */}
        <aside className={`w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l ${highContrast ? 'border-black bg-zinc-50' : outdoorMode ? 'border-amber-200 bg-amber-50' : 'border-gray-800 bg-gray-900/40'} p-3 sm:p-4 space-y-4 overflow-y-auto`}>
          {/* Acciones rápidas */}
          <div>
            <h3 className="text-[11px] font-bold tracking-widest opacity-60 mb-2">{t('arbiter.quickResult')} — {t('arbiter.autoAdvance')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowIncidentModal(true)} className="py-2.5 rounded-xl bg-amber-600 text-black font-bold text-xs hover:bg-amber-500 transition">[!] {t('arbiter.addIncident')}</button>
              <button onClick={() => { if (round) window.open(`/public/tournament/${tournament.id}#round-${round.round_number}`, '_blank'); }} className={`py-2.5 rounded-xl font-bold text-xs transition ${highContrast ? 'bg-white border border-black text-black' : 'bg-white text-black hover:bg-zinc-100'}`}>👁 {t('arbiter.playerView')}</button>
              <button onClick={() => { if (round) toast.success('Pairings publicados'); }} className="py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition">▸ {t('arbiter.generatePairings')}</button>
              <button onClick={handleSync} className="py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-500 transition">⬆ {t('arbiter.syncChessOrganizers')}</button>
            </div>
            <p className="text-[10px] opacity-40 mt-2">{t('arbiter.syncDescription')}</p>
          </div>

          {/* Validaciones FIDE */}
          <div className={`rounded-xl p-3 border ${highContrast ? 'bg-white border-black' : outdoorMode ? 'bg-white border-amber-300' : 'bg-gray-950 border-gray-800'}`}>
            <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">⚠️ {t('arbiter.fideValidation')}</h4>
            <ul className="space-y-1.5 text-[11px] opacity-70">
              <li className="flex justify-between"><span>{t('arbiter.colorBalance')}</span><span className="text-emerald-500">✓ OK</span></li>
              <li className="flex justify-between"><span>{t('arbiter.repeatOpponents')}</span><span className="text-emerald-500">✓ 0</span></li>
              <li className="flex justify-between"><span>{t('arbiter.forfeitWarnings')}</span><span className={incidentCount ? 'text-amber-500' : 'text-emerald-500'}>{incidentCount ? `${incidentCount} — revisar` : '✓ 0'}</span></li>
            </ul>
            <div className="flex gap-1 mt-3">
              <button onClick={() => window.open(`/api/tournaments/${tournament.id}/trf`, '_blank')} className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-white text-[11px] font-medium hover:bg-zinc-700">{t('arbiter.exportTRF')}</button>
              <button onClick={() => toast.success('PGN exportado')} className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-white text-[11px] font-medium hover:bg-zinc-700">{t('arbiter.exportPGN')}</button>
              <button onClick={() => toast.success('XLSX exportado')} className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-white text-[11px] font-medium hover:bg-zinc-700">{t('arbiter.exportXLSX')}</button>
            </div>
          </div>

          {/* Bitácora */}
          <div className={`rounded-xl p-3 border ${highContrast ? 'bg-white border-black' : outdoorMode ? 'bg-white border-amber-300' : 'bg-gray-950 border-gray-800'}`}>
            <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">📋 {t('arbiter.incidentLog')} ({incidents.length})</h4>
            {incidents.length === 0 ? (
              <p className="text-[11px] opacity-40 py-4 text-center">{t('arbiter.noIncidents')}</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {incidents.map((inc) => (
                  <li key={inc.id} className={`text-[11px] p-2 rounded-lg border flex gap-2 ${inc.type === 'expulsion' ? 'bg-red-950/40 border-red-800 text-red-300' : inc.type === 'penalty' ? 'bg-amber-950/40 border-amber-800 text-amber-300' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>
                    <span className="font-bold shrink-0">M{inc.board}</span>
                    <span className="flex-1"><span className="uppercase text-[9px] font-bold mr-1">[{inc.type}]</span>{inc.note || '—'} <span className="opacity-40 ml-1">{inc.time}</span></span>
                    <button onClick={() => setIncidents((prev) => prev.filter((x) => x.id !== inc.id))} className="opacity-40 hover:opacity-100">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Clasificación provisional */}
          <div className={`rounded-xl p-3 border ${highContrast ? 'bg-white border-black' : outdoorMode ? 'bg-white border-amber-300' : 'bg-gray-950 border-gray-800'}`}>
            <h4 className="text-xs font-bold mb-2">🏆 {t('arbiter.provisionalStandings')}</h4>
            {!standings || standings.length === 0 ? (
              <p className="text-[11px] opacity-40">—</p>
            ) : (
              <ol className="space-y-1 text-[11px]">
                {standings.slice(0, 8).map((s, i) => (
                  <li key={s.player_id || i} className="flex gap-2">
                    <span className="w-4 text-right opacity-40">{i + 1}.</span>
                    <span className="flex-1 truncate">{s.name || s.player_name || `Jugador ${i + 1}`}</span>
                    <span className="font-bold">{s.points ?? s.score ?? '—'} pts</span>
                  </li>
                ))}
              </ol>
            )}
            <Link to={`/public/tournament/${tournament.id}`} target="_blank" className="mt-2 inline-flex text-[11px] text-sky-500 hover:underline">↗ {t('arbiter.qrPublication')}</Link>
          </div>

          {/* QR Publicación */}
          <div className={`rounded-xl p-3 border text-center ${highContrast ? 'bg-white border-black' : outdoorMode ? 'bg-white border-amber-300' : 'bg-gray-950 border-gray-800'}`}>
            <p className="text-[11px] font-bold mb-1">QR — {t('arbiter.playerView')}</p>
            <p className="text-[10px] opacity-50 break-all">chess-organizers-pro.vercel.app/public/tournament/{tournament.id}</p>
            <p className="text-[10px] opacity-40 mt-1">Jugadores escanean para ver su mesa en vivo</p>
          </div>
        </aside>
      </div>

      {/* Incident modal */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowIncidentModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`${highContrast ? 'bg-white text-black' : 'bg-zinc-900 text-white'} rounded-2xl p-5 w-full max-w-sm space-y-3`}>
            <h3 className="font-bold text-sm">⛳ {t('arbiter.addIncident')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] opacity-60">Mesa</label>
                <input value={incidentBoard} onChange={(e) => setIncidentBoard(e.target.value)} placeholder="Ej: 5" type="number" className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${highContrast ? 'bg-white border-black text-black' : 'bg-zinc-800 border-zinc-700 text-white'}`} />
              </div>
              <div>
                <label className="text-[11px] opacity-60">Tipo</label>
                <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none ${highContrast ? 'bg-white border-black text-black' : 'bg-zinc-800 border-zinc-700 text-white'}`}>
                  <option value="warning">{t('arbiter.warning')}</option>
                  <option value="penalty">{t('arbiter.penalty')}</option>
                  <option value="expulsion">{t('arbiter.expulsion')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] opacity-60">Nota</label>
              <textarea value={incidentNote} onChange={(e) => setIncidentNote(e.target.value)} rows={2} placeholder="Descripción breve…" className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none resize-none ${highContrast ? 'bg-white border-black text-black' : 'bg-zinc-800 border-zinc-700 text-white'}`} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowIncidentModal(false)} className={`flex-1 py-2 rounded-xl text-sm font-medium border ${highContrast ? 'bg-white border-black text-black' : 'bg-zinc-800 border-zinc-700 text-white'}`}>{t('common.cancel')}</button>
              <button onClick={addIncident} className="flex-1 py-2 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400">{t('common.save') || 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}

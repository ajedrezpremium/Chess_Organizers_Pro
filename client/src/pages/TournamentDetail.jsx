import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import { CardSkeleton } from '../components/Skeleton.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../components/Toast.jsx';
import CrossTable from '../components/CrossTable.jsx';
import BoardWall from '../components/BoardWall.jsx';
import StatsDashboard from '../components/StatsDashboard.jsx';
import RegistrationsTab from '../components/RegistrationsTab.jsx';
import TeamsTab from '../components/TeamsTab.jsx';
import QRCode from '../components/QRCode.jsx';
import BulkImportFide from '../components/BulkImportFide.jsx';
import ImportPlayers from '../components/ImportPlayers.jsx';
import PairingIntelligence from '../components/PairingIntelligence.jsx';
import PointsProgression from '../components/PointsProgression.jsx';
import HeatMap from '../components/HeatMap.jsx';
import HeadToHead from '../components/HeadToHead.jsx';
import PerformanceAnalysis from '../components/PerformanceAnalysis.jsx';
import CustomFieldsEditor from '../components/CustomFieldsEditor.jsx';
import { exportStandingsPDF, exportPairingsPDF, exportCrosstablePDF, exportTournamentReportPDF, exportPGN, exportPlayersCSV, exportStandingsCSV, exportPairingsCSV } from '../utils/exportUtils.js';

const RESULT_OPTIONS = ['-', '1', '0', '=', 'U', 'F', 'H', 'Z'];

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [standings, setStandings] = useState(null);
  const [crosstab, setCrosstab] = useState(null);
  const [overview, setOverview] = useState(null);
  const [progression, setProgression] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('info');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [wallRoundIdx, setWallRoundIdx] = useState(0);
  const standingsRef = useRef(null);
  const autoRefreshRef = useRef(null);

  const load = useCallback(async () => {
    const [t, p, r] = await Promise.all([
      api.getTournament(id), api.listTournamentPlayers(id), api.listRounds(id),
    ]);
    setTournament(t); setPlayers(p); setRounds(r);
  }, [id]);

  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  useEffect(() => {
    if (tab === 'standings' && tournament?.status !== 'finished') {
      autoRefreshRef.current = setInterval(() => {
        api.standings(id).then(setStandings).catch(() => {});
      }, 10000);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [tab, id, tournament?.status]);

  const loadStandings = async () => {
    try { setStandings(await api.standings(id)); } catch (e) { toast.error(e.message); }
  };

  const loadCrosstab = async () => {
    try { setCrosstab(await api.crosstab(id)); } catch (e) { toast.error(e.message); }
  };

  const loadOverview = async () => {
    try { setOverview(await api.overview(id)); } catch (e) { toast.error(e.message); }
  };

  const loadProgression = async () => {
    try {
      const data = await api.progression(id);
      setProgression(data);
      setHeatmap(data);
    } catch (e) { toast.error(e.message); }
  };

  const handleGenerate = async () => {
    try {
      await api.generateRound(id);
      toast.success('Ronda generada');
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const handleResult = async (rid, pairingId, result) => {
    try { await api.setResult(rid, pairingId, result); } catch (e) { toast.error(e.message); }
  };

  const handleClose = async (rid) => {
    try {
      await api.closeRound(rid);
      toast.success('Ronda cerrada');
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const handlePublish = async (rid) => {
    try { await api.publishRound(rid); toast.success('Ronda publicada'); await load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleAddPairing = async (rid, data) => {
    try { await api.addPairing(id, rid, data); toast.success('Pairing añadido'); await load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleDeletePairing = async (pid) => {
    try { await api.deletePairing(pid); toast.success('Pairing eliminado'); await load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleSwapColors = async (pid) => {
    try { await api.swapPairingColors(pid); toast.success('Colores intercambiados'); await load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleTrf = async () => {
    try {
      const trf = await api.exportTrf(id);
      const blob = new Blob([trf], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${tournament.name.replace(/\s+/g, '_')}.trf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(t('export.trfDownloaded'));
    } catch (e) { toast.error(e.message); }
  };

  const handleFideSubmit = async () => {
    try {
      await api.fideSubmit(id);
      toast.success(t('export.fideSubmitSuccess'));
    } catch (e) { toast.error(e.message || t('export.trfError')); }
  };

  const handleBulletin = async () => {
    try {
      const html = await api.bulletin(id);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${tournament.name.replace(/\s+/g, '_')}_boletin.html`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(t('export.bulletinGenerated'));
    } catch (e) { toast.error(e.message); }
  };

  const handleFinish = async () => {
    try {
      await api.updateTournament(id, { status: 'finished' });
      toast.success('Torneo finalizado');
      await load();
    } catch (e) { toast.error(e.message); }
    setConfirmFinish(false);
  };

  if (error) return <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">{error}</div>;
  if (!tournament) return <CardSkeleton />;

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-3">
        <div>
          <button onClick={() => navigate('/')} className="text-sm text-fide-500 hover:underline mb-1 inline-block">&larr; {t('nav.tournaments')}</button>
          <h1 className="text-2xl font-bold dark:text-white">{tournament.name}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500 dark:text-fide-300">
            <span>{tournament.system}</span><span>{t('tournament.roundsCount', { n: tournament.n_rounds })}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tournament.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : tournament.status === 'finished' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-fide-700 dark:text-fide-200'}`}>{tournament.status}</span>
            {tournament.federation && <span>{tournament.federation}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <a href={`/public/tournament/${id}/tv`} target="_blank" rel="noopener noreferrer" title={t('tv.viewTV')}
            className="border dark:border-fide-600 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            {t('tv.tv')}
          </a>
          <QRCode url={`${window.location.origin}/public/tournament/${id}`} />
          <button onClick={() => { const url = `${window.location.origin}/public/tournament/${id}`; navigator.clipboard.writeText(url); toast.success(t('export.linkCopied')); }} title={t('common.link')} className="border dark:border-fide-600 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition">🔗</button>
          <ExportMenu tournament={tournament} rounds={rounds} standings={standings} players={players} crosstab={crosstab} onExportTrf={handleTrf} onBulletin={handleBulletin} />
          <button onClick={handleFideSubmit} title={t('export.fideSubmit')}
            className="border dark:border-fide-600 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition flex items-center gap-1">
            <span>{t('export.fideSubmit')}</span>
          </button>
          {tournament.status !== 'finished' && (
            <button onClick={() => setConfirmFinish(true)} title={t('rounds.close')} className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">{t('rounds.close')}</button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b dark:border-fide-700 mb-6 overflow-x-auto">
        {[
          { key: 'info', label: t('tournament.info') },
          { key: 'players', label: `${t('tournament.players')} (${players.length})` },
          { key: 'registrations', label: t('registrationsTab.title', 'Solicitudes') },
          { key: 'teams', label: t('teamsTab.title', 'Equipos') },
          { key: 'rounds', label: `${t('tournament.rounds')} (${rounds.length})` },
          { key: 'standings', label: t('tournament.standings') },
          { key: 'crosstab', label: t('tv.crosstab') },
          { key: 'wall', label: t('tv.wall') },
          { key: 'schedule', label: t('stats.schedule') },
          { key: 'settings', label: t('settings.title') },
          { key: 'intel', label: t('stats.intel') },
          { key: 'heatmap', label: t('stats.heatmap') },
          { key: 'progression', label: t('stats.progression') },
          { key: 'h2h', label: t('stats.h2h') },
          { key: 'performance', label: t('stats.performance') },
          { key: 'stats', label: t('stats.title') },
        ].map((tabItem) => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key)} className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition ${tab === tabItem.key ? 'border-fide-700 text-fide-700 dark:text-fide-200 dark:border-fide-200' : 'border-transparent text-gray-500 dark:text-fide-400 hover:text-gray-700 dark:hover:text-fide-200'}`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'info' && <InfoTab tournament={tournament} />}
        {tab === 'players' && <PlayersTab tournamentId={id} players={players} onUpdate={load} />}
        {tab === 'registrations' && <RegistrationsTab tournamentId={id} />}
        {tab === 'teams' && <TeamsTab tournamentId={id} players={players} />}
        {tab === 'rounds' && <RoundsTab tournament={tournament} rounds={rounds} players={players} onGenerate={handleGenerate} onResult={handleResult} onClose={handleClose} onPublish={handlePublish} onAddPairing={handleAddPairing} onDeletePairing={handleDeletePairing} onSwapColors={handleSwapColors} />}
        {tab === 'standings' && <StandingsTab standings={standings} onLoad={loadStandings} autoRefresh={tournament?.status !== 'finished'} />}
        {tab === 'schedule' && <ScheduleTab tournament={tournament} rounds={rounds} onUpdate={load} />}
        {tab === 'settings' && <SettingsTab tournament={tournament} onUpdate={load} />}
        {tab === 'intel' && <PairingIntelligence tournamentId={id} />}
        {tab === 'progression' && <ProgressionTab onLoad={loadProgression} data={progression} />}
        {tab === 'heatmap' && <HeatmapTab onLoad={loadProgression} data={heatmap} />}
        {tab === 'h2h' && <HeadToHead tournamentId={id} players={players} />}
        {tab === 'performance' && (
          <div>
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={() => window.open(`/stats/${id}/rating-report`, '_blank')}
                className="bg-fide-700 hover:bg-fide-600 text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1">
                {t('export.viewFideReport')}
              </button>
            </div>
            <PerformanceAnalysis tournamentId={id} />
          </div>
        )}
      </div>
      <div className="tab-content">
        {tab === 'crosstab' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={loadCrosstab} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">{t('stats.loadCrosstab')}</button>
            </div>
            <CrossTable data={crosstab} loading={false} />
          </div>
        )}
        {tab === 'wall' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <select value={wallRoundIdx} onChange={(e) => setWallRoundIdx(parseInt(e.target.value))}
                className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none">
                {rounds.map((r, i) => <option key={r.id} value={i}>{t('tournament.round')} {r.round_number}</option>)}
              </select>
            </div>
            <BoardWall rounds={rounds} currentRoundIndex={wallRoundIdx} onResult={handleResult} />
          </div>
        )}
        {tab === 'stats' && (
          <div>
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={loadOverview} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">{t('stats.load')}</button>
              <button onClick={() => window.open(`/stats/${id}/rating-report?format=xml`, '_blank')}
                className="bg-fide-700 hover:bg-fide-600 text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t('export.fideReport')}
              </button>
            </div>
            <StatsDashboard data={overview} loading={false} />
          </div>
        )}
      </div>

      <ConfirmModal open={confirmFinish} title={t('rounds.close')} message="¿Estás seguro de finalizar este torneo? No se podrán generar más rondas." confirmLabel={t('common.confirm')} variant="primary" onConfirm={handleFinish} onCancel={() => setConfirmFinish(false)} />
    </div>
  );
}

/* ── Info Tab ── */
function InfoTab({ tournament }) {
  const { t } = useI18n();
  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {[[t('tournament.system'), tournament.system], [t('tournament.rounds'), tournament.n_rounds], [t('tournament.federation'), tournament.federation || '-'], [t('tournament.timeControl'), tournament.time_control], [t('tournament.status'), tournament.status], [t('tournament.created'), tournament.created_at?.slice(0, 10)]].map(([label, value]) => (
          <div key={label}><dt className="text-gray-500 dark:text-fide-400">{label}</dt><dd className="font-medium dark:text-white capitalize">{value}</dd></div>
        ))}
        {tournament.description && <div className="sm:col-span-2"><dt className="text-gray-500 dark:text-fide-400">{t('tournament.description')}</dt><dd className="font-medium dark:text-white">{tournament.description}</dd></div>}
      </dl>
    </div>
  );
}

/* ── Players Tab ── */
function PlayersTab({ tournamentId, players, onUpdate }) {
  const regUrl = `${window.location.origin}/public/tournament/${tournamentId}/register`;
  const { toast } = useToast();
  const { t } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [fideQuery, setFideQuery] = useState('');
  const [fideIdInput, setFideIdInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [fideResults, setFideResults] = useState([]);
  const [form, setForm] = useState({ fide_id: '', name: '', last_name: '', fide_rating: '', federation: '' });
  const [localPlayers, setLocalPlayers] = useState(players);
  const [tournamentData, setTournamentData] = useState(null);

  useEffect(() => { setLocalPlayers(players); }, [players]);
  useEffect(() => { api.getTournament(tournamentId).then(setTournamentData).catch(() => {}); }, [tournamentId]);

  const searchLocal = async () => {
    if (query.length < 2) return;
    try { setSearchResults(await api.searchPlayers(query)); } catch {}
  };

  const searchFide = async () => {
    if (fideQuery.length < 2) return;
    try { const r = await api.fideSearch(fideQuery); setFideResults(Array.isArray(r) ? r : []); } catch (e) { toast.error(e.message); }
  };

  const fideImportById = async () => {
    const fid = fideIdInput.trim();
    if (!fid || !/^\d+$/.test(fid)) return toast.error('Ingresa un FIDE ID numérico');
    setFideIdInput('');
    await fideImportAndEnroll(fid);
  };

  const enroll = async (playerId) => {
    try { await api.enrollPlayer(tournamentId, playerId, players.length + 1); setShowAdd(false); toast.success(t('playersTab.playerEnrolled')); onUpdate(); }
    catch (e) { toast.error(e.message); }
  };

  const createAndEnroll = async () => {
    try { const p = await api.createPlayer(form); await api.enrollPlayer(tournamentId, p.id, players.length + 1); setShowAdd(false); toast.success(t('playersTab.playerCreated')); onUpdate(); }
    catch (e) { toast.error(e.message); }
  };

  const fideImportAndEnroll = async (fideId) => {
    try { const p = await api.fideImport(fideId); await api.enrollPlayer(tournamentId, p.id, players.length + 1); setShowAdd(false); toast.success(t('playersTab.fideImportSuccess')); onUpdate(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold dark:text-white">{t('playersTab.title', { n: players.length })}</h2>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(regUrl); toast.success(t('playersTab.linkCopied')); }} className="border dark:border-fide-600 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition">{t('playersTab.publicLink')}</button>
          <button onClick={() => setShowAdd(!showAdd)} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">{showAdd ? t('playersTab.cancelLabel') : t('playersTab.addPlayer')}</button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 mb-6 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block dark:text-fide-200">{t('playersTab.searchExisting')}</label>
            <div className="flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchLocal()} placeholder={t('playersTab.searchPlaceholder')} className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
              <button onClick={searchLocal} className="bg-gray-200 dark:bg-fide-600 dark:text-white hover:bg-gray-300 px-3 rounded-lg text-sm">{t('playersTab.search')}</button>
            </div>
            {searchResults.players?.length > 0 && (
              <ul className="mt-2 border dark:border-fide-600 rounded-lg divide-y dark:divide-fide-600 max-h-40 overflow-y-auto">{[...searchResults.players].slice(0, 10).map((p) => (
                <li key={p.id} className="flex justify-between items-center px-3 py-2 text-sm dark:text-fide-200"><span>{p.name} {p.last_name} ({p.fide_rating || '-'})</span><button onClick={() => enroll(p.id)} className="text-fide-600 hover:underline text-xs">{t('playersTab.enroll')}</button></li>
              ))}</ul>
            )}
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">♛</span>
              <span className="text-sm font-semibold dark:text-yellow-200">{t('playersTab.importFide')}</span>
            </div>
            <div>
              <label className="text-[11px] text-fide-400 mb-1 block">Buscar por nombre en FIDE</label>
              <div className="flex gap-2">
                <input value={fideQuery} onChange={(e) => setFideQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchFide()} placeholder="Ej: Carlsen, Magnus" className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500" />
                <button onClick={searchFide} className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 rounded-lg text-sm font-medium whitespace-nowrap">Buscar</button>
              </div>
              {fideResults.length > 0 && (
                <ul className="mt-2 border dark:border-fide-600 rounded-lg divide-y dark:divide-fide-600 max-h-40 overflow-y-auto bg-white dark:bg-fide-700">{[...fideResults].slice(0, 10).map((p) => (
                  <li key={p.fide_id} className="flex justify-between items-center px-3 py-2 text-sm dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-600">
                    <span>{p.name} {p.last_name} ({p.rating}) <span className="text-fide-400">{p.federation}</span></span>
                    <button onClick={() => fideImportAndEnroll(p.fide_id)} className="text-yellow-700 dark:text-yellow-300 hover:underline text-xs font-medium">Importar</button>
                  </li>
                ))}</ul>
              )}
            </div>
            <div className="border-t border-yellow-200/30 dark:border-yellow-700/30 pt-2">
              <label className="text-[11px] text-fide-400 mb-1 block">Importar directo por FIDE ID (más rápido)</label>
              <div className="flex gap-2">
                <input value={fideIdInput} onChange={(e) => setFideIdInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fideImportById()} placeholder="Ej: 1503014" className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500 font-mono" />
                <button onClick={fideImportById} disabled={!fideIdInput.trim()} className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white px-3 rounded-lg text-sm font-medium whitespace-nowrap">Importar</button>
              </div>
            </div>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-fide-600 dark:text-fide-300 font-medium">{t('playersTab.createManual')}</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <input placeholder={t('playersTab.fideId')} value={form.fide_id} onChange={(e) => setForm({ ...form, fide_id: e.target.value })} className="border dark:border-fide-600 rounded px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
              <input placeholder={`${t('playersTab.name')} *`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border dark:border-fide-600 rounded px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
              <input placeholder={t('playersTab.lastName')} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="border dark:border-fide-600 rounded px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
              <input placeholder={t('playersTab.fideRating')} type="number" value={form.fide_rating} onChange={(e) => setForm({ ...form, fide_rating: e.target.value })} className="border dark:border-fide-600 rounded px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
              <input placeholder={t('playersTab.federation')} value={form.federation} onChange={(e) => setForm({ ...form, federation: e.target.value })} className="border dark:border-fide-600 rounded px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
              <button onClick={createAndEnroll} className="bg-fide-100 dark:bg-fide-600 text-fide-800 dark:text-white px-3 py-2 rounded text-sm font-medium hover:bg-fide-200 dark:hover:bg-fide-500">{t('playersTab.createAndEnroll')}</button>
            </div>
          </details>
          <div className="pt-2 border-t dark:border-fide-700 space-y-4">
            <BulkImportFide onImport={onUpdate} />
            <ImportPlayers tournamentId={tournamentId} onImport={onUpdate} />
          </div>
        </div>
      )}

      {localPlayers.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-fide-400"><p>{t('playersTab.noPlayers')}</p></div>
      ) : (
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl overflow-hidden shadow-sm">
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-fide-900 text-gray-600 dark:text-fide-300">
                <tr><th className="text-left px-4 py-2 font-medium">{t('playersTab.seed')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.name')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.title')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.rating')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.fed')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.category')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.pts')}</th></tr>
              </thead>
              <tbody className="divide-y dark:divide-fide-700">
                {localPlayers.map((p) => {
                  const cats = tournamentData?.categories || [];
                  const currentCat = p.category || '';
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200">
                      <td className="px-4 py-2 text-gray-500 dark:text-fide-400">{p.seed_rank}</td>
                      <td className="px-4 py-2 font-medium">{p.name} {p.last_name}</td>
                      <td className="px-4 py-2">{p.title || '-'}</td>
                      <td className="px-4 py-2">{p.fide_rating || '-'}</td>
                      <td className="px-4 py-2">{p.federation || '-'}</td>
                      <td className="px-4 py-2">
                        <select value={currentCat} onChange={async (e) => {
                          const cat = e.target.value;
                          try { await api.category(tournamentId, p.id, cat); setLocalPlayers((prev) => prev.map((pp) => pp.id === p.id ? { ...pp, category: cat } : pp)); toast.success(t('playersTab.categoryUpdated')); } catch (ex) { toast.error(ex.message); }
                        }} className="text-xs bg-gray-50 dark:bg-fide-700 border dark:border-fide-600 rounded px-1.5 py-0.5 dark:text-white outline-none">
                          <option value="">{t('playersTab.noCategory')}</option>
                          {cats.map((c) => <option key={c} value={c} selected={currentCat === c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 font-mono">{p.current_points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Rounds Tab ── */
function RoundsTab({ tournament, rounds, players, onGenerate, onResult, onClose, onPublish, onAddPairing, onDeletePairing, onSwapColors }) {
  const { t } = useI18n();
  const canGenerate = tournament.status !== 'finished' && rounds.length < tournament.n_rounds;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold dark:text-white">{t('rounds.title')} ({rounds.length}/{tournament.n_rounds})</h2>
        {canGenerate && (
          <button onClick={onGenerate} className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            {t('rounds.generate', { n: rounds.length + 1 })}
          </button>
        )}
      </div>
      {rounds.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-fide-400"><p>{t('rounds.noRounds')}</p></div>
      ) : (
        <div className="space-y-6">
          {rounds.map((round) => (
            <RoundCard key={round.id} round={round} tournamentId={tournament.id} players={tournament.players || []}
              onResult={onResult} onClose={onClose} onPublish={onPublish}
              onAddPairing={onAddPairing} onDeletePairing={onDeletePairing} onSwapColors={onSwapColors} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundCard({ round, tournamentId, players, onResult, onClose, onPublish, onAddPairing, onDeletePairing, onSwapColors }) {
  const { t } = useI18n();
  const isOpen = round.status === 'generated' || round.status === 'published';
  const allResultsIn = round.pairings?.length > 0 && round.pairings.every((p) => p.result !== '-');
  const [editing, setEditing] = useState(false);
  const [newWhite, setNewWhite] = useState('');
  const [newBlack, setNewBlack] = useState('');
  const { toast } = useToast();

  const handleResultChange = (pairingId, result) => {
    onResult(round.id, pairingId, result);
  };

  const handleAdd = () => {
    if (!newWhite) return toast.error('Selecciona jugador de blancas');
    onAddPairing(round.id, { white_id: parseInt(newWhite), black_id: newBlack ? parseInt(newBlack) : null });
    setNewWhite(''); setNewBlack('');
  };

  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <h3 className="font-semibold dark:text-white flex items-center gap-2">
          {t('rounds.round')} {round.round_number}
          {isOpen && (
            <button onClick={() => setEditing(!editing)} className={`text-xs px-2 py-0.5 rounded font-medium transition ${editing ? 'bg-fide-700 text-white' : 'bg-gray-100 dark:bg-fide-700 text-gray-600 dark:text-fide-300'}`}>
              {editing ? t('common.done') : t('rounds.edit')}
            </button>
          )}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {round.status === 'generated' && (
            <button onClick={() => onPublish(round.id)} className="bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded text-xs font-medium transition">{t('rounds.publish')}</button>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${round.status === 'closed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'}`}>{round.status === 'closed' ? t('rounds.closed') : t('rounds.opened')}</span>
          {isOpen && allResultsIn && (
            <button onClick={() => onClose(round.id)} className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1 rounded text-xs font-medium transition">{t('rounds.close')}</button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-fide-900 rounded-lg border dark:border-fide-700">
          <div className="text-xs font-medium text-gray-600 dark:text-fide-300 mb-2">{t('rounds.addPairing')}</div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">{t('rounds.white')}</label>
              <select value={newWhite} onChange={(e) => setNewWhite(e.target.value)} className="border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white">
                <option value="">{t('common.select')}</option>
                {(players || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.last_name} ({p.fide_rating || '-'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">{t('rounds.black')}</label>
              <select value={newBlack} onChange={(e) => setNewBlack(e.target.value)} className="border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white">
                <option value="">{t('rounds.bye')}</option>
                {(players || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.last_name} ({p.fide_rating || '-'})</option>
                ))}
              </select>
            </div>
            <button onClick={handleAdd} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">{t('rounds.add')}</button>
          </div>
        </div>
      )}

      {(!round.pairings || round.pairings.length === 0) ? (
        <p className="text-sm text-gray-400 dark:text-fide-400 text-center py-4">{t('rounds.noPairings')}</p>
      ) : (
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead className="text-gray-500 dark:text-fide-400">
              <tr>
                <th className="text-left px-2 py-1 font-medium w-10">{t('rounds.board')}</th>
                <th className="text-left px-2 py-1 font-medium">{t('rounds.white')}</th>
                <th className="text-center px-2 py-1 font-medium w-24">{t('rounds.result')}</th>
                <th className="text-left px-2 py-1 font-medium">{t('rounds.black')}</th>
                {editing && <th className="text-center px-2 py-1 font-medium w-20">{t('rounds.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-fide-700">
              {round.pairings.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200">
                  <td className="px-2 py-2 text-gray-500 dark:text-fide-400">{p.board}</td>
                  <td className="px-2 py-2 font-medium whitespace-nowrap">{p.white_name}{p.white_last ? ` ${p.white_last}` : ''}{p.white_rating ? ` (${p.white_rating})` : ''}</td>
                  <td className="px-2 py-2 text-center">
                    {isOpen ? (
                      <select value={p.result} onChange={(e) => handleResultChange(p.id, e.target.value)} className="border dark:border-fide-600 rounded px-2 py-1 text-xs font-mono text-center bg-white dark:bg-fide-700 dark:text-white">
                        {RESULT_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className="font-mono font-bold text-lg">{p.result}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {p.is_bye ? <span className="text-gray-400 italic">{t('arbiter.bye')}</span> : <span className="font-medium">{p.black_name}{p.black_last ? ` ${p.black_last}` : ''}{p.black_rating ? ` (${p.black_rating})` : ''}</span>}
                  </td>
                  {editing && (
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {!p.is_bye && p.black_id && (
                          <button onClick={() => onSwapColors(p.id)} className="text-xs text-fide-600 hover:text-fide-800 dark:text-fide-400 dark:hover:text-fide-200" title={t('rounds.swapColors')}>⇄</button>
                        )}
                        <button onClick={() => onDeletePairing(p.id)} className="text-xs text-red-500 hover:text-red-700" title={t('rounds.delete')}>✕</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Standings Tab ── */
function StandingsTab({ standings, onLoad, autoRefresh }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold dark:text-white">{t('standings.title')}</h2>
        <div className="flex items-center gap-2">
          {autoRefresh && <span className="text-[10px] text-green-600 dark:text-green-400 animate-pulse">{t('standings.live')}</span>}
          <button onClick={onLoad} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">{t('standings.refresh')}</button>
        </div>
      </div>
      {!standings ? (
        <div className="text-center py-12 text-gray-400 dark:text-fide-400"><p>{t('standings.clickToLoad')}</p></div>
      ) : standings.standings.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-fide-400"><p>{t('standings.noData')}</p></div>
      ) : (
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl overflow-hidden shadow-sm">
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-fide-900 text-gray-600 dark:text-fide-300">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">{t('standings.pos')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('standings.player')}</th>
                  <th className="text-center px-4 py-2 font-medium">{t('standings.elo')}</th>
                  <th className="text-center px-4 py-2 font-medium">{t('player.ratingChange')}</th>
                  <th className="text-center px-4 py-2 font-medium">{t('standings.pts')}</th>
                  {standings.tiebreaks?.map((tb) => <th key={tb} className="text-center px-3 py-2 font-medium text-xs">{tb}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-fide-700">
                {standings.standings.map((s) => {
                  const isTop3 = s.position <= 3;
                  const rc = s.ratingChange ?? 0;
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 ${isTop3 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                      <td className={`px-4 py-2 font-bold ${isTop3 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-fide-400'}`}>
                        {s.position === 1 ? '🥇' : s.position === 2 ? '🥈' : s.position === 3 ? '🥉' : s.position}
                      </td>
                      <td className="px-4 py-2 font-medium">{s.name} {s.lastName}{s.title ? <span className="text-fide-500 text-xs ml-1">{s.title}</span> : ''}</td>
                      <td className="px-4 py-2 text-center text-gray-500 dark:text-fide-400">{s.fideRating || '-'}</td>
                      <td className={`px-4 py-2 text-center font-mono text-sm font-medium ${rc > 0 ? 'text-green-600 dark:text-green-400' : rc < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>{rc > 0 ? '+' : ''}{rc}</td>
                      <td className="px-4 py-2 text-center font-bold font-mono text-lg">{s.points}</td>
                      {s.tiebreakValues?.map((tv, i) => <td key={i} className="px-3 py-2 text-center font-mono text-gray-600 dark:text-fide-300">{typeof tv === 'number' ? tv.toFixed(2) : tv}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Settings Tab ── */
function SettingsTab({ tournament, onUpdate }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [primary, setPrimary] = useState(tournament.primary_color || '#f59e0b');
  const [secondary, setSecondary] = useState(tournament.secondary_color || '#1f2937');
  const [logo, setLogo] = useState(tournament.logo_url || '');
  const [streamUrl, setStreamUrl] = useState(tournament.stream_url || '');
  const [streamPlatform, setStreamPlatform] = useState(tournament.stream_platform || '');
  const [categoriesStr, setCategoriesStr] = useState((tournament.categories || []).join(', '));
  const [regFee, setRegFee] = useState(tournament.registration_fee || 0);
  const [regCurrency, setRegCurrency] = useState(tournament.registration_currency || 'usd');
  const [autoApprove, setAutoApprove] = useState(tournament.auto_approve ? true : false);
  const [customFields, setCustomFields] = useState(() => {
    try { return JSON.parse(tournament.custom_fields || '[]'); } catch { return []; }
  });
  const [arbiters, setArbiters] = useState([]);
  const [newArbiterEmail, setNewArbiterEmail] = useState('');

  useEffect(() => {
    api.arbiter.listArbiters(tournament.id).then(setArbiters).catch(() => {});
  }, [tournament.id]);

  const addArbiter = async () => {
    if (!newArbiterEmail.trim()) return;
    try {
      const users = await api.arbiter.searchUsers(newArbiterEmail);
      if (!users || users.length === 0) { toast.error('Usuario no encontrado'); return; }
      const user = users[0];
      await api.arbiter.addArbiter(tournament.id, user.id);
      toast.success(`Árbitro añadido: ${user.name}`);
      setArbiters(await api.arbiter.listArbiters(tournament.id));
      setNewArbiterEmail('');
    } catch (e) { toast.error(e.message); }
  };

  const removeArbiter = async (userId) => {
    try {
      await api.arbiter.removeArbiter(tournament.id, userId);
      toast.success('Árbitro eliminado');
      setArbiters(await api.arbiter.listArbiters(tournament.id));
    } catch (e) { toast.error(e.message); }
  };

  const handleSave = async () => {
    try {
      const cats = categoriesStr.split(',').map((c) => c.trim()).filter(Boolean).join(',');
      await api.updateTournament(tournament.id, {
        primary_color: primary, secondary_color: secondary, logo_url: logo,
        stream_url: streamUrl, stream_platform: streamPlatform, categories: cats,
        registration_fee: parseInt(regFee) || 0, registration_currency: regCurrency,
        auto_approve: autoApprove ? 1 : 0, custom_fields: JSON.stringify(customFields),
      });
      toast.success(t('settings.saved'));
      onUpdate();
    } catch (e) { toast.error(e.message); }
  };

  const handleReset = async () => {
    setPrimary('#f59e0b'); setSecondary('#1f2937'); setLogo(''); setStreamUrl(''); setStreamPlatform(''); setCategoriesStr(''); setRegFee(0); setRegCurrency('usd'); setAutoApprove(false); setCustomFields([]);
    try {
      await api.updateTournament(tournament.id, { primary_color: '#f59e0b', secondary_color: '#1f2937', logo_url: '', stream_url: '', stream_platform: '', categories: '', registration_fee: 0, registration_currency: 'usd', auto_approve: 0, custom_fields: '[]' });
      toast.success(t('settings.resetSuccess'));
      onUpdate();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">{t('settings.logo')}</h3>
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed dark:border-fide-600 flex items-center justify-center overflow-hidden shrink-0 bg-white">
            {logo ? (
              <img src={logo} alt="Logo" className="w-full h-full object-contain" onError={(e) => { e.target.src = ''; }} />
            ) : (
              <span className="text-2xl text-gray-400">♛</span>
            )}
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">{t('settings.logoUrl')}</label>
            <input value={logo} onChange={(e) => setLogo(e.target.value)}
              placeholder={t('settings.logoPlaceholder')}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">{t('settings.colors')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { label: t('settings.primaryColor'), value: primary, onChange: setPrimary },
            { label: t('settings.secondaryColor'), value: secondary, onChange: setSecondary },
          ].map(({ label, value, onChange }) => (
            <div key={label}>
              <label className="text-xs text-gray-500 dark:text-fide-400 mb-2 block">{label}</label>
              <div className="flex items-center gap-3">
                <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border dark:border-fide-600 bg-transparent" />
                <input value={value} onChange={(e) => onChange(e.target.value)}
                  className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 uppercase" maxLength={7} />
                <div className="w-8 h-8 rounded-full border dark:border-fide-600 shrink-0" style={{ background: value }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">{t('settings.liveStream')}</h3>
        <p className="text-xs text-gray-500 dark:text-fide-400 mb-4">{t('settings.streamDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">{t('settings.platform')}</label>
            <select value={streamPlatform} onChange={(e) => setStreamPlatform(e.target.value)}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none">
              <option value="">{t('settings.noStream')}</option>
              <option value="twitch">Twitch</option>
              <option value="youtube">YouTube</option>
              <option value="custom">Custom (iframe)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">
              {streamPlatform === 'twitch' ? t('settings.channelName') : streamPlatform === 'youtube' ? t('settings.videoUrl') : t('settings.streamUrl')}
            </label>
            <input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)}
              placeholder={streamPlatform === 'twitch' ? 'chess_streaming' : 'https://youtube.com/watch?v=...'}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
          </div>
        </div>
        {streamUrl && streamPlatform && (
          <div className="mt-4 rounded-lg overflow-hidden border dark:border-fide-700">
            <StreamPreview platform={streamPlatform} url={streamUrl} />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">{t('settings.categories')}</h3>
        <p className="text-xs text-gray-500 dark:text-fide-400 mb-3">{t('settings.categoriesDesc')}</p>
        <input value={categoriesStr} onChange={(e) => setCategoriesStr(e.target.value)}
          placeholder={t('settings.categoriesPlaceholder')}
          className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
      </div>

      {/* Registration Fee */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">Costo de inscripción</h3>
        <p className="text-xs text-gray-500 dark:text-fide-400 mb-4">Define un costo para la inscripción. Los jugadores pagarán vía Stripe al registrarse.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">Monto (en centavos)</label>
            <input type="number" value={regFee} onChange={(e) => setRegFee(parseInt(e.target.value) || 0)} min={0}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">{(regFee / 100).toFixed(2)} {regCurrency.toUpperCase()}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">Moneda</label>
            <select value={regCurrency} onChange={(e) => setRegCurrency(e.target.value)}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none">
              <option value="usd">USD</option>
              <option value="eur">EUR</option>
              <option value="mxn">MXN</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">Auto-aprobar</label>
            <label className="flex items-center gap-2 text-sm text-gray-300 mt-2">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)}
                className="rounded bg-gray-800 border-gray-700 text-fide-600 focus:ring-fide-500" />
              Aprobar automáticamente al pagar
            </label>
          </div>
        </div>
      </div>

      {/* Custom Fields */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">Campos personalizados</h3>
        <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave}
          className="bg-fide-700 hover:bg-fide-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition">{t('settings.save')}</button>
        <button onClick={handleReset}
          className="border dark:border-fide-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition">{t('settings.reset')}</button>
      </div>

      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">{t('settings.arbiters')}</h3>
        <div className="flex gap-2 mb-3">
          <input value={newArbiterEmail} onChange={(e) => setNewArbiterEmail(e.target.value)}
            placeholder={t('settings.arbiterPlaceholder')}
            className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
          <button onClick={addArbiter}
            className="bg-fide-700 hover:bg-fide-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition">{t('settings.arbiterAdd')}</button>
        </div>
        {arbiters.length > 0 ? (
          <div className="space-y-1">
            {arbiters.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-fide-900 rounded-lg">
                <div>
                  <span className="text-sm font-medium dark:text-white">{a.name}</span>
                  <span className="text-xs text-gray-500 dark:text-fide-400 ml-2">{a.email}</span>
                </div>
                <button onClick={() => removeArbiter(a.id)}
                  className="text-xs text-red-500 hover:text-red-700">{t('settings.arbiterRemove')}</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-fide-400">{t('settings.arbiterNoOne')}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-fide-400 mt-3">
          {t('settings.arbiterHint')}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-fide-900 border dark:border-fide-700 rounded-xl p-4">
        <h4 className="text-xs font-semibold dark:text-fide-300 mb-2">{t('settings.preview')}</h4>
        <div className="rounded-lg overflow-hidden border dark:border-fide-700" style={{ background: secondary }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: `${primary}20` }}>
            {logo ? <img src={logo} alt="" className="w-8 h-8 object-contain rounded" /> : <span style={{ color: primary }} className="text-lg">♛</span>}
            <span className="text-sm font-bold" style={{ color: primary }}>{tournament.name}</span>
          </div>
          <div className="px-4 py-2">
            <span className="text-[10px] text-gray-400">{t('settings.previewHeader')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Schedule Tab ── */
function ScheduleTab({ tournament, rounds, onUpdate }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [local, setLocal] = useState(() => rounds.map((r) => ({ id: r.id, round_number: r.round_number, scheduled_at: r.scheduled_at || '' })));

  useEffect(() => {
    setLocal(rounds.map((r) => ({ id: r.id, round_number: r.round_number, scheduled_at: r.scheduled_at || '' })));
  }, [rounds]);

  const setSched = (rid, val) => {
    setLocal((prev) => prev.map((s) => s.id === rid ? { ...s, scheduled_at: val } : s));
  };

  const save = async (rid) => {
    const s = local.find((s) => s.id === rid);
    try {
      await api.scheduleRound(rid, s.scheduled_at || null);
      toast.success(t('schedule.saved'));
      onUpdate();
    } catch (e) { toast.error(e.message); }
  };

  if (!rounds || rounds.length === 0) return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 text-center text-sm text-gray-500">
      {t('schedule.noRounds')}
    </div>
  );

  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold dark:text-white mb-4">{t('schedule.title')}</h3>
      <div className="space-y-2">
        {local.map((s) => (
          <div key={s.id} className="flex items-center gap-3 bg-gray-50 dark:bg-fide-900 rounded-lg px-4 py-3">
            <span className="text-sm font-medium dark:text-white w-16 shrink-0">{t('schedule.round')} {s.round_number}</span>
            <input type="datetime-local" value={s.scheduled_at ? s.scheduled_at.slice(0, 16) : ''}
              onChange={(e) => setSched(s.id, e.target.value ? e.target.value + ':00' : '')}
              className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
            <button onClick={() => save(s.id)}
              className="bg-fide-700 hover:bg-fide-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0">{t('schedule.save')}</button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-fide-400 mt-4">{t('schedule.saved')}</p>
    </div>
  );
}

/* ── Stream Preview ── */
function StreamPreview({ platform, url }) {
  if (!url || !platform) return null;
  if (platform === 'twitch') {
    const channel = url.replace(/.*twitch\.tv\//, '').split('?')[0];
    return (
      <iframe src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=false`}
        height="200" className="w-full" allowFullScreen />
    );
  }
  if (platform === 'youtube') {
    const videoId = url.includes('youtube.com/watch?v=') ? url.split('v=')[1]?.split('&')[0] : url.includes('youtu.be/') ? url.split('youtu.be/')[1]?.split('?')[0] : url;
    return (
      <iframe src={`https://www.youtube.com/embed/${videoId}`}
        height="200" className="w-full" allowFullScreen />
    );
  }
  return <iframe src={url} height="200" className="w-full" allowFullScreen />;
}

/* ── Progression Tab ── */
function ProgressionTab({ onLoad, data }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={onLoad} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">
          {t('stats.progression')}
        </button>
      </div>
      <PointsProgression data={data} />
    </div>
  );
}

/* ── Heatmap Tab ── */
function HeatmapTab({ onLoad, data }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={onLoad} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">
          {t('stats.heatmap')}
        </button>
      </div>
      <HeatMap data={data} />
    </div>
  );
}

/* ── Export Menu ── */
function ExportMenu({ tournament, rounds, standings, players, crosstab, onExportTrf, onBulletin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { t } = useI18n();

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = [
    { label: `📄 PDF — ${t('standings.title')}`, action: () => { exportStandingsPDF(tournament, standings); setOpen(false); }, disabled: !standings },
    { label: `📄 PDF — ${t('rounds.title')}`, action: () => { exportPairingsPDF(tournament, rounds); setOpen(false); }, disabled: !rounds || rounds.length === 0 },
    { label: `📄 PDF — ${t('tv.crosstab')}`, action: () => { exportCrosstablePDF(tournament, crosstab); setOpen(false); }, disabled: !crosstab || !crosstab.players },
    { label: `📄 PDF — ${t('export.report', 'Reporte Completo')}`, action: () => { exportTournamentReportPDF(tournament, standings, rounds, players, crosstab); setOpen(false); } },
    { type: 'separator' },
    { label: `📋 CSV — ${t('playersTab.title', { n: '' })}`, action: () => { exportPlayersCSV(tournament, players); setOpen(false); } },
    { label: `📋 CSV — ${t('standings.title')}`, action: () => { exportStandingsCSV(tournament, standings); setOpen(false); }, disabled: !standings },
    { label: `📋 CSV — ${t('rounds.title')}`, action: () => { exportPairingsCSV(tournament, rounds); setOpen(false); }, disabled: !rounds || rounds.length === 0 },
    { label: `♟ PGN — ${t('rounds.title')}`, action: () => { exportPGN(tournament, rounds); setOpen(false); }, disabled: !rounds || rounds.length === 0 },
    { type: 'separator' },
    { label: `📄 ${t('export.trf')} — FIDE`, action: () => { onExportTrf(); setOpen(false); } },
    { label: `📰 ${t('export.bulletin')}`, action: () => { onBulletin(); setOpen(false); } },
  ];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        {t('export.title')}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl shadow-xl z-50 py-1 animate-fadeIn">
          {items.map((item, i) => (
            item.type === 'separator' ? (
              <div key={i} className="border-t dark:border-fide-700 my-1" />
            ) : (
              <button key={i} onClick={item.action} disabled={item.disabled}
                className={`w-full text-left px-3.5 py-2 text-xs transition ${item.disabled ? 'text-gray-300 dark:text-fide-600 cursor-not-allowed' : 'text-gray-700 dark:text-fide-200 hover:bg-gray-100 dark:hover:bg-fide-700'}`}>
                {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

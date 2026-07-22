import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import { CardSkeleton } from '../components/Skeleton.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../components/Toast.jsx';
import QRCode from '../components/QRCode.jsx';
import { exportStandingsPDF, exportPairingsPDF, exportCrosstablePDF, exportTournamentReportPDF, exportPGN, exportPlayersCSV, exportStandingsCSV, exportPairingsCSV, exportPlayersXLSX, exportStandingsXLSX, exportPairingsXLSX, exportCrosstableXLSX, exportTournamentReportXLSX, exportPerformanceXLSX, downloadQR, exportInitialListCSV, exportInitialListPDF, exportInitialListXLSX } from '../utils/exportUtils.js';
import RatingCalculator, { calculateChange, getKFactor } from '../components/RatingCalculator.jsx';

const CrossTable = lazy(() => import('../components/CrossTable.jsx'));
const BoardWall = lazy(() => import('../components/BoardWall.jsx'));
const StatsDashboard = lazy(() => import('../components/StatsDashboard.jsx'));
const RegistrationsTab = lazy(() => import('../components/RegistrationsTab.jsx'));
const TeamsTab = lazy(() => import('../components/TeamsTab.jsx'));
const MatchesTab = lazy(() => import('../components/MatchesTab.jsx'));
const BulkImportFide = lazy(() => import('../components/BulkImportFide.jsx'));
const ImportPlayers = lazy(() => import('../components/ImportPlayers.jsx'));
const PairingIntelligence = lazy(() => import('../components/PairingIntelligence.jsx'));
const PointsProgression = lazy(() => import('../components/PointsProgression.jsx'));
const HeatMap = lazy(() => import('../components/HeatMap.jsx'));
const HeadToHead = lazy(() => import('../components/HeadToHead.jsx'));
const PerformanceAnalysis = lazy(() => import('../components/PerformanceAnalysis.jsx'));
const CustomFieldsEditor = lazy(() => import('../components/CustomFieldsEditor.jsx'));

const LazyTab = ({ children }) => <Suspense fallback={<div className="animate-pulse h-32 bg-fide-800/50 rounded-xl" />}>{children}</Suspense>;

const RESULT_OPTIONS = ['-', '1', '0', '=', 'U', 'F', 'H', 'Z'];

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [groups, setGroups] = useState([]);
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
    const [t, p, r, g] = await Promise.all([
      api.getTournament(id), api.listTournamentPlayers(id), api.listRounds(id), api.listGroups(id),
    ]);
    setTournament(t); setPlayers(p); setRounds(r); setGroups(g);
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
          <button onClick={() => navigate('/app/dashboard')} className="text-sm text-fide-500 hover:underline mb-1 inline-block">&larr; {t('nav.tournaments')}</button>
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
          <button onClick={() => window.open(`/fide/report/${id}`, '_blank')} title="Reporte FIDE"
            className="border dark:border-fide-600 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition flex items-center gap-1">
            <span>📋 Reporte FIDE</span>
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
          { key: 'matches', label: 'Matches' },
          { key: 'rounds', label: `${t('tournament.rounds')} (${rounds.length})` },
          { key: 'standings', label: t('tournament.standings') },
          { key: 'groups', label: `Grupos (${groups.length})` },
          { key: 'crosstab', label: t('tv.crosstab') },
          { key: 'wall', label: t('tv.wall') },
          { key: 'schedule', label: t('stats.schedule') },
          { key: 'settings', label: t('settings.title') },
          { key: 'intel', label: t('stats.intel') },
          { key: 'calculator', label: 'Calculadora ELO' },
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
        {tab === 'players' && <PlayersTab tournamentId={id} players={players} groups={groups} onUpdate={load} />}
        {tab === 'registrations' && <LazyTab><RegistrationsTab tournamentId={id} /></LazyTab>}
        {tab === 'teams' && <LazyTab><TeamsTab tournamentId={id} players={players} /></LazyTab>}
        {tab === 'matches' && <LazyTab><MatchesTab tournamentId={id} players={players} teams={teams} /></LazyTab>}
        {tab === 'rounds' && <RoundsTab tournament={tournament} rounds={rounds} players={players} onGenerate={handleGenerate} onResult={handleResult} onClose={handleClose} onPublish={handlePublish} onAddPairing={handleAddPairing} onDeletePairing={handleDeletePairing} onSwapColors={handleSwapColors} />}
        {tab === 'standings' && <StandingsTab standings={standings} onLoad={loadStandings} autoRefresh={tournament?.status !== 'finished'} />}
        {tab === 'groups' && <GroupsTab tournamentId={id} groups={groups} tournament={tournament} onUpdate={load} />}
        {tab === 'schedule' && <ScheduleTab tournament={tournament} rounds={rounds} onUpdate={load} />}
        {tab === 'settings' && <SettingsTab tournament={tournament} onUpdate={load} />}
        { tab === 'intel' && <LazyTab><PairingIntelligence tournamentId={id} /></LazyTab>}
        { tab === 'calculator' && <div className="py-4"><RatingCalculator /></div> }
        { tab === 'progression' && <LazyTab><ProgressionTab onLoad={loadProgression} data={progression} /></LazyTab>}
        {tab === 'heatmap' && <LazyTab><HeatmapTab onLoad={loadProgression} data={heatmap} /></LazyTab>}
        {tab === 'h2h' && <LazyTab><HeadToHead tournamentId={id} players={players} /></LazyTab>}
        {tab === 'performance' && (
          <div>
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={() => window.open(`/stats/${id}/rating-report`, '_blank')}
                className="bg-fide-700 hover:bg-fide-600 text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1">
                {t('export.viewFideReport')}
              </button>
            </div>
            <PerformanceAnalysis tournamentId={id} tournament={tournament} />
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
function PlayersTab({ tournamentId, players, groups, onUpdate }) {
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
  const [sortBy, setSortBy] = useState('seed');
  const [editSeedId, setEditSeedId] = useState(null);
  const [editSeedVal, setEditSeedVal] = useState('');

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
        <div>
          {/* Sort & Reorder toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-gray-500 dark:text-fide-400">Ordenar:</span>
            <button onClick={() => { const sorted = [...localPlayers].sort((a, b) => (a.seed_rank || 0) - (b.seed_rank || 0)); setLocalPlayers(sorted); setSortBy('seed'); }}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition ${sortBy === 'seed' ? 'bg-fide-700 text-white' : 'border dark:border-fide-600 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700'}`}># Seed</button>
            <button onClick={() => { const sorted = [...localPlayers].sort((a, b) => `${a.name} ${a.last_name}`.localeCompare(`${b.name} ${b.last_name}`)); setLocalPlayers(sorted); setSortBy('alpha'); }}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition ${sortBy === 'alpha' ? 'bg-fide-700 text-white' : 'border dark:border-fide-600 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700'}`}>A-Z</button>
            <button onClick={() => { const sorted = [...localPlayers].sort((a, b) => (b.fide_rating || 0) - (a.fide_rating || 0)); setLocalPlayers(sorted); setSortBy('rating'); }}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition ${sortBy === 'rating' ? 'bg-fide-700 text-white' : 'border dark:border-fide-600 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700'}`}>Rating ↓</button>
            <span className="w-px h-4 bg-gray-600 mx-1" />
            <button onClick={async () => {
              const reordered = [...localPlayers].sort((a, b) => (a.seed_rank || 0) - (b.seed_rank || 0));
              for (let i = 0; i < reordered.length; i++) {
                const newSeed = i + 1;
                if (reordered[i].seed_rank !== newSeed) {
                  await api.enrollPlayer(tournamentId, reordered[i].id, newSeed);
                }
              }
              toast.success(`Seed reordenado: ${reordered.length} jugadores`);
              onUpdate();
            }}
              className="text-xs bg-fide-700 hover:bg-fide-800 text-white px-2.5 py-1.5 rounded-lg transition">🔄 Renumerar 1..N</button>
            <button onClick={async () => {
              const reversed = [...localPlayers].reverse();
              for (let i = 0; i < reversed.length; i++) {
                await api.enrollPlayer(tournamentId, reversed[i].id, i + 1);
              }
              toast.success('Orden invertido');
              onUpdate();
            }}
              className="text-xs border dark:border-fide-600 dark:text-fide-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-fide-700 transition">↕ Invertir</button>
          </div>

          <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl overflow-hidden shadow-sm">
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-fide-900 text-gray-600 dark:text-fide-300">
                <tr><th className="text-left px-4 py-2 font-medium">{t('playersTab.seed')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.name')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.title')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.rating')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.fed')}</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.category')}</th><th className="text-left px-4 py-2 font-medium">Grupo</th><th className="text-left px-4 py-2 font-medium">{t('playersTab.pts')}</th><th className="text-center px-4 py-2 font-medium">Acciones</th></tr>
              </thead>
              <tbody className="divide-y dark:divide-fide-700">
                {localPlayers.map((p) => {
                  const cats = tournamentData?.categories || [];
                  const currentCat = p.category || '';
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200">
                      <td className="px-4 py-2">
                        {editSeedId === p.id ? (
                          <input autoFocus type="number" value={editSeedVal}
                            onChange={(e) => setEditSeedVal(e.target.value)}
                            onBlur={async () => {
                              const val = parseInt(editSeedVal);
                              if (val > 0 && val !== p.seed_rank) {
                                await api.enrollPlayer(tournamentId, p.id, val);
                                onUpdate();
                              }
                              setEditSeedId(null);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') { e.target.blur(); }
                              if (e.key === 'Escape') { setEditSeedId(null); }
                            }}
                            className="w-14 border border-fide-500 rounded px-1.5 py-0.5 text-xs font-mono bg-white dark:bg-fide-700 dark:text-white outline-none text-center" />
                        ) : (
                          <span onClick={() => { setEditSeedId(p.id); setEditSeedVal(String(p.seed_rank)); }}
                            className="text-gray-500 dark:text-fide-400 cursor-pointer hover:text-fide-600 dark:hover:text-fide-300 px-1.5 py-0.5 -ml-1.5 rounded hover:bg-gray-100 dark:hover:bg-fide-700 transition">{p.seed_rank}</span>
                        )}
                      </td>
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
                      <td className="px-4 py-2">
                        <select value={p.group_id || ''} onChange={async (e) => {
                          const gid = e.target.value;
                          try { await api.assignGroup(tournamentId, p.id, gid || null); setLocalPlayers((prev) => prev.map((pp) => pp.id === p.id ? { ...pp, group_id: gid || null } : pp)); toast.success('Grupo asignado'); } catch (ex) { toast.error(ex.message); }
                        }} className="text-xs bg-gray-50 dark:bg-fide-700 border dark:border-fide-600 rounded px-1.5 py-0.5 dark:text-white outline-none">
                          <option value="">Sin grupo</option>
                          {groups.map((g) => <option key={g.id} value={g.id} selected={p.group_id === g.id}>{g.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {p.current_points}
                        {p.penalty_points > 0 && <span className="text-[10px] text-red-500 ml-1">(-{p.penalty_points})</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={async () => {
                          const pts = window.prompt(`Penalizar a ${p.name} ${p.last_name} (puntos a deducir, ej: 0.5):`, "0.5");
                          if (!pts || isNaN(pts)) return;
                          try {
                            await api.penalty(tournamentId, p.id, pts);
                            toast.success(`Penalización de ${pts} pts aplicada`);
                            onUpdate();
                          } catch (ex) { toast.error(ex.message); }
                        }} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                          Penalizar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

/* ── Groups Tab ── */
function GroupsTab({ tournamentId, groups, tournament, onUpdate }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', system: tournament?.system || 'dutch', n_rounds: tournament?.n_rounds || 6, time_control: tournament?.time_control || '90+30', tiebreaks: 'BH1,BH,SB,DE,PR' });

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('El nombre del grupo es obligatorio'); return; }
    try {
      await api.createGroup(tournamentId, form);
      toast.success('Grupo creado');
      setShowCreate(false);
      setForm({ name: '', system: tournament?.system || 'dutch', n_rounds: tournament?.n_rounds || 6, time_control: tournament?.time_control || '90+30', tiebreaks: 'BH1,BH,SB,DE,PR' });
      onUpdate();
    } catch (e) { toast.error(e.message); }
  };

  const handleUpdate = async (gid) => {
    try {
      await api.updateGroup(gid, editing);
      toast.success('Grupo actualizado');
      setEditing(null);
      onUpdate();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (gid) => {
    if (!window.confirm('¿Eliminar este grupo? Los jugadores serán desasignados.')) return;
    try { await api.deleteGroup(gid); toast.success('Grupo eliminado'); onUpdate(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold dark:text-white">Grupos / Secciones</h2>
        {tournament?.status === 'pending' && (
          <button onClick={() => setShowCreate(!showCreate)}
            className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">
            {showCreate ? 'Cancelar' : 'Nuevo grupo'}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 shadow-sm space-y-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre del grupo (ej: Masters)"
            className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })}
              className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none">
              <option value="dutch">Suizo Holandés</option>
              <option value="roundrobin">Round Robin</option>
              <option value="burstein">Burstein</option>
              <option value="dubov">Dubov</option>
            </select>
            <input type="number" value={form.n_rounds} onChange={(e) => setForm({ ...form, n_rounds: parseInt(e.target.value) || 6 })}
              placeholder="Rondas" className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
            <input value={form.time_control} onChange={(e) => setForm({ ...form, time_control: e.target.value })}
              placeholder="Control de tiempo" className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
            <input value={form.tiebreaks} onChange={(e) => setForm({ ...form, tiebreaks: e.target.value })}
              placeholder="Desempates" className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
          </div>
          <button onClick={handleCreate}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            Crear grupo
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-fide-400"><p>No hay grupos definidos. Añade grupos como "Masters", "U2000", "Rapid" para organizar el torneo en secciones.</p></div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.id} className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 shadow-sm">
              {editing?.id === g.id ? (
                <div className="space-y-2">
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full border dark:border-fide-600 rounded px-2 py-1 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
                  <select value={editing.system} onChange={(e) => setEditing({ ...editing, system: e.target.value })}
                    className="w-full border dark:border-fide-600 rounded px-2 py-1 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none">
                    <option value="dutch">Suizo Holandés</option><option value="roundrobin">Round Robin</option>
                    <option value="burstein">Burstein</option><option value="dubov">Dubov</option>
                  </select>
                  <div className="flex gap-2">
                    <input type="number" value={editing.n_rounds} onChange={(e) => setEditing({ ...editing, n_rounds: parseInt(e.target.value) || 6 })}
                      className="flex-1 border dark:border-fide-600 rounded px-2 py-1 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
                    <input value={editing.time_control} onChange={(e) => setEditing({ ...editing, time_control: e.target.value })}
                      className="flex-1 border dark:border-fide-600 rounded px-2 py-1 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(g.id)} className="bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded text-xs">Guardar</button>
                    <button onClick={() => setEditing(null)} className="bg-gray-200 dark:bg-fide-600 dark:text-white px-3 py-1 rounded text-xs">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold dark:text-white text-sm">{g.name}</h3>
                    {tournament?.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => setEditing({ id: g.id, name: g.name, system: g.system, n_rounds: g.n_rounds, time_control: g.time_control })}
                          className="text-fide-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => handleDelete(g.id)}
                          className="text-red-600 hover:underline text-xs">Eliminar</button>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-fide-400 space-y-1">
                    <p>Sistema: {g.system} · {g.n_rounds} rondas · {g.time_control}</p>
                    <p>{g.player_count || 0} jugadores</p>
                    <p>Estado: {g.status}</p>
                  </div>
                </>
              )}
            </div>
          ))}
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
              {round.pairings.map((p) => {
                const wr = p.white_rating || 0;
                const br = p.black_rating || 0;
                const kWhite = getKFactor(wr, 100);
                const kBlack = getKFactor(br, 100);
                const exWhiteWin = wr && br ? calculateChange(wr, br, 1, kWhite) : 0;
                const exBlackWin = wr && br ? calculateChange(br, wr, 1, kBlack) : 0;
                const showProj = isOpen && p.result === '-' && wr > 0 && br > 0;
                
                return (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200">
                  <td className="px-2 py-2 text-gray-500 dark:text-fide-400">{p.board}</td>
                  <td className="px-2 py-2 font-medium whitespace-nowrap">
                    <div>{p.white_name}{p.white_last ? ` ${p.white_last}` : ''}{p.white_rating ? ` (${p.white_rating})` : ''}</div>
                    {showProj && <div className="text-[10px] text-green-600 dark:text-green-400 font-mono">Win: +{exWhiteWin}</div>}
                  </td>
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
                    {p.is_bye ? <span className="text-gray-400 italic">{t('arbiter.bye')}</span> : (
                      <div>
                        <span className="font-medium">{p.black_name}{p.black_last ? ` ${p.black_last}` : ''}{p.black_rating ? ` (${p.black_rating})` : ''}</span>
                        {showProj && <div className="text-[10px] text-green-600 dark:text-green-400 font-mono">Win: +{exBlackWin}</div>}
                      </div>
                    )}
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
                );
              })}
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
  const [bannerUrl, setBannerUrl] = useState(tournament.banner_url || '');
  const [streamUrl, setStreamUrl] = useState(tournament.stream_url || '');
  const [streamPlatform, setStreamPlatform] = useState(tournament.stream_platform || '');
  const [categoriesStr, setCategoriesStr] = useState((tournament.categories || []).join(', '));
  const [regFee, setRegFee] = useState(tournament.registration_fee || 0);
  const [regCurrency, setRegCurrency] = useState(tournament.registration_currency || 'usd');
  const [autoApprove, setAutoApprove] = useState(tournament.auto_approve ? true : false);
  const [customFields, setCustomFields] = useState(() => {
    try { return JSON.parse(tournament.custom_fields || '[]'); } catch { return []; }
  });
  const [fideEventId, setFideEventId] = useState(tournament.fide_event_id || '');
  const [fideApproved, setFideApproved] = useState(tournament.fide_approved || 0);
  const [documents, setDocuments] = useState(() => {
    try { return JSON.parse(tournament.documents || '[]'); } catch { return []; }
  });
  const [links, setLinks] = useState(() => {
    try { return JSON.parse(tournament.links || '{}'); } catch { return {}; }
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
        primary_color: primary, secondary_color: secondary, logo_url: logo, banner_url: bannerUrl,
        stream_url: streamUrl, stream_platform: streamPlatform, categories: cats,
        registration_fee: parseInt(regFee) || 0, registration_currency: regCurrency,
        auto_approve: autoApprove ? 1 : 0, custom_fields: JSON.stringify(customFields),
        fide_event_id: fideEventId,
        documents: JSON.stringify(documents),
        links: JSON.stringify(links),
      });
      toast.success(t('settings.saved'));
      onUpdate();
    } catch (e) { toast.error(e.message); }
  };

  const handleReset = async () => {
    setPrimary('#f59e0b'); setSecondary('#1f2937'); setLogo(''); setBannerUrl(''); setStreamUrl(''); setStreamPlatform(''); setCategoriesStr(''); setRegFee(0); setRegCurrency('usd'); setAutoApprove(false); setCustomFields([]); setFideEventId(''); setFideApproved(0); setDocuments([]); setLinks({});
    try {
      await api.updateTournament(tournament.id, { primary_color: '#f59e0b', secondary_color: '#1f2937', logo_url: '', banner_url: '', stream_url: '', stream_platform: '', categories: '', registration_fee: 0, registration_currency: 'usd', auto_approve: 0, custom_fields: '[]', fide_event_id: '', documents: '[]', links: '{}' });
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

        <div className="mt-6 flex items-start gap-4">
          <div className="w-40 h-20 rounded-xl border-2 border-dashed dark:border-fide-600 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50 dark:bg-fide-900">
            {bannerUrl ? (
              <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" onError={(e) => { e.target.src = ''; }} />
            ) : (
              <span className="text-sm text-gray-400">Banner</span>
            )}
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">URL del Banner (Opcional)</label>
            <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://ejemplo.com/banner.jpg"
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
            <p className="text-[10px] text-gray-500 mt-1">Recomendado: 1200x300px. Aparecerá en la página pública del torneo.</p>
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

      {/* FIDE Event ID */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4 flex items-center gap-2">♛ FIDE Event ID</h3>
        <p className="text-xs text-gray-500 dark:text-fide-400 mb-4">
          Ingresa el ID del evento FIDE para que el torneo aparezca vinculado al registro oficial de FIDE.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">FIDE Event ID</label>
            <input value={fideEventId} onChange={(e) => setFideEventId(e.target.value)}
              placeholder="Ej: 123456"
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">Estado FIDE</label>
            <div className="flex items-center gap-2 h-10">
              {fideApproved || tournament.submitted_to_fide ? (
                <span className="inline-flex items-center gap-1 text-xs bg-green-900/40 text-green-400 px-3 py-1.5 rounded-full border border-green-700/50">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {tournament.submitted_to_fide ? 'Enviado a FIDE' : 'Aprobado por FIDE'}
                </span>
              ) : (
                <span className="text-xs text-gray-500">No enviado</span>
              )}
              {fideEventId && (
                <a href={`https://ratings.fide.com/tournament_details.phtml?event=${fideEventId}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-fide-500 hover:underline ml-2">Ver en FIDE ↗</a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Documentos (reglamentos, PDFs) */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4">Documentos</h3>
        <p className="text-xs text-gray-500 dark:text-fide-400 mb-4">Añade enlaces a reglamentos, PDFs, circulares. Se mostrarán en la página pública del torneo.</p>
        <div className="space-y-3">
          {documents.map((doc, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <input value={doc.name} onChange={(e) => {
                  const d = [...documents]; d[i] = { ...d[i], name: e.target.value }; setDocuments(d);
                }} placeholder="Nombre (ej: Reglamento del torneo)"
                  className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
                <input value={doc.url} onChange={(e) => {
                  const d = [...documents]; d[i] = { ...d[i], url: e.target.value }; setDocuments(d);
                }} placeholder="URL del PDF (Google Drive, Dropbox, etc.)"
                  className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none font-mono" />
              </div>
              <button onClick={() => setDocuments(documents.filter((_, j) => j !== i))}
                className="text-red-500 hover:text-red-700 text-xs mt-2 shrink-0">Eliminar</button>
            </div>
          ))}
          <button onClick={() => setDocuments([...documents, { name: '', url: '' }])}
            className="text-fide-600 hover:text-fide-500 text-sm font-medium">+ Añadir documento</button>
        </div>
      </div>

      {/* Enlaces (Redes sociales, web, mapa) */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          Enlaces
        </h3>
        <p className="text-xs text-gray-500 dark:text-fide-400 mb-4">Redes sociales, web del torneo, ubicación en mapa. Se mostrarán en la página pública.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block flex items-center gap-1">
              <span>🌐</span> Sitio web
            </label>
            <input value={links.website || ''} onChange={(e) => setLinks({ ...links, website: e.target.value })}
              placeholder="https://chessorganizers.com"
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block flex items-center gap-1">
              <span>📍</span> Dirección (Google Maps)
            </label>
            <input value={links.location_address || tournament.location_address || ''} onChange={(e) => setLinks({ ...links, location_address: e.target.value })}
              placeholder="Calle, Ciudad, País"
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block flex items-center gap-1">
              <span>📘</span> Facebook
            </label>
            <input value={links.facebook || ''} onChange={(e) => setLinks({ ...links, facebook: e.target.value })}
              placeholder="https://facebook.com/torneo"
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block flex items-center gap-1">
              <span>🐦</span> X (Twitter)
            </label>
            <input value={links.twitter || ''} onChange={(e) => setLinks({ ...links, twitter: e.target.value })}
              placeholder="https://x.com/torneo"
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block flex items-center gap-1">
              <span>📷</span> Instagram
            </label>
            <input value={links.instagram || ''} onChange={(e) => setLinks({ ...links, instagram: e.target.value })}
              placeholder="https://instagram.com/torneo"
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block flex items-center gap-1">
              <span>💬</span> WhatsApp
            </label>
            <input value={links.whatsapp || ''} onChange={(e) => setLinks({ ...links, whatsapp: e.target.value })}
              placeholder="https://wa.me/521234567890"
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 font-mono" />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block flex items-center gap-1">
            <span>📺</span> Streaming (Twitch/YouTube) — configurado en sección "Stream en Vivo"
          </label>
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
  const [local, setLocal] = useState(() => rounds.map((r) => ({ id: r.id, round_number: r.round_number, scheduled_at: r.scheduled_at || '', duration: r.duration || 0 })));
  const [bulkDate, setBulkDate] = useState('');
  const [bulkTime, setBulkTime] = useState('');
  const [bulkInterval, setBulkInterval] = useState(24);
  const [bulkDuration, setBulkDuration] = useState(180);
  const [view, setView] = useState('list');

  useEffect(() => {
    setLocal(rounds.map((r) => ({ id: r.id, round_number: r.round_number, scheduled_at: r.scheduled_at || '', duration: r.duration || 0 })));
  }, [rounds]);

  const setSched = (rid, val) => {
    setLocal((prev) => prev.map((s) => s.id === rid ? { ...s, scheduled_at: val } : s));
  };
  const setDur = (rid, val) => {
    setLocal((prev) => prev.map((s) => s.id === rid ? { ...s, duration: val } : s));
  };

  const save = async (rid) => {
    const s = local.find((s) => s.id === rid);
    try {
      await api.scheduleRound(rid, s.scheduled_at || null, s.duration);
      toast.success(t('schedule.saved'));
      onUpdate();
    } catch (e) { toast.error(e.message); }
  };

  const saveAll = async () => {
    try {
      for (const s of local) {
        await api.scheduleRound(s.id, s.scheduled_at || null, s.duration);
      }
      toast.success('Todos los horarios guardados');
      onUpdate();
    } catch (e) { toast.error(e.message); }
  };

  const applyBulk = () => {
    if (!bulkDate || !bulkTime) { toast.error('Selecciona fecha y hora inicial'); return; }
    const start = new Date(`${bulkDate}T${bulkTime}:00`);
    setLocal((prev) => prev.map((s, i) => {
      const d = new Date(start.getTime() + i * bulkInterval * 3600000);
      return { ...s, scheduled_at: d.toISOString().slice(0, 19).replace('T', ' '), duration: bulkDuration };
    }));
    toast.success(`Horario aplicado: ${rounds.length} rondas cada ${bulkInterval}h`);
  };

  const clearAll = () => {
    setLocal((prev) => prev.map((s) => ({ ...s, scheduled_at: '', duration: 0 })));
  };

  const hasSchedules = local.some((s) => s.scheduled_at);
  const sortedByDate = [...local].filter((s) => s.scheduled_at).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const startDate = sortedByDate.length > 0 ? new Date(sortedByDate[0].scheduled_at) : null;
  const endDate = sortedByDate.length > 0 ? new Date(sortedByDate[sortedByDate.length - 1].scheduled_at) : null;
  const endDateCalc = endDate && sortedByDate[sortedByDate.length - 1].duration > 0
    ? new Date(endDate.getTime() + sortedByDate[sortedByDate.length - 1].duration * 60000) : endDate;

  if (!rounds || rounds.length === 0) return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6 text-center text-sm text-gray-500">
      {t('schedule.noRounds')}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Bulk scheduling panel */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold dark:text-white flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Horario automático
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setView(view === 'list' ? 'calendar' : 'list')}
              className="text-xs border dark:border-fide-600 px-2.5 py-1.5 rounded-lg dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">
              {view === 'list' ? '📅 Vista calendario' : '📋 Vista lista'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">Fecha inicio</label>
            <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">Hora inicio</label>
            <input type="time" value={bulkTime} onChange={(e) => setBulkTime(e.target.value)}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">Intervalo (horas)</label>
            <input type="number" value={bulkInterval} onChange={(e) => setBulkInterval(parseInt(e.target.value) || 24)} min={1}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 mb-1 block">Duración (min)</label>
            <input type="number" value={bulkDuration} onChange={(e) => setBulkDuration(parseInt(e.target.value) || 0)} min={0}
              className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none" />
          </div>
          <div className="flex items-end gap-1">
            <button onClick={applyBulk}
              className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-2 rounded-lg text-xs font-medium transition flex-1">Aplicar</button>
            <button onClick={clearAll}
              className="border dark:border-fide-600 px-3 py-2 rounded-lg text-xs font-medium dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">×</button>
          </div>
        </div>
      </div>

      {/* Schedule list */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl shadow-sm overflow-hidden">
        {view === 'calendar' && hasSchedules ? (
          <div className="p-5">
            <h3 className="text-sm font-semibold dark:text-white mb-3">📅 Calendario de rondas</h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((d) => (
                <div key={d} className="text-gray-500 dark:text-fide-400 font-medium py-1">{d}</div>
              ))}
            </div>
            {(() => {
              const firstDay = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), 1) : new Date();
              const lastDay = endDateCalc ? new Date(endDateCalc.getFullYear(), endDateCalc.getMonth() + 1, 0) : new Date();
              firstDay.setDate(firstDay.getDate() - firstDay.getDay());
              const weeks = [];
              let cursor = new Date(firstDay);
              while (cursor <= lastDay) {
                const week = [];
                for (let d = 0; d < 7; d++) {
                  const dateStr = cursor.toISOString().slice(0, 10);
                  const dayRounds = sortedByDate.filter((s) => s.scheduled_at.slice(0, 10) === dateStr);
                  week.push({ date: new Date(cursor), rounds: dayRounds });
                  cursor.setDate(cursor.getDate() + 1);
                }
                weeks.push(week);
              }
              return weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                  {week.map((day, di) => (
                    <div key={di} className={`rounded-lg p-1.5 min-h-[60px] ${
                      day.date.getMonth() === (startDate || new Date()).getMonth()
                        ? day.rounds.length > 0
                          ? 'bg-fide-700/30 border border-fide-600/50'
                          : 'bg-gray-50 dark:bg-fide-900'
                        : 'opacity-30'
                    }`}>
                      <div className="text-[10px] font-medium dark:text-fide-400">{day.date.getDate()}</div>
                      {day.rounds.map((r) => (
                        <div key={r.id} className="text-[9px] text-fide-300 truncate mt-0.5">
                          R{r.round_number} {r.scheduled_at?.slice(11, 16)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        ) : (
          <div className="divide-y dark:divide-fide-700">
            {local.map((s) => {
              const saved = rounds.find((r) => r.id === s.id);
              const isModified = s.scheduled_at !== (saved?.scheduled_at || '') || s.duration !== (saved?.duration || 0);
              return (
                <div key={s.id} className="flex items-center gap-2 sm:gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-fide-900/50 transition">
                  <span className="text-xs font-bold dark:text-white w-12 shrink-0">R{s.round_number}</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="datetime-local" value={s.scheduled_at ? s.scheduled_at.slice(0, 16) : ''}
                      onChange={(e) => setSched(s.id, e.target.value ? e.target.value + ':00' : '')}
                      className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 w-full" />
                    <div className="flex items-center gap-2">
                      <input type="number" value={s.duration || ''} onChange={(e) => setDur(s.id, parseInt(e.target.value) || 0)}
                        placeholder="Duración (min)" min={0}
                        className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />
                      {s.duration > 0 && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {Math.floor(s.duration / 60)}h{s.duration % 60 > 0 ? ` ${s.duration % 60}m` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Sin guardar" />}
                    <button onClick={() => save(s.id)}
                      className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-2 rounded-lg text-xs font-medium transition">{t('schedule.save')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {hasSchedules && (
          <div className="text-xs text-gray-500 dark:text-fide-400">
            {local.filter((s) => s.scheduled_at).length} rondas programadas
            {startDate && <> · Inicia: {startDate.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })} {startDate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</>}
            {endDateCalc && <> · Termina: {endDateCalc.toLocaleDateString('es', { day: 'numeric', month: 'short' })} {endDateCalc.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</>}
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          {hasSchedules && (
            <button onClick={() => {
              let csv = 'Ronda,Fecha,Hora,Duración (min)\n';
              for (const s of sortedByDate) {
                const d = s.scheduled_at?.slice(0, 10) || '';
                const t = s.scheduled_at?.slice(11, 16) || '';
                csv += `${s.round_number},${d},${t},${s.duration || ''}\n`;
              }
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url;
              a.download = `${tournament.name.replace(/\s+/g, '_')}_horario.csv`;
              a.click(); URL.revokeObjectURL(url);
            }}
              className="text-xs border dark:border-fide-600 px-3 py-2 rounded-lg dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">
              📋 Exportar CSV
            </button>
          )}
          {local.some((s) => s.scheduled_at !== (rounds.find((r) => r.id === s.id)?.scheduled_at || '') || s.duration !== (rounds.find((r) => r.id === s.id)?.duration || 0)) && (
            <button onClick={saveAll}
              className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-xs font-medium transition">
              💾 Guardar todo
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-fide-400">{t('schedule.saved')}</p>
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
    { label: `📋 CSV — ${t('export.initialList')}`, action: () => { exportInitialListCSV(tournament, players); setOpen(false); } },
    { type: 'separator' },
    { label: `📊 XLSX — ${t('standings.title')}`, action: () => { exportStandingsXLSX(tournament, standings); setOpen(false); }, disabled: !standings },
    { label: `📊 XLSX — ${t('playersTab.title', { n: '' })}`, action: () => { exportPlayersXLSX(tournament, players); setOpen(false); } },
    { label: `📊 XLSX — ${t('rounds.title')}`, action: () => { exportPairingsXLSX(tournament, rounds); setOpen(false); }, disabled: !rounds || rounds.length === 0 },
    { label: `📊 XLSX — ${t('tv.crosstab')}`, action: () => { exportCrosstableXLSX(tournament, crosstab); setOpen(false); }, disabled: !crosstab || !crosstab.players },
    { label: `📊 XLSX — ${t('export.reportComplete')}`, action: () => { exportTournamentReportXLSX(tournament, standings, rounds, players, crosstab); setOpen(false); } },
    { label: `📊 XLSX — ${t('export.initialList')}`, action: () => { exportInitialListXLSX(tournament, players); setOpen(false); } },
    { type: 'separator' },
    { label: `🖼️ PDF — ${t('export.initialList')}`, action: () => { exportInitialListPDF(tournament, players); setOpen(false); } },
    { label: `♟ PGN — ${t('rounds.title')}`, action: () => { exportPGN(tournament, rounds); setOpen(false); }, disabled: !rounds || rounds.length === 0 },
    { label: `📱 ${t('export.qrDownload')}`, action: () => { downloadQR(`${window.location.origin}/public/tournament/${tournament.id}`, `${tournament.name.replace(/\s+/g, '_')}_qr.png`); setOpen(false); } },
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

import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/context.jsx';
import { api } from '../api/client.js';
import { useToast } from '../components/Toast.jsx';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export default function PGNScanner({ tournamentId, onGamesImported }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanJobId, setScanJobId] = useState(null);
  const [parsedGames, setParsedGames] = useState([]);
  const [selectedGames, setSelectedGames] = useState(new Set());
  const [exportFormat, setExportFormat] = useState('pgn');
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [scanQuota, setScanQuota] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Fetch scan quota on mount
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const quota = await api.scanQuota();
        setScanQuota(quota);
      } catch (err) {
        console.error('Failed to fetch scan quota:', err);
      }
    };
    fetchQuota();
  }, []);

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) { toast.error(t('scanner.invalidType')); return; }
    if (f.size > MAX_FILE_SIZE) { toast.error(t('scanner.fileTooLarge')); return; }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
    setStep('upload');
  };

  const startScan = async () => {
    if (!file) return;
    
    // Check quota before starting
    if (scanQuota && !scanQuota.can_scan) {
      if (scanQuota.limit === 0) {
        toast.error(t('scanner.planNoScans'));
      } else {
        toast.error(`Límite alcanzado: ${scanQuota.used}/${scanQuota.limit} escaneos este mes`);
      }
      return;
    }

    setStep('processing');
    setProgress(5);
    setStatusMsg(t('scanner.stages.ocr'));

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (tournamentId) formData.append('tournament_id', tournamentId);

      const BASE_URL = (import.meta.env.VITE_API_URL || '').includes('onrender.com') ? '' : (import.meta.env.VITE_API_URL || '');
const uploadRes = await fetch(`${BASE_URL}/scan/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      const jobId = uploadData.job?.id || uploadData.job_id;
      setScanJobId(jobId);
      startPolling(jobId);
    } catch (err) {
      setError(err.message);
      setStep('upload');
      toast.error(err.message);
    }
  };

  const startPolling = (jobId) => {
    const poll = async () => {
      try {
        const res = await api.scan.status(jobId);
        const job = res.job || res;

        setProgress(job.progress || 0);
        setStatusMsg(job.current_step || 'processing');

        if (job.status === 'completed') {
          const result = await api.scan.result(jobId);
          const games = result.games || [];
          setParsedGames(games);
          setSelectedGames(new Set(games.map((_, i) => i)));
          setStep('review');
          toast.success(t('scanner.scanComplete'));
        } else if (job.status === 'failed') {
          setError(job.error_message || t('scanner.scanFailed'));
          setStep('upload');
          toast.error(job.error_message || t('scanner.scanFailed'));
        } else {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        console.error('Poll error:', err);
        setTimeout(poll, 3000);
      }
    };
    poll();
  };

  const handleGameToggle = (index) => {
    const newSet = new Set(selectedGames);
    if (newSet.has(index)) newSet.delete(index); else newSet.add(index);
    setSelectedGames(newSet);
  };

  const handleSelectAll = () => {
    if (selectedGames.size === parsedGames.length) {
      setSelectedGames(new Set());
    } else {
      setSelectedGames(new Set(parsedGames.map((_, i) => i)));
    }
  };

  const handleExport = async () => {
    const gamesToExport = parsedGames.filter((_, i) => selectedGames.has(i));
    if (gamesToExport.length === 0) { toast.error(t('scanner.noGamesSelected')); return; }

    try {
      const blob = await api.scan.export(scanJobId, exportFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scan_${Date.now()}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('scanner.exported', { format: exportFormat.toUpperCase() }));
    } catch (err) {
      toast.error(err.message || t('scanner.exportFailed'));
    }
  };

  const handleImportToTournament = async () => {
    if (!tournamentId) { toast.error(t('scanner.noTournament')); return; }
    const gameIds = parsedGames.filter((_, i) => selectedGames.has(i)).map((_, i) => parsedGames[i]?.id).filter(Boolean);
    if (gameIds.length === 0) { toast.error(t('scanner.noGamesSelected')); return; }

    try {
      const res = await api.scan.importToTournament(scanJobId, tournamentId, gameIds);
      toast.success(t('scanner.imported', { count: res.imported }));
      if (onGamesImported) onGamesImported(res.imported);
      setStep('done');
    } catch (err) {
      toast.error(err.message || t('scanner.importFailed'));
    }
  };

  const reset = () => {
    setStep('upload'); setFile(null); setPreviewUrl(null);
    setParsedGames([]); setScanJobId(null); setSelectedGames(new Set());
    setError(null); setProgress(0);
  };

  if (step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">📸 {t('scanner.title')}</h2>
          <p className="text-gray-500 dark:text-fide-400 mt-1">{t('scanner.subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-8">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
              file ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-fide-300 dark:border-fide-700 hover:border-fide-500'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-500'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('border-amber-500'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-amber-500');
              if (e.dataTransfer.files[0]) handleFileSelect({ target: { files: e.dataTransfer.files } });
            }}
          >
            <input ref={fileInputRef} type="file" accept={ALLOWED_TYPES.join(',')} onChange={handleFileSelect} className="hidden" />
            <div className="text-5xl mb-4">📸</div>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              {file ? t('scanner.fileSelected') : t('scanner.dropOrClick')}
            </p>
            <p className="text-sm text-gray-500 dark:text-fide-400">
              {t('scanner.supportedFormats', { types: 'JPG, PNG, WebP, PDF' })}
            </p>
            {file && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300 font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
            )}
          </div>

          {/* Scan Quota Display */}
          {scanQuota && (
            <div className={`mt-4 p-3 rounded-lg ${
              scanQuota.can_scan 
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' 
                : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
            } border`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={scanQuota.can_scan ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    {scanQuota.can_scan ? '✅' : '🚫'}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {scanQuota.can_scan 
                      ? `Escaneos disponibles: ${scanQuota.remaining}/${scanQuota.limit} (${scanQuota.plan_name})`
                      : scanQuota.limit === 0
                        ? `Tu plan ${scanQuota.plan_name} no incluye escaneos`
                        : `Límite alcanzado: ${scanQuota.used}/${scanQuota.limit} este mes`
                    }
                  </span>
                </div>
                {!scanQuota.can_scan && scanQuota.limit > 0 && (
                  <button 
                    onClick={() => window.location.href = '/pricing'}
                    className="px-3 py-1 text-sm bg-fide-700 hover:bg-fide-800 text-white rounded-lg transition"
                  >
                    Actualizar plan
                  </button>
                )}
              </div>
            </div>
          )}

          {file && (
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={reset} className="px-6 py-3 border dark:border-fide-700 text-gray-700 dark:text-fide-300 rounded-xl font-medium transition">
                Cancelar
              </button>
              <button onClick={startScan} className="px-8 py-3 bg-fide-700 hover:bg-fide-800 text-white rounded-xl font-medium text-lg transition shadow-sm">
                {t('scanner.startScan')}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3 text-center">
          {[
            { icon: '🔍', title: t('scanner.feature.ocr'), desc: t('scanner.feature.ocrDesc') },
            { icon: '🤖', title: t('scanner.feature.ai'), desc: t('scanner.feature.aiDesc') },
            { icon: '♟️', title: t('scanner.feature.validate'), desc: t('scanner.feature.validateDesc') },
          ].map((f, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-fide-800/50 rounded-xl">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{f.title}</h4>
              <p className="text-sm text-gray-500 dark:text-fide-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    const stages = [
      { key: 'ocr', label: t('scanner.stages.ocr'), p: 10 },
      { key: 'llm_parse', label: t('scanner.stages.parsing'), p: 40 },
      { key: 'validation', label: t('scanner.stages.validating'), p: 70 },
      { key: 'saving', label: t('scanner.stages.finalizing'), p: 90 },
      { key: 'completed', label: '¡Completado!', p: 100 },
    ];
    const currentStage = stages.reduce((prev, s) => (progress >= s.p ? s : prev), stages[0]);

    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-6xl mb-6 animate-bounce">🔄</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('scanner.processing')}</h2>
        <p className="text-gray-500 dark:text-fide-400 mb-6">{currentStage.label}</p>

        <div className="w-full max-w-md mx-auto bg-gray-200 dark:bg-fide-700 rounded-full h-4 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-fide-600 h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-6 text-left max-w-md mx-auto space-y-2">
          {stages.map((s) => (
            <div key={s.key} className={`flex items-center gap-2 text-sm ${progress >= s.p ? 'text-emerald-500' : 'text-gray-400 dark:text-fide-500'}`}>
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs shrink-0">
                {progress >= s.p ? '✓' : s.p + '%'}
              </span>
              {s.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'review') {
    const selectedCount = selectedGames.size;

    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">✅ {t('scanner.reviewTitle')}</h2>
            <p className="text-gray-500 dark:text-fide-400">{t('scanner.reviewSubtitle', { count: parsedGames.length })}</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}
              className="px-3 py-2 border dark:border-fide-700 rounded-lg bg-white dark:bg-fide-800 text-sm">
              <option value="pgn">PGN</option>
              <option value="cbv">CBV (ChessBase)</option>
              <option value="trf">TRF (FIDE)</option>
              <option value="json">JSON</option>
            </select>
            <button onClick={handleExport} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition">
              {t('scanner.export')}
            </button>
          </div>
        </div>

        {selectedCount > 0 && tournamentId && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {t('scanner.selectedCount', { count: selectedCount })}
            </span>
            <button onClick={handleImportToTournament} className="px-4 py-2 bg-fide-700 hover:bg-fide-800 text-white rounded-lg font-medium text-sm transition">
              {t('scanner.importToTournament')}
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 dark:bg-fide-900/50 border-b dark:border-fide-700 font-medium text-sm text-gray-500 dark:text-fide-400">
            <div className="col-span-1 flex items-center gap-2">
              <input type="checkbox" checked={selectedGames.size === parsedGames.length && parsedGames.length > 0}
                onChange={handleSelectAll} className="w-4 h-4 rounded border-fide-500" />
              <span>#</span>
            </div>
            <div className="col-span-3">{t('scanner.colWhite')}</div>
            <div className="col-span-3">{t('scanner.colBlack')}</div>
            <div className="col-span-2">{t('scanner.colResult')}</div>
            <div className="col-span-2">{t('scanner.colMoves')}</div>
            <div className="col-span-1">{t('scanner.colConfidence')}</div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {parsedGames.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-fide-400">
                <div className="text-4xl mb-2">📭</div>
                <p>{t('scanner.noGamesFound')}</p>
              </div>
            ) : (
              parsedGames.map((game, index) => (
                <div key={index} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b dark:border-fide-700/50 hover:bg-gray-50 dark:hover:bg-fide-700/50 transition ${selectedGames.has(index) ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                  <div className="col-span-1 flex items-center gap-2">
                    <input type="checkbox" checked={selectedGames.has(index)} onChange={() => handleGameToggle(index)} className="w-4 h-4 rounded border-fide-500" />
                    <span className="text-sm text-gray-500 dark:text-fide-400">{index + 1}</span>
                  </div>
                  <div className="col-span-3 font-medium text-gray-900 dark:text-white truncate">
                    {game.white_name || `${game.white?.name || ''} ${game.white?.lastName || ''}`}
                    {(game.white_rating || game.white?.rating) && <span className="text-xs text-gray-500 ml-1">({game.white_rating || game.white?.rating})</span>}
                  </div>
                  <div className="col-span-3 font-medium text-gray-900 dark:text-white truncate">
                    {game.black_name || `${game.black?.name || ''} ${game.black?.lastName || ''}`}
                    {(game.black_rating || game.black?.rating) && <span className="text-xs text-gray-500 ml-1">({game.black_rating || game.black?.rating})</span>}
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      game.result === '1-0' ? 'bg-green-100 text-green-700' :
                      game.result === '0-1' ? 'bg-red-100 text-red-700' :
                      game.result === '1/2-1/2' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{game.result || '-'}</span>
                  </div>
                  <div className="col-span-2 text-sm text-gray-600 dark:text-fide-300 font-mono truncate">
                    {game.moves?.slice(0, 60)}...
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${(game.confidence || 0) > 0.8 ? 'bg-green-500' : (game.confidence || 0) > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`} />
                      <span className="text-xs text-gray-500 dark:text-fide-400">{((game.confidence || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <button onClick={reset} className="px-6 py-2 border dark:border-fide-700 text-gray-700 dark:text-fide-300 rounded-lg hover:bg-gray-100 dark:hover:bg-fide-800 transition">
            {t('scanner.scanAnother')}
          </button>
          {tournamentId && (
            <button onClick={handleImportToTournament} className="px-6 py-2 bg-fide-700 hover:bg-fide-800 text-white rounded-lg font-medium transition">
              {t('scanner.doneImport')}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('scanner.doneTitle')}</h2>
        <p className="text-gray-500 dark:text-fide-400 mb-6">{t('scanner.doneMessage')}</p>
        <div className="flex justify-center gap-4">
          <button onClick={reset} className="px-6 py-2 bg-fide-700 hover:bg-fide-800 text-white rounded-lg font-medium transition">
            {t('scanner.scanAnother')}
          </button>
          {tournamentId && (
            <button onClick={() => window.location.href = `/app/tournament/${tournamentId}`} className="px-6 py-2 border dark:border-fide-700 text-gray-700 dark:text-fide-300 rounded-lg hover:bg-gray-100 dark:hover:bg-fide-800 transition">
              {t('scanner.goToTournament')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

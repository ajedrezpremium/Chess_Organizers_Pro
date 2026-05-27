import { useState, useRef } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

const FORMATS = [
  { value: 'csv', label: 'CSV (coma)', ext: '.csv' },
  { value: 'tsv', label: 'TSV / Vega', ext: '.tsv' },
  { value: 'trf', label: 'TRF FIDE', ext: '.trf' },
];

const FIELD_OPTIONS = [
  { value: 'name', label: 'Nombre', required: true },
  { value: 'lastName', label: 'Apellido' },
  { value: 'fideRating', label: 'Rating FIDE' },
  { value: 'nationalRating', label: 'Rating Nacional' },
  { value: 'title', label: 'Título' },
  { value: 'federation', label: 'Federación' },
  { value: 'fideId', label: 'FIDE ID' },
  { value: 'birthDate', label: 'Fecha Nac.' },
  { value: 'sex', label: 'Sexo' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'skip', label: '— Ignorar —' },
];

export default function ImportPlayers({ tournamentId, onImport }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [step, setStep] = useState('input'); // input | preview | result
  const [format, setFormat] = useState('csv');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [columnMap, setColumnMap] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(ev.target.result);
      // Auto-detect format from extension
      if (file.name.endsWith('.tsv')) setFormat('tsv');
      else if (file.name.endsWith('.trf')) setFormat('trf');
      else setFormat('csv');
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!text.trim()) { toast.error('Pega o sube un archivo primero'); return; }
    setLoading(true);
    try {
      if (format === 'trf') {
        // TRF preview: just show count
        const lines = text.split('\n').filter((l) => l.startsWith('001 '));
        setPreview({ totalRows: lines.length, isTRF: true });
        setStep('preview');
      } else {
        const data = await api.importPreviewCSV({ csv: text, format });
        setPreview(data);
        // Auto-build column map
        const map = {};
        for (const s of data.columnSuggestions) {
          if (s.suggested && s.suggested !== 'skip') map[s.suggested] = s.header;
        }
        setColumnMap(map);
        setStep('preview');
      }
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      let res;
      if (format === 'trf') {
        res = await api.importTRF(tournamentId, { trf: text });
      } else {
        res = await api.importPlayers(tournamentId, { csv: text, column_map: columnMap, format });
      }
      setResult(res);
      setStep('result');
      if (res.imported > 0) {
        toast.success(`${res.imported} jugadores importados`);
        onImport?.();
      }
      if (res.errors?.length > 0) {
        toast.warning(`${res.errors.length} errores`);
      }
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const reset = () => {
    setStep('input');
    setText('');
    setPreview(null);
    setResult(null);
  };

  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm dark:text-white flex items-center gap-2">
          📥 Importar jugadores
          <span className="text-[10px] text-gray-500 font-normal">desde CSV, TSV (Vega) o TRF</span>
        </h3>
      </div>

      {step === 'input' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {FORMATS.map((f) => (
              <button key={f.value} onClick={() => setFormat(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  format === f.value
                    ? 'bg-fide-700 text-white'
                    : 'bg-gray-100 dark:bg-fide-700 text-gray-600 dark:text-fide-300 hover:bg-gray-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div
            className="border-2 border-dashed border-gray-300 dark:border-fide-600 rounded-xl p-6 text-center cursor-pointer hover:border-fide-500 transition"
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.trf,.txt" onChange={handleFile} className="hidden" />
            <p className="text-sm text-gray-500 dark:text-fide-400">Arrastra un archivo o haz clic para seleccionar</p>
            <p className="text-xs text-gray-400 mt-1">CSV, TSV (Vega) o TRF</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t dark:border-fide-700" /></div>
            <div className="relative flex justify-center"><span className="bg-white dark:bg-fide-800 px-2 text-xs text-gray-400">o pega el contenido</span></div>
          </div>

          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
            placeholder={`name,last_name,rating,federation,fide_id\nMagnus,Carlsen,2830,NOR,1503014\nHikaru,Nakamura,2802,USA,2016192`}
            className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-xs font-mono bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500" />

          <button onClick={handlePreview} disabled={loading || !text.trim()}
            className="bg-fide-700 hover:bg-fide-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition w-full">
            {loading ? 'Analizando...' : 'Previsualizar'}
          </button>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          {preview.isTRF ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-300">TRF detectado</p>
              <p className="text-blue-600 dark:text-blue-400 mt-1">{preview.totalRows} jugadores encontrados</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-500 dark:text-fide-400">
                {preview.totalRows} filas detectadas · {preview.headers.length} columnas
              </div>

              {/* Column mapping */}
              <div className="bg-gray-50 dark:bg-fide-900 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-600 dark:text-fide-300 mb-2">Mapeo de columnas</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {preview.columnSuggestions?.map((s) => (
                    <div key={s.header} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 dark:text-fide-400 w-28 truncate" title={s.header}>{s.header}</span>
                      <span className="text-gray-400">&rarr;</span>
                      <select value={Object.entries(columnMap).find(([, v]) => v === s.header)?.[0] || 'skip'}
                        onChange={(e) => {
                          const newMap = { ...columnMap };
                          // Remove old mapping for this header
                          for (const [k, v] of Object.entries(newMap)) {
                            if (v === s.header) delete newMap[k];
                          }
                          if (e.target.value !== 'skip') newMap[e.target.value] = s.header;
                          setColumnMap(newMap);
                        }}
                        className="flex-1 border dark:border-fide-600 rounded px-2 py-1 text-xs bg-white dark:bg-fide-700 dark:text-white">
                        {FIELD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {s.confidence === 'high' && <span className="text-green-500 text-[10px]">✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample rows */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 dark:text-fide-400">
                      {preview.headers?.map((h) => <th key={h} className="text-left px-2 py-1 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-fide-700">
                    {preview.sample?.map((row, i) => (
                      <tr key={i} className="dark:text-fide-200">
                        {preview.headers.map((h) => (
                          <td key={h} className="px-2 py-1 truncate max-w-[120px]">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button onClick={handleImport} disabled={loading}
              className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              {loading ? 'Importando...' : `Importar ${preview.totalRows} jugadores`}
            </button>
            <button onClick={reset} className="border dark:border-fide-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Importados', value: result.imported, color: 'text-green-500' },
              { label: 'Omitidos', value: result.skipped, color: 'text-yellow-500' },
              { label: 'Errores', value: result.errors?.length || 0, color: 'text-red-500' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 dark:bg-fide-900 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 dark:text-fide-400">{s.label}</div>
              </div>
            ))}
          </div>

          {result.errors?.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Errores:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
              ))}
            </div>
          )}

          <button onClick={reset} className="w-full border dark:border-fide-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200 transition">
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  );
}

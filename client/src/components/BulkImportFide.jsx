import { useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function BulkImportFide({ onImport }) {
  const { toast } = useToast();
  const [mode, setMode] = useState(null);
  const [ids, setIds] = useState('');
  const [federation, setFederation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleIds = async () => {
    const list = ids.split('\n').map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return toast.error('Ingresa al menos un FIDE ID');
    setLoading(true);
    try {
      const r = await api.fideBulkImport(list);
      setResult(r);
      toast.success(`Importados: ${r.imported.length}, omitidos: ${r.skipped.length}`);
      if (onImport) onImport();
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleFed = async () => {
    if (!federation) return toast.error('Selecciona una federación');
    setLoading(true);
    try {
      const r = await api.fideImportFederation(federation);
      setResult(r);
      toast.success(`Importados: ${r.imported.length}, omitidos: ${r.skipped}`);
      if (onImport) onImport();
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  if (!mode) return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4">
      <h3 className="font-semibold dark:text-white mb-3 text-sm">Importación masiva FIDE</h3>
      <div className="flex gap-2">
        <button onClick={() => setMode('ids')} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">Por FIDE IDs</button>
        <button onClick={() => setMode('fed')} className="bg-fide-700 hover:bg-fide-800 text-white px-3 py-1.5 rounded text-xs font-medium transition">Por Federación</button>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold dark:text-white text-sm">
          {mode === 'ids' ? 'Importar por FIDE IDs' : 'Importar por Federación'}
        </h3>
        <button onClick={() => { setMode(null); setResult(null); }} className="text-xs text-gray-500 hover:text-gray-700 dark:text-fide-400">Cancelar</button>
      </div>

      {mode === 'ids' ? (
        <div>
          <textarea value={ids} onChange={(e) => setIds(e.target.value)}
            placeholder="Un FIDE ID por línea&#10;Ej:&#10;32012345&#10;32067890"
            className="w-full border dark:border-fide-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500 mb-2" rows={5} />
          <button onClick={handleIds} disabled={loading}
            className="bg-fide-700 hover:bg-fide-800 disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs font-medium transition">
            {loading ? 'Importando...' : 'Importar'}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2 mb-2">
            <select value={federation} onChange={(e) => setFederation(e.target.value)}
              className="flex-1 border dark:border-fide-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-fide-700 dark:text-white outline-none focus:ring-2 focus:ring-fide-500">
              <option value="">Seleccionar federación...</option>
              <option value="ESP">ESP — España</option><option value="ARG">ARG — Argentina</option>
              <option value="MEX">MEX — México</option><option value="COL">COL — Colombia</option>
              <option value="CHI">CHI — Chile</option><option value="PER">PER — Perú</option>
              <option value="CUB">CUB — Cuba</option><option value="USA">USA — Estados Unidos</option>
              <option value="FRA">FRA — Francia</option><option value="GER">GER — Alemania</option>
            </select>
          </div>
          <button onClick={handleFed} disabled={loading}
            className="bg-fide-700 hover:bg-fide-800 disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs font-medium transition">
            {loading ? 'Importando...' : 'Importar todos los jugadores'}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-3 pt-3 border-t dark:border-fide-700">
          <div className="text-xs space-y-1 text-gray-600 dark:text-fide-300">
            <p className="text-green-600 dark:text-green-400">✓ {result.imported.length} importados</p>
            {result.skipped > 0 && <p className="text-yellow-600 dark:text-yellow-400">{typeof result.skipped === 'number' ? `${result.skipped} omitidos` : `${result.skipped.length} omitidos`}</p>}
            {result.errors > 0 && <p className="text-red-600">{result.errors} errores</p>}
            <p className="text-gray-400">Total procesados: {result.total}</p>
          </div>
          {result.imported?.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto">
              {result.imported.map((p) => (
                <div key={p.id} className="text-xs text-gray-500 dark:text-fide-400 py-0.5">✓ {p.name} {p.last_name} ({p.fide_rating})</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

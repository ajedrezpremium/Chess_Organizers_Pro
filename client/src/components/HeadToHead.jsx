import { useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

export default function HeadToHead({ tournamentId, players }) {
  const { toast } = useToast();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!p1 || !p2) { toast.error('Selecciona dos jugadores'); return; }
    if (p1 === p2) { toast.error('Selecciona dos jugadores diferentes'); return; }
    setLoading(true);
    try {
      const data = await api.headToHead(tournamentId, p1, p2);
      setResult(data);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const getResultLabel = (r) => {
    if (r === '1') return '1-0';
    if (r === '0') return '0-1';
    if (r === '=') return '½-½';
    if (r === 'U' || r === 'H' || r === 'F') return 'BYE';
    return r;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-sm dark:text-white mb-4">Cara a Cara</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 block mb-1">Jugador 1</label>
            <select value={p1} onChange={(e) => setP1(e.target.value)}
              className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white">
              <option value="">Seleccionar...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.last_name} ({p.fide_rating || '-'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-fide-400 block mb-1">Jugador 2</label>
            <select value={p2} onChange={(e) => setP2(e.target.value)}
              className="border dark:border-fide-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-fide-700 dark:text-white">
              <option value="">Seleccionar...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.last_name} ({p.fide_rating || '-'})</option>
              ))}
            </select>
          </div>
          <button onClick={handleSearch} disabled={loading}
            className="bg-fide-700 hover:bg-fide-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            {loading ? 'Buscando...' : 'Comparar'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-sm dark:text-white mb-4">
            {result.player1?.name} vs {result.player2?.name}
          </h3>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Encuentros', value: result.totalEncounters },
              { label: 'Rating P1', value: result.player1?.rating || '-' },
              { label: 'Rating P2', value: result.player2?.rating || '-' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 dark:bg-fide-900 rounded-lg p-3 text-center">
                <div className="text-lg font-bold dark:text-white">{s.value}</div>
                <div className="text-xs text-gray-500 dark:text-fide-400">{s.label}</div>
              </div>
            ))}
          </div>

          {result.encounters.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No se enfrentaron en ninguna ronda</p>
          ) : (
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="text-gray-500 dark:text-fide-400">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Ronda</th>
                    <th className="text-left px-2 py-1 font-medium">{result.player1?.name}</th>
                    <th className="text-center px-2 py-1 font-medium">Resultado</th>
                    <th className="text-left px-2 py-1 font-medium">{result.player2?.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-fide-700">
                  {result.encounters.map((e) => (
                    <tr key={e.round} className="dark:text-fide-200">
                      <td className="px-2 py-2 font-medium">{e.round}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1">
                          {result.player1?.name}
                          <span className="text-[10px] text-gray-400">({e.p1Color})</span>
                        </span>
                      </td>
                      <td className={`px-2 py-2 text-center font-bold font-mono text-lg ${
                        e.result === '1' ? 'text-green-600' : e.result === '0' ? 'text-red-500' : e.result === '=' ? 'text-amber-500' : ''
                      }`}>
                        {getResultLabel(e.result)}
                      </td>
                      <td className="px-2 py-2">
                        {e.isBye ? <span className="text-gray-400 italic">BYE</span> : result.player2?.name}
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
  );
}

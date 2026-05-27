import { useState } from 'react';
import { api } from '../api/client.js';

const SEVERITY_ICONS = { error: '🔴', warning: '🟡', info: '🔵' };
const SEVERITY_CLASSES = {
  error: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  warning: 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
  info: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
};

export default function PairingIntelligence({ tournamentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.validate(tournamentId);
      setData(result);
    } catch (e) {
      setError(e.message || 'Error al analizar');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold dark:text-white">🧠 Inteligencia de Pairings</h2>
        <button onClick={analyze} disabled={loading}
          className="bg-fide-700 hover:bg-fide-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
          {loading ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Analizando...</>
          ) : 'Analizar'}
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">{error}</div>}

      {!data && !loading && (
        <div className="text-center py-12 text-gray-400 dark:text-fide-400">
          <p className="text-lg mb-1">🔍</p>
          <p>Presiona "Analizar" para revisar los pairings del torneo</p>
          <p className="text-xs mt-1">Detección de conflictos FIDE, sugerencias de sistema y balance de colores</p>
        </div>
      )}

      {data && (
        <>
          {/* Resumen KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Jugadores', value: data.playerCount },
              { label: 'Rondas', value: data.roundCount },
              { label: 'Partidas', value: data.totalPairings },
              { label: 'Violaciones', value: data.violations.length, color: data.violations.length > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-500' },
            ].map((k) => (
              <div key={k.label} className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 text-center shadow-sm">
                <div className={`text-2xl font-bold ${k.color || 'dark:text-white'}`}>{k.value}</div>
                <div className="text-xs text-gray-500 dark:text-fide-400 mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Violaciones */}
          <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4 text-sm dark:text-white flex items-center gap-2">
              ⚠️ Violaciones ({data.violations.length})
              {data.violations.length === 0 && <span className="text-xs text-green-500 font-normal">Todo correcto</span>}
            </h3>
            {data.violations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-fide-400 text-center py-4">No se detectaron violaciones a las reglas FIDE</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.violations.map((v, i) => (
                  <div key={i} className={`border rounded-lg px-3 py-2 text-sm ${SEVERITY_CLASSES[v.severity] || SEVERITY_CLASSES.info}`}>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">{SEVERITY_ICONS[v.severity] || 'ℹ️'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{v.message}</div>
                        <div className="flex gap-2 mt-1 text-xs opacity-70">
                          {v.playerName && <span>{v.playerName}</span>}
                          {v.round && <span>Ronda {v.round}</span>}
                          {v.rule && <span>Regla {v.rule}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Color Balance */}
          <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4 text-sm dark:text-white">🎨 Balance de Colores</h3>
            {data.colorBalance.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-fide-400">Todos los jugadores tienen balance de colores normal</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 dark:text-fide-400 text-xs">
                      <th className="text-left px-2 py-1">Jugador</th>
                      <th className="text-center px-2 py-1">Blancas</th>
                      <th className="text-center px-2 py-1">Negras</th>
                      <th className="text-center px-2 py-1">Diff</th>
                      <th className="text-center px-2 py-1">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-fide-700">
                    {data.colorBalance.map((c) => (
                      <tr key={c.playerId} className="dark:text-fide-200">
                        <td className="px-2 py-1.5 font-medium">{c.playerName}</td>
                        <td className="px-2 py-1.5 text-center">{c.white}</td>
                        <td className="px-2 py-1.5 text-center">{c.black}</td>
                        <td className={`px-2 py-1.5 text-center font-mono font-medium ${Math.abs(c.diff) > 2 ? 'text-red-500' : 'text-yellow-500'}`}>
                          {c.diff > 0 ? `+${c.diff}` : c.diff}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.status === 'violation' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          }`}>{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sugerencias */}
          <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4 text-sm dark:text-white">💡 Sugerencias</h3>
            {data.suggestions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-fide-400">Sin sugerencias para este torneo</p>
            ) : (
              <div className="space-y-2">
                {data.suggestions.map((s, i) => (
                  <div key={i} className={`border rounded-lg px-3 py-2 text-sm ${SEVERITY_CLASSES[s.severity] || SEVERITY_CLASSES.info}`}>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">{SEVERITY_ICONS[s.severity] || '💡'}</span>
                      <div className="flex-1">
                        <p>{s.message}</p>
                        {s.suggested && (
                          <p className="text-xs mt-1 opacity-75">Sugerencia: {s.suggested}</p>
                        )}
                        {s.suggestedFloor && (
                          <p className="text-xs mt-1 opacity-75">Floor sugerido: {s.suggestedFloor} ({s.lowCount} jugadores por debajo)</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

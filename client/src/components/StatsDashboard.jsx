export default function StatsDashboard({ data, loading }) {
  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-gray-200 dark:bg-fide-700 rounded-xl h-24" />)}</div>;
  if (!data) return <p className="text-center py-12 text-gray-400">Carga las estadísticas desde el botón</p>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jugadores', value: data.totalPlayers },
          { label: 'Rondas', value: `${data.closedRounds}/${data.totalRounds}` },
          { label: 'Rating Prom.', value: data.avgRating || '-' },
          { label: 'Federaciones', value: data.federations?.length || 0 },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold dark:text-white">{k.value}</div>
            <div className="text-xs text-gray-500 dark:text-fide-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Federaciones */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3 text-sm dark:text-white">Federaciones</h3>
        <div className="flex flex-wrap gap-2">
          {data.federations?.map((f) => (
            <span key={f.code} className="bg-fide-100 dark:bg-fide-700 text-fide-800 dark:text-fide-200 px-3 py-1 rounded-full text-xs font-medium">
              {f.code} ({f.count})
            </span>
          ))}
        </div>
      </div>

      {/* Distribución de Rating */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3 text-sm dark:text-white">Distribución por Rating</h3>
        <div className="space-y-2">
          {data.ratingDist?.filter((r) => r.count > 0).map((r) => (
            <div key={r.label} className="flex items-center gap-3 text-sm">
              <span className="w-20 text-right text-gray-500 dark:text-fide-400">{r.label}</span>
              <div className="flex-1 bg-gray-100 dark:bg-fide-700 rounded-full h-5 overflow-hidden">
                <div className="bg-fide-500 dark:bg-fide-400 h-full rounded-full transition-all duration-500 flex items-center justify-end px-2"
                  style={{ width: `${Math.max(8, (r.count / Math.max(...data.ratingDist.map((x) => x.count))) * 100)}%` }}>
                  <span className="text-[10px] text-white font-bold">{r.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Títulos */}
      {data.titles?.length > 0 && (
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-3 text-sm dark:text-white">Títulos</h3>
          <div className="flex flex-wrap gap-2">
            {data.titles.map((t) => (
              <span key={t.title} className="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-medium">
                {t.title === '-' ? 'Sin título' : t.title} ({t.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progreso por ronda */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3 text-sm dark:text-white">Resultados por Ronda</h3>
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 dark:text-fide-400 text-xs">
                <th className="text-left px-2 py-1">Ronda</th>
                <th className="text-center px-2 py-1">Blancas</th>
                <th className="text-center px-2 py-1">Tablas</th>
                <th className="text-center px-2 py-1">Negras</th>
                <th className="text-center px-2 py-1">BYE</th>
                <th className="text-center px-2 py-1">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-fide-700">
              {data.roundResults?.map((r) => (
                <tr key={r.round} className="dark:text-fide-200">
                  <td className="px-2 py-1.5 font-medium">Ronda {r.round}</td>
                  <td className="px-2 py-1.5 text-center font-mono text-green-600 dark:text-green-400">{r.whiteWins}</td>
                  <td className="px-2 py-1.5 text-center font-mono text-amber-600 dark:text-amber-400">{r.draws}</td>
                  <td className="px-2 py-1.5 text-center font-mono text-red-600 dark:text-red-400">{r.blackWins}</td>
                  <td className="px-2 py-1.5 text-center font-mono text-gray-400">{r.byes}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'closed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      r.status === 'generated' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-gray-100 text-gray-400 dark:bg-fide-700'
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

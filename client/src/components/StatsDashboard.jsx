export default function StatsDashboard({ data, loading }) {
  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-gray-200 dark:bg-fide-700 rounded-xl h-24" />)}</div>;
  if (!data) return <p className="text-center py-12 text-gray-400">Carga las estadísticas desde el botón</p>;

  const maxCount = Math.max(...(data.ratingDist || []).map((r) => r.count), 1);

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
                  style={{ width: `${Math.max(8, (r.count / maxCount) * 100)}%` }}>
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

      {/* Resultados por Ronda con distribución visual */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3 text-sm dark:text-white">Resultados por Ronda</h3>
        <div className="space-y-3">
          {data.roundResults?.map((r) => (
            <div key={r.round}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-fide-400 mb-1">
                <span className="font-medium dark:text-fide-200">Ronda {r.round}</span>
                <div className="flex items-center gap-3">
                  <span className="text-green-600 dark:text-green-400">{r.whiteWins} <span className="text-[10px]">({r.whitePct}%)</span></span>
                  <span className="text-amber-600 dark:text-amber-400">{r.draws} <span className="text-[10px]">({r.drawPct}%)</span></span>
                  <span className="text-red-600 dark:text-red-400">{r.blackWins} <span className="text-[10px]">({r.blackPct}%)</span></span>
                  {r.byes > 0 && <span className="text-gray-400">BYE {r.byes}</span>}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    r.status === 'closed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                    r.status === 'generated' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                    'bg-gray-100 text-gray-400 dark:bg-fide-700'
                  }`}>{r.status}</span>
                </div>
              </div>
              {r.total > 0 && (
                <div className="flex h-4 rounded-full overflow-hidden">
                  <div className="bg-green-500 transition-all" style={{ width: `${r.whitePct}%` }} title={`Blancas ${r.whitePct}%`} />
                  <div className="bg-amber-400 transition-all" style={{ width: `${r.drawPct}%` }} title={`Tablas ${r.drawPct}%`} />
                  <div className="bg-red-500 transition-all" style={{ width: `${r.blackPct}%` }} title={`Negras ${r.blackPct}%`} />
                </div>
              )}
            </div>
          ))}
        </div>
        {data.totals && (
          <div className="mt-4 pt-3 border-t dark:border-fide-700">
            <div className="text-xs text-gray-500 dark:text-fide-400 mb-2">Totales acumulados</div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 dark:text-green-400 font-medium">♟ Blancas: {data.totals.whiteWins} ({data.totals.whitePct}%)</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">= Tablas: {data.totals.draws} ({data.totals.drawPct}%)</span>
              <span className="text-red-600 dark:text-red-400 font-medium">♛ Negras: {data.totals.blackWins} ({data.totals.blackPct}%)</span>
              <span className="text-gray-400 font-medium">BYE: {data.totals.byes}</span>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden mt-2">
              <div className="bg-green-500 transition-all" style={{ width: `${data.totals.whitePct}%` }} />
              <div className="bg-amber-400 transition-all" style={{ width: `${data.totals.drawPct}%` }} />
              <div className="bg-red-500 transition-all" style={{ width: `${data.totals.blackPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Performance por Color */}
      {data.colorPerformance?.length > 0 && (
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-3 text-sm dark:text-white">Rendimiento por Color</h3>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-fide-400 text-xs">
                  <th className="text-left px-2 py-1">Jugador</th>
                  <th className="text-center px-2 py-1">Elo</th>
                  <th className="text-center px-2 py-1 text-green-600 dark:text-green-400" colSpan={2}>Blancas</th>
                  <th className="text-center px-2 py-1 text-red-600 dark:text-red-400" colSpan={2}>Negras</th>
                  <th className="text-center px-2 py-1">Dif.</th>
                </tr>
                <tr className="text-gray-400 dark:text-fide-500 text-[10px]">
                  <th />
                  <th />
                  <th className="text-center px-1 py-0">Pts</th>
                  <th className="text-center px-1 py-0">%</th>
                  <th className="text-center px-1 py-0">Pts</th>
                  <th className="text-center px-1 py-0">%</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-fide-700">
                {data.colorPerformance.slice(0, 20).map((p) => {
                  const diff = p.white.pct - p.black.pct;
                  return (
                    <tr key={p.id} className="dark:text-fide-200">
                      <td className="px-2 py-1.5 font-medium">
                        {p.title && <span className="text-amber-500 text-xs mr-1">{p.title}</span>}
                        {p.name} {p.lastName || ''}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-500">{p.rating || '-'}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-green-600 dark:text-green-400">{p.white.points}/{p.white.games}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-green-600 dark:text-green-400">{p.white.pct}%</td>
                      <td className="px-2 py-1.5 text-center font-mono text-red-600 dark:text-red-400">{p.black.points}/{p.black.games}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-red-600 dark:text-red-400">{p.black.pct}%</td>
                      <td className={`px-2 py-1.5 text-center font-mono font-medium ${diff > 10 ? 'text-green-500' : diff < -10 ? 'text-red-500' : 'text-gray-400'}`}>
                        {diff > 0 ? '+' : ''}{diff}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-gray-400 dark:text-fide-500">
            Dif. = % Blancas − % Negras. Positivo = rinde mejor con blancas.
          </div>
        </div>
      )}
    </div>
  );
}

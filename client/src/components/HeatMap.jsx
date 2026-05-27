export default function HeatMap({ data }) {
  const { progression, nRounds } = data || {};

  if (!progression || progression.length === 0) {
    return <p className="text-center py-8 text-gray-400">Sin datos para el mapa de calor</p>;
  }

  const colors = {
    win: 'bg-green-500 dark:bg-green-600',
    loss: 'bg-red-500 dark:bg-red-600',
    draw: 'bg-amber-400 dark:bg-amber-500',
    bye: 'bg-gray-300 dark:bg-gray-600',
    pending: 'bg-gray-100 dark:bg-fide-700',
  };

  const textColors = {
    win: 'text-white',
    loss: 'text-white',
    draw: 'text-black',
    bye: 'text-gray-600 dark:text-gray-300',
    pending: 'text-gray-400',
  };

  const labels = {
    win: '1',
    loss: '0',
    draw: '½',
    bye: 'BYE',
    pending: '-',
  };

  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
      <h3 className="font-semibold text-sm dark:text-white mb-4">Mapa de Calor — Resultados por jugador y ronda</h3>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-gray-600 dark:text-fide-400">
        {Object.entries(colors).map(([key, cls]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-block w-3.5 h-3.5 rounded ${cls}`} />
            <span className="capitalize">{key}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 dark:text-fide-400 text-xs">
              <th className="text-left px-2 py-1 font-medium">Jugador</th>
              {Array.from({ length: nRounds }).map((_, i) => (
                <th key={i} className="text-center px-1 py-1 font-medium w-10">R{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-fide-700">
            {progression.map((player) => (
              <tr key={player.id} className="dark:text-fide-200">
                <td className="px-2 py-1.5 text-sm font-medium whitespace-nowrap">
                  {player.name} {player.lastName}
                  {player.title && <span className="text-fide-500 text-xs ml-1">{player.title}</span>}
                </td>
                {player.heatColors.map((hc, ri) => {
                  const colorClass = colors[hc] || colors.pending;
                  const textClass = textColors[hc] || textColors.pending;
                  const label = labels[hc] || labels.pending;
                  const colorEl = player.colorHistory?.[ri];
                  return (
                    <td key={ri} className="px-1 py-1 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${colorClass} ${textClass}`}
                        title={`Ronda ${ri + 1} - ${hc}${colorEl ? ` (${colorEl})` : ''}`}>
                        {label}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

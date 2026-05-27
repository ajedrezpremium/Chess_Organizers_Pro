import { useState, useMemo } from 'react';

export default function PointsProgression({ data }) {
  const [highlight, setHighlight] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const { progression, nRounds } = data || {};

  const displayed = useMemo(() => {
    if (!progression) return [];
    const sorted = [...progression];
    return showAll ? sorted : sorted.slice(0, 10);
  }, [progression, showAll]);

  if (!progression || progression.length === 0) {
    return <p className="text-center py-8 text-gray-400">Sin datos de progresión</p>;
  }

  const maxPoints = Math.max(...displayed.map((p) => p.points));

  return (
    <div className="space-y-4">
      {/* Bar chart */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-sm dark:text-white mb-4">Progresión de puntos por ronda</h3>
        <div className="relative h-64">
          <svg viewBox={`0 0 ${nRounds * 60 + 60} 240`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {/* Grid lines */}
            {Array.from({ length: 5 }).map((_, i) => (
              <line key={i} x1="40" y1={40 + i * 40} x2={nRounds * 60 + 40} y2={40 + i * 40}
                stroke="#374151" strokeWidth="0.5" strokeDasharray="4,4" />
            ))}
            {/* Y-axis labels */}
            {Array.from({ length: 5 }).map((_, i) => (
              <text key={i} x="35" y={44 + i * 40} textAnchor="end" fill="#9CA3AF" fontSize="10">
                {(maxPoints * (1 - i * 0.25)).toFixed(1)}
              </text>
            ))}
            {/* X-axis labels */}
            {Array.from({ length: nRounds }).map((_, i) => (
              <text key={i} x={60 + i * 60} y="230" textAnchor="middle" fill="#9CA3AF" fontSize="10">
                R{i + 1}
              </text>
            ))}
            {/* Lines for each player */}
            {displayed.map((player) => {
              const isHighlighted = highlight === player.id || !highlight;
              const color = player.id === highlight ? '#f59e0b' : '#6366f1';
              const opacity = isHighlighted ? 1 : 0.15;

              if (player.byRound.length < 2) return null;
              const pts = player.byRound;
              const maxPts = maxPoints || 1;
              const points = pts.map((p, i) => ({
                x: 60 + i * 60,
                y: 200 - (p / maxPts) * 160,
              }));

              return (
                <g key={player.id} opacity={opacity}
                  onMouseEnter={() => setHighlight(player.id)}
                  onMouseLeave={() => setHighlight(null)}
                  style={{ cursor: 'pointer' }}>
                  {/* Line */}
                  <polyline
                    points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none" stroke={color} strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeLinejoin="round" strokeLinecap="round" />
                  {/* Dots */}
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={isHighlighted ? 4 : 2} fill={color} />
                  ))}
                  {/* Label */}
                  {isHighlighted && (
                    <text x={points[points.length - 1].x + 6} y={points[points.length - 1].y + 4}
                      fill={color} fontSize="10" fontWeight="bold">
                      {player.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex justify-end">
          <button onClick={() => setShowAll(!showAll)} className="text-xs text-fide-500 hover:underline">
            {showAll ? 'Mostrar top 10' : `Mostrar todos (${progression.length})`}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl overflow-hidden shadow-sm">
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-fide-900 text-gray-600 dark:text-fide-300">
              <tr>
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Jugador</th>
                {Array.from({ length: nRounds }).map((_, i) => (
                  <th key={i} className="text-center px-2 py-2 font-medium text-xs">R{i + 1}</th>
                ))}
                <th className="text-center px-2 py-2 font-medium">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-fide-700">
              {displayed.map((player, idx) => (
                <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-fide-700 dark:text-fide-200"
                  onMouseEnter={() => setHighlight(player.id)}
                  onMouseLeave={() => setHighlight(null)}>
                  <td className="px-3 py-2 text-gray-500 dark:text-fide-400">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">{player.name} {player.lastName}</td>
                  {player.byRound.map((pts, ri) => (
                    <td key={ri} className="px-2 py-2 text-center font-mono text-xs">
                      {player.heatColors[ri] === 'pending' ? '-' : pts.toFixed(1)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-bold font-mono">{player.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

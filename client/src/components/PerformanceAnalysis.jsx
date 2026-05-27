import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client.js';
import PerformanceCharts from './PerformanceCharts.jsx';

export default function PerformanceAnalysis({ tournamentId, pc }) {
  const [data, setData] = useState([]);
  const [progression, setProgression] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('points');
  const [showCharts, setShowCharts] = useState(true);

  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);
    Promise.all([
      api.performance(tournamentId),
      api.progression(tournamentId).catch(() => null),
    ]).then(([perf, prog]) => {
      setData(perf);
      setProgression(prog);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tournamentId]);

  if (loading) return <div className="text-center py-12 text-fide-400">Cargando rendimiento...</div>;
  if (!data || data.length === 0) return <div className="text-center py-12 text-fide-500">Sin datos de rendimiento</div>;

  const sorted = [...data].sort((a, b) => {
    if (sortBy === 'points') return b.points - a.points;
    if (sortBy === 'tpr') return (b.tpr || 0) - (a.tpr || 0);
    if (sortBy === 'ratingChg') return (b.ratingChg || 0) - (a.ratingChg || 0);
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  function getTprColor(tpr, rating) {
    if (!tpr || !rating) return 'text-fide-400';
    const diff = tpr - rating;
    if (diff > 100) return 'text-emerald-400';
    if (diff > 0) return 'text-emerald-300';
    if (diff > -100) return 'text-amber-300';
    return 'text-red-400';
  }

  function getChgColor(chg) {
    if (chg === null || chg === undefined) return 'text-fide-400';
    if (chg > 10) return 'text-emerald-400';
    if (chg > 0) return 'text-emerald-300';
    if (chg === 0) return 'text-fide-400';
    if (chg > -10) return 'text-amber-300';
    return 'text-red-400';
  }

  const maxRounds = Math.max(0, ...data.map((p) => (p.roundChanges || []).length));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setShowCharts(!showCharts)}
          className="text-sm text-fide-400 hover:text-white transition flex items-center gap-1"
        >
          <svg className={`w-4 h-4 transition ${showCharts ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showCharts ? 'Ocultar gráficas' : 'Mostrar gráficas'}
        </button>
      </div>

      {showCharts && <PerformanceCharts players={data} progression={progression} />}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Jugador</th>
                <th className="text-center px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => setSortBy('rating')}>
                  Elo {sortBy === 'rating' && '↓'}
                </th>
                <th className="text-center px-4 py-3 font-medium">Pts</th>
                <th className="text-center px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => setSortBy('tpr')}>
                  TPR {sortBy === 'tpr' && '↓'}
                </th>
                {maxRounds > 0 && Array.from({ length: maxRounds }, (_, i) => (
                  <th key={`r${i}`} className="text-center px-2 py-3 font-medium text-xs text-fide-500">
                    R{i + 1}
                  </th>
                ))}
                <th className="text-center px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => setSortBy('ratingChg')}>
                  ΔR {sortBy === 'ratingChg' && '↓'}
                </th>
                <th className="text-center px-4 py-3 font-medium">K</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sorted.map((p, i) => {
                const kFactor = p.kFactor || (p.rating < 2100 ? 40 : p.rating < 2400 ? 20 : 10);
                const rc = p.roundChanges || [];
                return (
                  <tr key={p.id} className="hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 text-fide-400 w-10">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.title && <span className="text-xs text-amber-500 font-medium">{p.title}</span>}
                        <span className="font-medium text-white">{p.name} {p.lastName || ''}</span>
                        {p.federation && <span className="text-[10px] text-fide-500 bg-fide-800 px-1.5 py-0.5 rounded">{p.federation}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-fide-300">{p.rating || '-'}</td>
                    <td className="px-4 py-3 text-center font-medium text-white">{p.points}/{p.games}</td>
                    <td className={`px-4 py-3 text-center font-medium ${getTprColor(p.tpr, p.rating)}`}>
                      {p.tpr !== null ? p.tpr : '-'}
                    </td>
                    {maxRounds > 0 && Array.from({ length: maxRounds }, (_, i) => {
                      const d = rc[i];
                      return (
                        <td key={`rd${i}`} className={`px-2 py-3 text-center text-xs font-medium ${getChgColor(d !== undefined ? d * kFactor : null)}`}>
                          {d !== undefined && d !== null
                            ? (d * kFactor > 0 ? '+' : '') + Math.round(d * kFactor)
                            : '-'}
                        </td>
                      );
                    })}
                    <td className={`px-4 py-3 text-center font-medium ${getChgColor(p.ratingChg)}`}>
                      {p.ratingChg !== null ? (p.ratingChg > 0 ? '+' : '') + p.ratingChg : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-fide-500 text-xs">{kFactor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs text-fide-500 border-t border-gray-800 flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="text-emerald-400">TPR</span> = Rendimiento estimado (FIDE) </span>
          <span><span className="text-emerald-400">ΔR</span> = Cambio de rating (K=40/20/10) </span>
          <span>Tabla: TPR x {data.filter(p => p.tpr !== null).length} jugadores</span>
        </div>
      </div>
    </div>
  );
}

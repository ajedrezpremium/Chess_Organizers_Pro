import { useState, useEffect } from 'react';
import { api } from '../api/client.js';

const K_LABELS = {
  '40': 'K=40 (<2100)',
  '20': 'K=20 (2100-2399)',
  '10': 'K=10 (2400+)',
};

export default function PerformanceAnalysis({ tournamentId, pc }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('points');

  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);
    api.performance(tournamentId).then((d) => {
      setData(d);
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

  return (
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
              <th className="text-center px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => setSortBy('ratingChg')}>
                ΔR {sortBy === 'ratingChg' && '↓'}
              </th>
              <th className="text-center px-4 py-3 font-medium">K</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.map((p, i) => {
              const K = p.rating < 2100 ? 40 : p.rating < 2400 ? 20 : 10;
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
                  <td className={`px-4 py-3 text-center font-medium ${getChgColor(p.ratingChg)}`}>
                    {p.ratingChg !== null ? (p.ratingChg > 0 ? '+' : '') + p.ratingChg : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-fide-500 text-xs">{K}</td>
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
  );
}

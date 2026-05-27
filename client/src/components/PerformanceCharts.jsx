import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

function getPlayerColor(i) {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  return colors[i % colors.length];
}

export default function PerformanceCharts({ players, progression }) {
  const [chartMode, setChartMode] = useState('points');
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const topPlayers = useMemo(() => {
    if (!players || players.length === 0) return [];
    const sorted = [...players].sort((a, b) => b.points - a.points || (b.rating || 0) - (a.rating || 0));
    return sorted;
  }, [players]);

  const roundCount = useMemo(() => {
    if (!topPlayers.length) return 0;
    return Math.max(0, ...topPlayers.map((p) => (p.roundChanges || []).length));
  }, [topPlayers]);

  const pointsChartData = useMemo(() => {
    if (!progression || !progression.progression || !roundCount) return [];
    const progMap = {};
    for (const p of progression.progression) {
      progMap[p.id] = p;
    }
    const topN = topPlayers.slice(0, 10);
    return Array.from({ length: roundCount }, (_, i) => {
      const row = { round: i + 1 };
      for (const p of topN) {
        const prog = progMap[p.id];
        row[p.id] = prog && prog.byRound && prog.byRound[i] !== undefined ? prog.byRound[i] : null;
      }
      return row;
    });
  }, [progression, topPlayers, roundCount]);

  const deltaChartData = useMemo(() => {
    if (!roundCount) return [];
    return Array.from({ length: roundCount }, (_, i) => {
      const row = { round: i + 1 };
      for (const p of topPlayers) {
        const d = p.roundChanges && p.roundChanges[i];
        row[p.id] = d !== undefined && d !== null ? Math.round(d * (p.kFactor || 20)) : 0;
      }
      return row;
    });
  }, [topPlayers, roundCount]);

  const tprChartData = useMemo(() => {
    return topPlayers
      .filter((p) => p.tpr !== null && p.rating)
      .map((p) => ({
        name: `${p.name} ${p.lastName || ''}`.substring(0, 15),
        rating: p.rating,
        tpr: p.tpr,
        diff: p.tpr - p.rating,
      }));
  }, [topPlayers]);

  if (!players || players.length === 0) return null;

  const renderPointsChart = () => (
    <div>
      <h4 className="text-sm font-medium text-fide-300 mb-3">Progresión de puntos (top 10)</h4>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={pointsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="round" stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'Ronda', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} domain={[0, 'auto']} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
            labelStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {topPlayers.slice(0, 10).map((p, i) => (
            <Line
              key={p.id}
              type="monotone"
              dataKey={p.id}
              name={`${p.title ? p.title + ' ' : ''}${p.name} ${p.lastName || ''}`.substring(0, 20)}
              stroke={getPlayerColor(i)}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderDeltaChart = () => (
    <div>
      <h4 className="text-sm font-medium text-fide-300 mb-3">ΔR por ronda (top 10)</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={deltaChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="round" stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'Ronda', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(v) => (v > 0 ? '+' : '') + v}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {topPlayers.slice(0, 10).map((p, i) => (
            <Bar
              key={p.id}
              dataKey={p.id}
              name={`${p.title ? p.title + ' ' : ''}${p.name} ${p.lastName || ''}`.substring(0, 20)}
              fill={getPlayerColor(i)}
              opacity={0.85}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderTprChart = () => (
    <div>
      <h4 className="text-sm font-medium text-fide-300 mb-3">TPR vs Elo</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={tprChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} width={120} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="rating" fill="#3b82f6" name="Elo" opacity={0.85} />
          <Bar dataKey="tpr" fill="#10b981" name="TPR" opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="mb-6 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        {['points', 'delta', 'tpr'].map((mode) => (
          <button
            key={mode}
            onClick={() => setChartMode(mode)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              chartMode === mode
                ? 'bg-fide-700 text-white'
                : 'bg-gray-800 text-fide-400 hover:text-white'
            }`}
          >
            {mode === 'points' ? 'Puntos' : mode === 'delta' ? 'ΔR/Ronda' : 'TPR vs Elo'}
          </button>
        ))}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        {chartMode === 'points' && (progression && progression.progression ? renderPointsChart() : <p className="text-fide-500 text-sm text-center py-8">Cargar progresión desde la pestaña Progresión</p>)}
        {chartMode === 'delta' && renderDeltaChart()}
        {chartMode === 'tpr' && (tprChartData.length > 0 ? renderTprChart() : <p className="text-fide-500 text-sm text-center py-8">Sin datos de TPR</p>)}
      </div>
    </div>
  );
}

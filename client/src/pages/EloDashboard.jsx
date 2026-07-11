import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/context.jsx';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const RADAR_METRICS = [
  { key: 'tpr', label: 'TPR', description: 'Rendimiento vs rating esperado' },
  { key: 'winRate', label: '% Victorias', description: 'Porcentaje de partidas ganadas' },
  { key: 'drawRate', label: '% Tablas', description: 'Porcentaje de tablas' },
  { key: 'performance', label: 'Sobre-Rendim.', description: 'Diferencia TPR - Rating' },
  { key: 'consistency', label: 'Consistencia', description: 'Inverso de desviación estándar' },
];

export default function EloDashboard() {
  const { t } = useI18n();
  const [tournaments, setTournaments] = useState([]);
  const [selectedTid, setSelectedTid] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [progression, setProgression] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('radar');

  useEffect(() => {
    api.listTournaments().then((d) => {
      setTournaments(d.tournaments || []);
      if (d.tournaments?.length) setSelectedTid(d.tournaments[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTid) return;
    Promise.all([
      api.performance(selectedTid),
      api.progression(selectedTid),
    ]).then(([perf, prog]) => {
      setPerformance(perf);
      setProgression(prog);
    }).catch(() => {});
  }, [selectedTid]);

  const radarData = performance?.players?.length ? RADAR_METRICS.map((m) => {
    const entry = { metric: m.label };
    performance.players.forEach((p) => {
      const tpr = p.tpr || p.performance_rating || p.rating;
      const exp = p.expected_score || 0.5;
      const wins = p.wins || 0;
      const draws = p.draws || 0;
      const total = p.games || 1;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      const drawRate = total > 0 ? (draws / total) * 100 : 0;
      const overPerf = (tpr - p.rating) / 100;
      const maxPlayers = Math.min(performance.players.length, 6);
      const val = Math.max(0, Math.min(100, {
        tpr: ((tpr - 2000) / 1000) * 100,
        winRate,
        drawRate,
        performance: (overPerf + 2) * 25,
        consistency: Math.min(100, (1 - (p.delta_std || 0) / 50) * 100),
      }[m.key] || 50));
      entry[p.name || `J${p.id}`] = Math.round(val);
    });
    return entry;
  }) : [];

  const topPlayers = performance?.players?.slice(0, 6).map((p) => p.name || `J${p.id}`) || [];

  const progressionData = progression?.rounds?.map((r, i) => ({
    round: `R${i + 1}`,
    ...(r.players || []).reduce((acc, p) => {
      acc[p.name || `J${p.id}`] = p.points;
      return acc;
    }, {}),
  })) || [];

  const ratingDistData = performance?.players?.length
    ? (() => {
        const buckets = { '<2200': 0, '2200-2399': 0, '2400-2599': 0, '2600-2699': 0, '2700+': 0 };
        performance.players.forEach((p) => {
          const r = p.rating || 0;
          if (r >= 2700) buckets['2700+']++;
          else if (r >= 2600) buckets['2600-2699']++;
          else if (r >= 2400) buckets['2400-2599']++;
          else if (r >= 2200) buckets['2200-2399']++;
          else buckets['<2200']++;
        });
        return Object.entries(buckets).map(([name, value]) => ({ name, value }));
      })()
    : [];

  const selected = tournaments.find((t) => t.id === selectedTid);

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-fide-700 rounded" />
          <div className="h-64 bg-gray-200 dark:bg-fide-700 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-fide-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">📊 Dashboard Elo</h1>
          <p className="text-sm text-gray-500 dark:text-fide-400 mt-1">
            Rendimiento, progresión y estadísticas de jugadores
          </p>
        </div>
        <select
          value={selectedTid || ''}
          onChange={(e) => setSelectedTid(Number(e.target.value))}
          className="px-4 py-2 border dark:border-fide-700 rounded-xl bg-white dark:bg-fide-800 text-sm max-w-xs"
        >
          <option value="">Seleccionar torneo</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold text-gray-900 dark:text-white">{selected.name}</span>
          <span className="text-gray-500">{selected.system === 'dutch' ? 'Suizo' : selected.system}</span>
          <span className="text-gray-500">{selected.n_rounds} rondas</span>
          <span className="text-gray-500">{performance?.players?.length || 0} jugadores</span>
          <Link to={`/app/tournament/${selected.id}`} className="text-fide-600 dark:text-fide-300 hover:underline ml-auto">
            Ir al torneo →
          </Link>
        </div>
      )}

      {!selectedTid && (
        <div className="text-center py-20 text-gray-400 dark:text-fide-500">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-lg">Selecciona un torneo para ver estadísticas Elo</p>
        </div>
      )}

      {selectedTid && !performance && (
        <div className="text-center py-12 text-gray-400">
          <p>Cargando estadísticas...</p>
        </div>
      )}

      {selectedTid && performance && (
        <>
          {/* Tab selector */}
          <div className="flex gap-1 border-b border-fide-700/50">
            {[
              { id: 'radar', label: 'Radar de Rendimiento', icon: '🕸️' },
              { id: 'progression', label: 'Progresión Puntos', icon: '📈' },
              { id: 'distribution', label: 'Distribución ELO', icon: '📊' },
              { id: 'h2h', label: 'Cara a Cara', icon: '⚔️' },
            ].map((tabItem) => (
              <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition ${
                  tab === tabItem.id ? 'border-amber-500 text-amber-400' : 'border-transparent text-fide-400 hover:text-fide-300'
                }`}>
                <span>{tabItem.icon}</span> {tabItem.label}
              </button>
            ))}
          </div>

          {/* Radar Chart */}
          {tab === 'radar' && (
            <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🕸️ Radar de Rendimiento</h2>
              <p className="text-sm text-gray-500 dark:text-fide-400 mb-6">Compara jugadores en 5 dimensiones de rendimiento</p>
              {radarData.length > 0 && topPlayers.length > 0 ? (
                <div className="grid lg:grid-cols-2 gap-8">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#374151" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                        {topPlayers.map((name, i) => (
                          <Radar key={name} name={name} dataKey={name}
                            stroke={['#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][i % 6]}
                            fill={['#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][i % 6]}
                            fillOpacity={0.1} />
                        ))}
                        <Legend />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {RADAR_METRICS.map((m) => (
                      <div key={m.key} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{m.label}</span>
                        <span className="text-gray-500 dark:text-fide-400">{m.description}</span>
                      </div>
                    ))}
                    <div className="mt-4 pt-4 border-t dark:border-fide-700">
                      <p className="text-xs text-gray-400">Top {topPlayers.length} jugadores — valores normalizados 0-100</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">Datos insuficientes para radar</div>
              )}
            </div>
          )}

          {/* Progression Chart */}
          {tab === 'progression' && (
            <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📈 Progresión de Puntos por Ronda</h2>
              {progressionData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="round" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {topPlayers.map((name, i) => (
                        <Line key={name} type="monotone" dataKey={name}
                          stroke={['#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][i % 6]}
                          strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">Sin datos de progresión</div>
              )}
            </div>
          )}

          {/* Rating Distribution */}
          {tab === 'distribution' && (
            <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📊 Distribución de Rating ELO</h2>
              {ratingDistData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingDistData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#9CA3AF', fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">Sin datos de distribución</div>
              )}
            </div>
          )}

          {/* Head to Head */}
          {tab === 'h2h' && (
            <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">⚔️ Cara a Cara</h2>
              <div className="text-center py-12 text-gray-400">
                <p>Usa la pestaña "Cara a Cara" dentro del torneo para comparar dos jugadores.</p>
                <Link to={`/app/tournament/${selectedTid}`} className="text-fide-500 hover:underline mt-2 inline-block">
                  Ir al torneo →
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

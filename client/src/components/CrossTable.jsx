import { useState } from 'react';
import PlayerCard from './PlayerCard.jsx';

const RESULT_STYLES = {
  '1': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 font-bold',
  '0': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 font-bold',
  '=': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 font-bold',
};

export default function CrossTable({ data, loading }) {
  const [selected, setSelected] = useState(null);

  if (loading) return <p className="text-center py-12 text-gray-400 animate-pulse">Cargando tabla cruzada...</p>;
  if (!data) return <p className="text-center py-12 text-gray-400">Carga la tabla desde el botón</p>;

  const { players, nRounds } = data;

  return (
    <div>
      <div className="table-wrap">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-fide-800 text-white dark:bg-fide-950">
              <th className="px-2 py-2 text-left w-8">#</th>
              <th className="px-2 py-2 text-left min-w-[140px]">Jugador</th>
              <th className="px-2 py-2 text-center w-10">Pts</th>
              {Array.from({ length: nRounds }).map((_, i) => (
                <th key={i} className="px-2 py-2 text-center w-14">R{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-fide-700">
            {players.map((p, i) => (
              <tr key={p.id}
                onClick={() => setSelected(p)}
                className={`cursor-pointer transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-fide-800' : 'bg-gray-50/50 dark:bg-fide-900/50'} hover:bg-gray-100 dark:hover:bg-fide-700`}>
                <td className="px-2 py-1.5 text-gray-400 font-bold">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <span className="font-medium">{p.name} {p.lastName}</span>
                  {p.title && <span className="text-fide-500 text-xs ml-1 font-bold">{p.title}</span>}
                  {p.rating > 0 && <span className="text-gray-400 text-xs ml-1">({p.rating})</span>}
                </td>
                <td className="px-2 py-1.5 text-center font-bold font-mono">{p.points.toFixed(1)}</td>
                {p.rounds.map((r, ri) => (
                  <td key={ri} className={`px-2 py-1.5 text-center ${r.isBye ? 'text-gray-300 dark:text-gray-600 italic' : RESULT_STYLES[r.result] || ''}`}>
                    {r.isBye ? 'B' : r.opponent ? (
                      <span className="flex items-center justify-center gap-0.5">
                        <span>{r.result}</span>
                        <span className={`text-[10px] font-bold ${r.color === 'W' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>{r.color}</span>
                      </span>
                    ) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <PlayerCard player={selected} nRounds={nRounds} onClose={() => setSelected(null)} />}
    </div>
  );
}

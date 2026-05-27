export default function BoardWall({ rounds, currentRoundIndex, onResult }) {
  const round = rounds[currentRoundIndex];
  if (!round) return <p className="text-center py-12 text-gray-400">No hay rondas generadas</p>;

  const isOpen = round.status === 'generated' || round.status === 'published';
  const pairings = round.pairings || [];

  if (pairings.length === 0) return <p className="text-center py-12 text-gray-400">Sin pairings en esta ronda</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Ronda {round.round_number} — Vista General</h2>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${round.status === 'closed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'}`}>
          {round.status}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pairings.map((p) => (
          <div key={p.id} className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 shadow-sm hover:shadow-md transition">
            <div className="text-xs text-gray-400 mb-2 font-medium">Mesa {p.board}</div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-center shrink-0">W</span>
                <span className="font-medium text-sm dark:text-white truncate">{p.white_name}{p.white_last ? ` ${p.white_last}` : ''}</span>
                {p.white_rating > 0 && <span className="text-xs text-gray-400 ml-auto">({p.white_rating})</span>}
              </div>

              <div className="flex items-center justify-center">
                {isOpen ? (
                  <select value={p.result} onChange={(e) => onResult(round.id, p.id, e.target.value)}
                    className="border dark:border-fide-600 rounded px-3 py-1 text-sm font-mono font-bold bg-white dark:bg-fide-700 dark:text-white text-center">
                    {['-', '1-0', '½-½', '0-1', 'U', 'F', 'H', 'Z'].map((r) => <option key={r} value={r === '1-0' ? '1' : r === '½-½' ? '=' : r === '0-1' ? '0' : r}>{r}</option>)}
                  </select>
                ) : (
                  <span className={`font-mono font-bold text-lg px-3 py-1 rounded ${
                    p.result === '1' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                    p.result === '0' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                    p.result === '=' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                    'text-gray-300'
                  }`}>{p.result === '1' ? '1-0' : p.result === '0' ? '0-1' : p.result === '=' ? '½-½' : p.result}</span>
                )}
              </div>

              {p.black_id ? (
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-fide-600 text-gray-600 dark:text-gray-300 text-xs font-bold flex items-center justify-center shrink-0">B</span>
                  <span className="font-medium text-sm dark:text-white truncate">{p.black_name}{p.black_last ? ` ${p.black_last}` : ''}</span>
                  {p.black_rating > 0 && <span className="text-xs text-gray-400 ml-auto">({p.black_rating})</span>}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 italic text-sm">
                  <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-fide-600 text-xs font-bold flex items-center justify-center">-</span>
                  BYE
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RESULT_LABEL = { '1': '1-0', '0': '0-1', '=': '½-½' };

export default function PlayerCard({ player, nRounds, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-fide-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold dark:text-white">{player.name} {player.lastName}</h3>
            <div className="flex gap-3 mt-1 text-sm text-gray-500 dark:text-fide-300">
              {player.title && <span className="font-bold text-fide-600">{player.title}</span>}
              {player.rating > 0 && <span>Rating: <strong>{player.rating}</strong></span>}
              {player.federation && <span>{player.federation}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="text-center mb-4">
          <span className="text-3xl font-bold dark:text-white">{player.points.toFixed(1)}</span>
          <span className="text-gray-400 dark:text-fide-400 ml-1">/ {nRounds} pts</span>
        </div>

        <h4 className="font-semibold mb-2 text-sm dark:text-fide-200">Rondas</h4>
        <div className="space-y-1.5">
          {player.rounds.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-fide-700 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-400 w-8">R{i + 1}</span>
              {r.isBye ? (
                <span className="text-gray-400 italic flex-1">BYE</span>
              ) : r.opponent ? (
                <span className="flex-1">
                  <span className={`inline-block w-5 text-center font-bold ${r.color === 'W' ? 'text-amber-600' : 'text-gray-500'}`}>{r.color}</span>
                  <span className="font-medium">{r.opponent.name} {r.opponent.lastName}</span>
                  {r.opponent.rating > 0 && <span className="text-gray-400 ml-1">({r.opponent.rating})</span>}
                </span>
              ) : (
                <span className="text-gray-300 flex-1">Pendiente</span>
              )}
              <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                r.result === '1' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                r.result === '0' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                r.result === '=' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                'text-gray-300'
              }`}>{RESULT_LABEL[r.result] || r.result}</span>
            </div>
          ))}
        </div>

        {player.rounds.some((r) => r.result === '-' || !r.result) && (
          <p className="text-xs text-gray-400 mt-3 text-center">Rondas sin resultado aún</p>
        )}
      </div>
    </div>
  );
}

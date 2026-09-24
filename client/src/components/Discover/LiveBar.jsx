import { Card, CardHeader, Badge } from '../../design-system/ui.jsx';
import { STATUS_STYLES } from '../../design-system/tokens.js';
import { sourceName } from '../../data/chessSources.js';

export default function LiveBar({ items = [] }) {
  return (
    <Card>
      <CardHeader title="🔴 En vivo ahora" subtitle="Torneos en directo · 2700 Live, Chess.com, Lichess, FIDE Arena"
        action={<span className="text-[10px] text-gray-400">auto-refresh 30s</span>} />
      <div className="p-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((t) => (
          <div key={t.id} className="border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h4 className="font-bold text-xs dark:text-white truncate">{t.name}</h4>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-fide-400">📍 {t.city} · {t.round} · {t.system}</p>
            {t.board1 && <p className="text-[11px] mt-1 dark:text-fide-200 truncate">♟ {t.board1}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Badge tone={STATUS_STYLES.live}>EN VIVO</Badge>
              <span className="text-[10px] text-gray-400">{sourceName(t.source)}</span>
              <a href="#" onClick={(e) => e.preventDefault()} className="ml-auto text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline">Seguir ▶</a>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400 col-span-full text-center py-4">Sin torneos en vivo ahora mismo.</p>}
      </div>
    </Card>
  );
}

import { useState } from 'react';
import { Card, CardHeader } from '../../design-system/ui.jsx';
import { CHESS_SOURCES, SOURCE_CATS } from '../../data/chessSources.js';

export default function NewsLinks() {
  const [cat, setCat] = useState('all');
  const list = cat === 'all' ? CHESS_SOURCES : CHESS_SOURCES.filter((s) => s.cat === cat);
  return (
    <Card>
      <CardHeader title="📰 Noticias & Enlaces clave" subtitle="2700chess · ECU · ChessBase · FIDE · Lichess · Chess.com · FIDE Arena…" />
      <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
        {SOURCE_CATS.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition ${cat === c.key ? 'bg-amber-500 border-amber-500 text-fide-900' : 'border-gray-200 dark:border-fide-700 text-gray-500 dark:text-fide-400 hover:border-amber-400'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {list.map((s) => (
          <a key={s.id} href={s.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-xs border border-gray-200 dark:border-fide-700 rounded-xl hover:border-amber-400 hover:shadow-sm transition dark:text-fide-200">
            <span className="text-[10px] uppercase tracking-wide opacity-50">{s.cat}</span>
            <span className="font-semibold truncate">{s.name}</span>
            {s.live && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
          </a>
        ))}
      </div>
    </Card>
  );
}

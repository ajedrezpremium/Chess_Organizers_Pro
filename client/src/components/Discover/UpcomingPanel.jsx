import { useMemo, useState } from 'react';
import { Card, CardHeader, Tabs, Badge } from '../../design-system/ui.jsx';
import { STATUS_STYLES } from '../../design-system/tokens.js';
import { sourceName } from '../../data/chessSources.js';

export default function UpcomingPanel({ items = [] }) {
  const [tab, setTab] = useState('all');
  const sources = useMemo(() => ['all', ...new Set(items.map((i) => i.source))], [items]);
  const list = tab === 'all' ? items : items.filter((i) => i.source === tab);
  return (
    <Card>
      <CardHeader title="📅 Próximos 30 días" subtitle="Avance de los más importantes · tipo 2700 Live"
        action={<span className="text-[10px] text-gray-400">{list.length} eventos</span>} />
      <div className="px-4 pt-3">
        <Tabs tabs={sources.map((s) => ({ key: s, label: s === 'all' ? 'Todas' : sourceName(s) }))} value={tab} onChange={setTab} />
      </div>
      <div className="p-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {list.map((t) => (
          <div key={t.id} className="border border-gray-200 dark:border-fide-700 rounded-xl p-3 hover:shadow-md transition">
            <h4 className="font-bold text-xs dark:text-white truncate">{t.name}</h4>
            <p className="text-[11px] text-gray-500 dark:text-fide-400 mt-1">📅 {t.date} · 📍 {t.city}</p>
            <p className="text-[11px] text-gray-500 dark:text-fide-400">♟ {t.system} · ⏱ {t.rhythm || '—'} · 🏷️ {t.level || 'Abierto'}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone={STATUS_STYLES.upcoming}>PRÓXIMO</Badge>
              <span className="text-[10px] text-gray-400">{sourceName(t.source)}</span>
              <button className="ml-auto text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline">🔔 Radar</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-xs text-gray-400 col-span-full text-center py-4">Sin eventos próximos en esta fuente.</p>}
      </div>
    </Card>
  );
}

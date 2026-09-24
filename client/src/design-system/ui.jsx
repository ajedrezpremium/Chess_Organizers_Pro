import { useState } from 'react';

// ── Button ──
export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const v = {
    primary: 'bg-amber-500 hover:bg-amber-600 text-fide-900 font-bold shadow-lg shadow-amber-500/20',
    ghost: 'border border-fide-300 dark:border-fide-600 hover:bg-gray-50 dark:hover:bg-fide-700 text-fide-700 dark:text-fide-200',
    danger: 'bg-red-600 hover:bg-red-500 text-white font-semibold',
    subtle: 'text-fide-600 dark:text-fide-300 hover:underline font-medium',
  }[variant];
  const s = { sm: 'px-3 py-1.5 text-xs rounded-lg', md: 'px-5 py-2.5 text-sm rounded-xl', lg: 'px-8 py-3.5 text-base rounded-xl' }[size];
  return <button className={`${v} ${s} transition disabled:opacity-50 ${className}`} {...props} />;
}

// ── Card ──
export function Card({ className = '', children }) {
  return <div className={`bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 rounded-2xl shadow-sm ${className}`}>{children}</div>;
}
export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-fide-700">
      <div>
        <h3 className="font-bold text-sm dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-fide-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Badge ──
export function Badge({ tone = '', children }) {
  return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tone}`}>{children}</span>;
}

// ── Avatar ──
export function Avatar({ name = '?', size = 'md' }) {
  const s = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-9 h-9 text-sm';
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-fide-600 to-fide-800 text-amber-400 flex items-center justify-center font-bold shrink-0`}>
      {(name?.charAt(0) || '?').toUpperCase()}
    </div>
  );
}

// ── Tabs ──
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-fide-900 rounded-xl overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition ${value === t.key ? 'bg-white dark:bg-fide-700 text-fide-900 dark:text-white shadow' : 'text-gray-500 dark:text-fide-400 hover:text-fide-800 dark:hover:text-fide-200'}`}>
          {t.label}{t.count != null && <span className="ml-1 opacity-60">({t.count})</span>}
        </button>
      ))}
    </div>
  );
}

// ── Inputs ──
export function TextInput({ className = '', ...props }) {
  return <input className={`w-full px-3 py-2 text-sm bg-white dark:bg-fide-900 border border-gray-200 dark:border-fide-700 rounded-xl dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${className}`} {...props} />;
}
export function SelectInput({ className = '', children, ...props }) {
  return <select className={`px-3 py-2 text-sm bg-white dark:bg-fide-900 border border-gray-200 dark:border-fide-700 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${className}`} {...props}>{children}</select>;
}

// ── DataTable (ordenable + paginada, ligera) ──
export function DataTable({ columns, rows, pageSize = 8, emptyText = 'Sin datos' }) {
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(0);
  const sorted = [...rows].sort((a, b) => {
    if (!sort.key) return 0;
    const va = a[sort.key] ?? '', vb = b[sort.key] ?? '';
    return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const slice = sorted.slice(page * pageSize, page * pageSize + pageSize);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 dark:text-fide-400 border-b dark:border-fide-700">
              {columns.map((c) => (
                <th key={c.key} onClick={() => c.sortable !== false && setSort({ key: c.key, dir: sort.key === c.key ? -sort.dir : 1 })}
                  className={`px-3 py-2 font-semibold whitespace-nowrap ${c.sortable !== false ? 'cursor-pointer hover:text-fide-800 dark:hover:text-white' : ''}`}>
                  {c.label}{sort.key === c.key && (sort.dir > 0 ? ' ▲' : ' ▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-fide-700/50 hover:bg-gray-50 dark:hover:bg-fide-700/30">
                {columns.map((c) => <td key={c.key} className="px-3 py-2 dark:text-fide-100">{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-center text-xs text-gray-400 py-6">{emptyText}</p>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 dark:text-fide-400">
          <span>Página {page + 1} de {pages}</span>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-fide-700 disabled:opacity-40">‹</button>
            <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-fide-700 disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EmptyState / SectionTitle / Stat ──
export function EmptyState({ icon = '♟', title = 'Sin datos', hint = '' }) {
  return (
    <div className="text-center py-8 text-gray-400 dark:text-fide-500">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="text-xs mt-1">{hint}</p>}
    </div>
  );
}
export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div>
        <h2 className="font-bold text-sm dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 dark:text-fide-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Stat({ value, label, accent = false }) {
  return (
    <div className="bg-gray-50 dark:bg-fide-900 border border-gray-100 dark:border-fide-700 rounded-xl p-3 text-center">
      <div className={`text-xl font-extrabold ${accent ? 'text-amber-500' : 'dark:text-white'}`}>{value}</div>
      <div className="text-[10px] text-gray-500 dark:text-fide-400 mt-0.5">{label}</div>
    </div>
  );
}

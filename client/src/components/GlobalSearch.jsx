import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHESS_SOURCES } from '../data/chessSources.js';

// Buscador global Cmd+K: torneos propios (vía API), páginas y fuentes externas.
export default function GlobalSearch({ myTournaments = [] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open ]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return { mine: myTournaments.slice(0, 4), sources: CHESS_SOURCES.slice(0, 6) };
    return {
      mine: myTournaments.filter((t) => `${t.name} ${t.city || ''}`.toLowerCase().includes(query)).slice(0, 5),
      sources: CHESS_SOURCES.filter((s) => s.name.toLowerCase().includes(query)).slice(0, 6),
    };
  }, [q, myTournaments]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
      <div className="max-w-xl mx-auto mt-20 bg-white dark:bg-fide-800 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b dark:border-fide-700">
          <span>🔍</span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar torneos, páginas, fuentes… (Esc para cerrar)"
            className="flex-1 py-3 text-sm bg-transparent outline-none dark:text-white placeholder:text-gray-400" />
          <kbd className="text-[10px] bg-gray-100 dark:bg-fide-700 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-auto p-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 pt-2">Mis torneos</p>
          {results.mine.map((t) => (
            <button key={t.id} onClick={() => { setOpen(false); navigate(`/app/events/${t.id}`); }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-fide-700 text-sm dark:text-white">
              ♟ {t.name} <span className="text-xs opacity-50">· {t.status}</span>
            </button>
          ))}
          {results.mine.length === 0 && <p className="text-xs text-gray-400 px-3 py-1">Sin coincidencias propias.</p>}
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 pt-3">Fuentes y páginas</p>
          <button onClick={() => { setOpen(false); navigate(`/app/search?q=${encodeURIComponent(q)}`); }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-fide-700 text-sm font-semibold text-amber-600 dark:text-amber-400">
            🔍 Buscar “{q || '…'}” en el buscador universal →
          </button>
          {results.sources.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="block px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-fide-700 text-sm dark:text-white">
              🔗 {s.name} <span className="text-xs opacity-50">· {s.cat}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

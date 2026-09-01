import { useState } from 'react';
import { Link } from 'react-router-dom';
import { newsletters2026 } from '../data/newsletters2026.js';

export default function Newsletters() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black tracking-tight">📰 Newsletter 2026</h1>
        <p className="text-sm text-gray-500 dark:text-fide-400 mt-2">10 novedades del programa + 10 del ajedrez mundial · Cada 15 de mes</p>
        <p className="text-xs opacity-50 mt-1">Enero → Agosto publicados · Septiembre → Diciembre programados</p>
      </div>

      {/* Subscribe */}
      <form onSubmit={handleSubscribe} className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-5 flex flex-col sm:flex-row gap-3 items-center mb-8 text-white">
        <div className="flex-1 text-left">
          <p className="font-bold text-sm">Suscríbete — 1 email/mes, sin spam</p>
          <p className="text-xs opacity-80">Recibe la edición el 15 de cada mes + PDF</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="tu@email.com" className="px-3 py-2 rounded-lg text-sm text-black outline-none w-full sm:w-56" />
          <button type="submit" className="px-4 py-2 rounded-lg bg-black text-white text-sm font-bold hover:bg-zinc-800">Suscribir</button>
        </div>
        {sent && <span className="text-xs bg-white text-amber-700 px-2 py-1 rounded-full font-bold">✓ ¡Suscrito!</span>}
      </form>

      {/* List */}
      <div className="grid gap-3">
        {newsletters2026.map((n) => (
          <div key={n.id} className={`rounded-xl border p-4 flex gap-4 items-center ${n.published ? 'bg-white dark:bg-fide-800 border-gray-200 dark:border-fide-700' : 'bg-gray-50 dark:bg-fide-900/50 border-dashed opacity-60'}`}>
            <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${n.published ? 'bg-amber-500 text-black' : 'bg-gray-200 dark:bg-fide-700 text-gray-500'}`}>
              <span className="text-[10px] font-bold tracking-widest">{n.month.slice(0,3).toUpperCase()}</span>
              <span className="text-lg font-black leading-none">{n.date.slice(8,10)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs opacity-60">{n.date} {n.published ? '· Publicado' : '· Programado'}</p>
              <h3 className="font-bold text-sm truncate">{n.month} 2026 — {n.title}</h3>
              <p className="text-xs opacity-60">10 novedades programa + 10 mundial</p>
            </div>
            {n.published ? (
              <div className="flex gap-2 shrink-0">
                <a href={n.file} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90">📄 Ver</a>
                <a href={n.file} download className="px-3 py-1.5 rounded-lg bg-white dark:bg-fide-700 border text-xs">⬇ PDF</a>
              </div>
            ) : (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Próximamente</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-fide-900 text-fide-100 text-xs leading-relaxed">
        <p className="font-bold mb-1">Calendario de publicación 2026</p>
        <p>Publicamos <b>uno nuevo cada 15 de mes a las 09:00 CET</b>. Las 8 primeras ediciones (ene-ago) ya están disponibles. Las 4 restantes (sep-dic) se publicarán automáticamente. Archivo completo en <code>/newsletters/2026/</code> y vía email.</p>
        <p className="mt-2"><Link to="/app/dashboard" className="underline hover:text-amber-400">← Volver al Dashboard</Link> · <a href="https://chessorganizers.com/newsletter" target="_blank" rel="noreferrer" className="underline hover:text-amber-400">chessorganizers.com/newsletter ↗</a></p>
      </div>
    </div>
  );
}

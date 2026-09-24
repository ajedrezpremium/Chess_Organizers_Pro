import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../api/client.js';
import { useDiscover } from '../hooks/useDiscover.js';
import { Card, TextInput, SelectInput, Badge, EmptyState, SectionTitle } from '../design-system/ui.jsx';
import { STATUS_STYLES } from '../design-system/tokens.js';

const SYSTEMS = ['all', 'Suizo', 'Round Robin', 'Liga', 'Arena', 'KO'];
const COUNTRIES = ['all', 'ESP', 'FRA', 'GER', 'SUI', 'USA', 'INT', 'GEO'];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [country, setCountry] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [system, setSystem] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [mine, setMine] = useState([]);
  const [detail, setDetail] = useState(null);
  const { live, upcoming, finished } = useDiscover();

  useEffect(() => {
    api.listTournaments().then((d) => setMine(d.tournaments || d || [])).catch(() => {});
    api.public?.listTournaments?.({ status: 'active', limit: 50 }).then((d) => {
      const arr = d.tournaments || d || [];
      if (Array.isArray(arr) && arr.length) setMine((prev) => [...prev, ...arr.filter((t) => !prev.some((p) => p.id === t.id))]);
    }).catch(() => {});
  }, []);

  const pool = useMemo(() => {
    const ext = [
      ...live.map((t) => ({ ...t, _kind: 'live', _date: '' })),
      ...upcoming.map((t) => ({ ...t, _kind: 'upcoming', _date: t.date || '' })),
      ...finished.map((t) => ({ ...t, _kind: 'finished', _date: t.date || '' })),
    ];
    const own = mine.map((t) => ({ ...t, _kind: 'mine', _date: t.start_date || '' }));
    return [...own, ...ext];
  }, [mine, live, upcoming, finished]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    return pool.filter((t) => {
      if (query && !`${t.name} ${t.city || ''}`.toLowerCase().includes(query)) return false;
      if (country !== 'all' && (t.country || 'INT') !== country) return false;
      if (system !== 'all' && !(t.system || '').toLowerCase().includes(system.toLowerCase().slice(0, 5))) return false;
      if (onlineOnly && (t.city || '').toLowerCase() !== 'online' && t.country !== 'INT') return false;
      if (from && (t._date || '') < from) return false;
      if (to && (t._date || '') > to) return false;
      return true;
    });
  }, [pool, q, country, system, onlineOnly, from, to]);

  return (
    <div className="max-w-6xl mx-auto">
      <Helmet><title>Buscador de torneos — Chess Organizers Pro</title></Helmet>
      <SectionTitle title="🔍 Buscador universal de torneos"
        subtitle="Por país, fecha o nombre · Resultados, emparejamientos y clasificaciones"
        action={<span className="text-[11px] text-gray-400">{results.length} resultados</span>} />
      <Card className="p-4 mb-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="lg:col-span-2"><TextInput value={q} onChange={(e) => { setQ(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}); }} placeholder="Nombre, ciudad o jugador…" /></div>
          <SelectInput value={country} onChange={(e) => setCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c} value={c}>{c === 'all' ? 'Todos los países' : c}</option>)}</SelectInput>
          <SelectInput value={system} onChange={(e) => setSystem(e.target.value)}>{SYSTEMS.map((s) => <option key={s} value={s}>{s === 'all' ? 'Todos los sistemas' : s}</option>)}</SelectInput>
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Desde" />
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Hasta" />
        </div>
        <label className="flex items-center gap-2 mt-2 text-xs dark:text-fide-200">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} /> Solo online
        </label>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {results.map((t) => (
          <Card key={`${t._kind}-${t.id}`} className="p-4 hover:shadow-md transition">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm dark:text-white truncate flex-1">{t.name}</h3>
              <Badge tone={STATUS_STYLES[t._kind === 'live' ? 'live' : t._kind === 'mine' ? 'active' : t._kind === 'upcoming' ? 'upcoming' : 'finished']}>
                {t._kind === 'live' ? '🔴 EN VIVO' : t._kind === 'mine' ? 'MIS TORNEOS' : t._kind === 'upcoming' ? 'PRÓXIMO' : 'FINALIZADO'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-fide-400 mt-1">
              {[t.city, t.country, t._date, t.system, t.round].filter(Boolean).join(' · ')}
            </p>
            {t.winner && <p className="text-xs mt-1 dark:text-fide-200">🥇 {t.winner} {t.winnerElo && <span className="opacity-60">({t.winnerElo})</span>}</p>}
            <div className="flex gap-2 mt-3">
              {t._kind === 'mine'
                ? <><Link to={`/app/events/${t.id}`} className="text-[11px] font-bold bg-fide-800 text-white rounded-lg px-3 py-1.5">Entrar →</Link>
                    <Link to={`/app/tournament/${t.id}`} className="text-[11px] border border-gray-200 dark:border-fide-700 rounded-lg px-3 py-1.5 dark:text-fide-200">⚙ Gestionar</Link></>
                : <button onClick={() => setDetail(t)} className="text-[11px] font-bold bg-fide-800 text-white rounded-lg px-3 py-1.5">Ver detalle</button>}
              <button onClick={() => setDetail(t)} className="text-[11px] border border-gray-200 dark:border-fide-700 rounded-lg px-3 py-1.5 dark:text-fide-200">Clasificación · Pairings</button>
            </div>
          </Card>
        ))}
      </div>
      {results.length === 0 && <EmptyState title="Sin resultados" hint="Ajusta los filtros o prueba con otro nombre." />}

      {detail && (
        <div className="fixed inset-0 z-[90] bg-black/50 p-4 overflow-auto" onClick={() => setDetail(null)}>
          <div className="max-w-2xl mx-auto bg-white dark:bg-fide-800 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-extrabold dark:text-white">{detail.name}</h3>
                <p className="text-xs text-gray-500 dark:text-fide-400">{[detail.city, detail.country, detail._date, detail.system].filter(Boolean).join(' · ')}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 mt-4 text-xs">
              <div className="border dark:border-fide-700 rounded-xl p-3"><p className="font-bold mb-1">📊 Clasificación</p><p className="opacity-70">{detail.winner ? `Ganador: ${detail.winner}` : 'Disponible en la página del evento.'}</p></div>
              <div className="border dark:border-fide-700 rounded-xl p-3"><p className="font-bold mb-1">♟ Emparejamientos</p><p className="opacity-70">{detail.round || 'Por rondas, con colores y tableros.'}</p></div>
              <div className="border dark:border-fide-700 rounded-xl p-3"><p className="font-bold mb-1">📄 Reportes</p><p className="opacity-70">{detail.trf ? 'TRF oficial disponible ✓' : 'TRF/PDF en la página del evento.'}</p></div>
            </div>
            <div className="flex gap-2 mt-4">
              {detail._kind === 'mine'
                ? <Link to={`/app/events/${detail.id}`} className="text-xs font-bold bg-amber-500 text-fide-900 rounded-xl px-4 py-2">Abrir página del evento →</Link>
                : <Link to="/app/search" onClick={() => setDetail(null)} className="text-xs font-bold bg-amber-500 text-fide-900 rounded-xl px-4 py-2">Seguir evento 🔔</Link>}
              <button onClick={() => setDetail(null)} className="text-xs border border-gray-200 dark:border-fide-700 rounded-xl px-4 py-2 dark:text-fide-200">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

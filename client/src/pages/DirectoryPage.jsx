import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardHeader, Tabs, TextInput, SelectInput, Badge, EmptyState } from '../design-system/ui.jsx';
import { DIRECTORY_SEED, DIRECTORY_KINDS } from '../data/directorySeed.js';
import { HARVESTED_CLUBS } from '../data/directoryHarvest.js';

// Merge seed + cosecha Chess-Results (deduplica por nombre+país, gana el seed curado).
function normKey(d) {
  return `${(d.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()}|${d.country}`;
}
const ALL_ENTRIES = (() => {
  const seen = new Set(DIRECTORY_SEED.map(normKey));
  const extra = (HARVESTED_CLUBS || []).filter((d) => !seen.has(normKey(d)));
  return [...DIRECTORY_SEED, ...extra];
})();

function useFollowed() {
  const [followed, setFollowed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cop-followed-orgs') || '[]'); } catch { return []; }
  });
  const toggle = (id) => {
    const next = followed.includes(id) ? followed.filter((x) => x !== id) : [...followed, id];
    setFollowed(next);
    try { localStorage.setItem('cop-followed-orgs', JSON.stringify(next)); } catch {}
  };
  return { followed, toggle };
}

export default function DirectoryPage() {
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('all');
  const [detail, setDetail] = useState(null);
  const { followed, toggle } = useFollowed();

  const countries = useMemo(() => ['all', ...new Set(ALL_ENTRIES.map((d) => d.country))], []);
  const counts = useMemo(() => ({
    all: ALL_ENTRIES.length,
    federation: ALL_ENTRIES.filter((d) => d.kind === 'federation').length,
    club: ALL_ENTRIES.filter((d) => d.kind === 'club').length,
    school: ALL_ENTRIES.filter((d) => d.kind === 'school').length,
  }), []);
  const harvestedCount = (HARVESTED_CLUBS || []).length;
  const list = ALL_ENTRIES
    .filter((d) =>
      (kind === 'all' || d.kind === kind) &&
      (country === 'all' || d.country === country) &&
      (!q.trim() || `${d.name} ${d.city} ${d.country}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(b.featured || false) - Number(a.featured || false));

  const kindLabel = (k) => k === 'federation' ? 'Federación' : k === 'club' ? 'Club' : 'Escuela';

  return (
    <div className="max-w-6xl mx-auto">
      <Helmet><title>Directorio — Federaciones, Clubes y Escuelas</title></Helmet>
      <Card className="p-4 mb-4">
        <h1 className="font-extrabold text-lg dark:text-white">🏢 Directorio de Federaciones, Clubes y Escuelas</h1>
        <p className="text-xs text-gray-500 dark:text-fide-400 mb-3">{counts.federation} federaciones · {counts.club} clubes ({harvestedCount} verificados en Chess-Results) · {counts.school} escuelas — sigue sus torneos y contacta directamente.</p>
        <div className="flex flex-wrap gap-2">
          <Tabs tabs={DIRECTORY_KINDS.map((k) => ({ key: k.key, label: `${k.label} (${counts[k.key]})` }))} value={kind} onChange={setKind} />
          <div className="flex gap-2 ml-auto">
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar entidad…" className="w-48" />
            <SelectInput value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => <option key={c} value={c}>{c === 'all' ? 'Todos los países' : c}</option>)}
            </SelectInput>
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((d) => (
          <Card key={d.id} className={`p-4 hover:shadow-md transition ${d.featured ? 'ring-2 ring-amber-400/70' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{d.kind === 'federation' ? '🏛️' : d.kind === 'club' ? '♟️' : '🎓'}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-xs dark:text-white truncate">{d.name}</h3>
                <p className="text-[11px] text-gray-500 dark:text-fide-400">📍 {d.city} · {d.country}</p>
              </div>
              {d.featured && <Badge tone="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300">⭐ Destacado</Badge>}
              {d.verified && <Badge tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200">✓</Badge>}
              {d.source === 'chess-results' && <Badge tone="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200">♟ Chess-Results{d.players ? ` · ${d.players}j` : ''}</Badge>}
            </div>
            <p className="text-[11px] mt-2 dark:text-fide-200">{kindLabel(d.kind)} · {d.events12m} eventos/12m</p>
            <div className="flex gap-1.5 mt-3">
              <button onClick={() => toggle(d.id)} className={`flex-1 text-[11px] font-bold rounded-lg px-2 py-1.5 transition ${followed.includes(d.id) ? 'bg-emerald-500 text-white' : 'bg-fide-800 text-white hover:bg-fide-700'}`}>
                {followed.includes(d.id) ? '✓ Siguiendo' : '🔔 Seguir'}
              </button>
              <button onClick={() => setDetail(d)} className="text-[11px] border border-gray-200 dark:border-fide-700 rounded-lg px-2 py-1.5 dark:text-fide-200">Ficha</button>
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="text-[11px] border border-gray-200 dark:border-fide-700 rounded-lg px-2 py-1.5">🌐</a>}
            </div>
          </Card>
        ))}
      </div>
      {list.length === 0 && <EmptyState title="Sin entidades" hint="Prueba con otra búsqueda o país." />}

      {detail && (
        <div className="fixed inset-0 z-[90] bg-black/50 p-4 overflow-auto" onClick={() => setDetail(null)}>
          <div className="max-w-lg mx-auto bg-white dark:bg-fide-800 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="font-extrabold dark:text-white">{detail.name}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400">✕</button>
            </div>
            <p className="text-xs text-gray-500 dark:text-fide-400 mt-1">{kindLabel(detail.kind)} · 📍 {detail.city}, {detail.country}</p>
            <div className="text-xs mt-3 space-y-1 dark:text-fide-200">
              {detail.url && <p>🌐 <a href={detail.url} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline">{detail.url}</a></p>}
              {detail.kind === 'federation' && (
                <p>♟ <a href={`https://chess-results.com/fed.aspx?lan=1&fed=${detail.country}`} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline">Ver torneos en Chess-Results</a>
                {' · '}<a href={`https://ratings.fide.com/`} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline">FIDE Ratings</a></p>
              )}
              {detail.source === 'chess-results' && (
                <p>♟ <a href={detail.ref} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline">Verificado en Chess-Results ({detail.players} jugadores)</a></p>
              )}
              {detail.email && <p>✉️ <a href={`mailto:${detail.email}`} className="text-amber-600 hover:underline">{detail.email}</a></p>}
              <p>🏆 {detail.events12m} torneos organizados (últimos 12 meses)</p>
              <p>{detail.verified ? '✅ Entidad verificada' : '⏳ Verificación pendiente'}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => toggle(detail.id)} className="text-xs font-bold bg-fide-800 text-white rounded-xl px-4 py-2">
                {followed.includes(detail.id) ? '✓ Siguiendo' : '🔔 Seguir torneos'}
              </button>
              <a href={`mailto:${detail.email || 'info@chessorganizers.com'}?subject=Reclamar ficha: ${encodeURIComponent(detail.name)}`} className="text-xs border border-gray-200 dark:border-fide-700 rounded-xl px-4 py-2 dark:text-fide-200">Reclamar propiedad</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

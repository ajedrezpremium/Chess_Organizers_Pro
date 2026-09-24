import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../api/client.js';
import { Card, Badge, Button, EmptyState } from '../design-system/ui.jsx';
import { STATUS_STYLES } from '../design-system/tokens.js';

// Página dedicada exclusiva del evento (diseño pro/moderno/digital/elegante).
// mode=public → /t/:slug · mode=private → /app/events/:id (gestión).
export default function EventPage({ mode = 'public' }) {
  const { slug, id } = useParams();
  const key = mode === 'private' ? id : slug;
  const [t, setT] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    const get = mode === 'private' ? api.getTournament(key) : api.public.getTournament(key);
    Promise.resolve(get).then((d) => setT(d.tournament || d)).catch(() => {}).finally(() => setLoading(false));
    if (mode === 'private' && key) {
      api.listTournamentPlayers(key).then((d) => setPlayers(d.players || d || [])).catch(() => {});
      api.listRounds(key).then((d) => setRounds(d.rounds || d || [])).catch(() => {});
    }
  }, [key, mode]);

  const downloadTRF = async () => {
    try {
      const blob = await api.exportTrf(key);
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([typeof blob === 'string' ? blob : JSON.stringify(blob)]));
      const a = document.createElement('a');
      a.href = url; a.download = `${(t?.name || 'torneo').replace(/\s+/g, '-').toLowerCase()}.trf`; a.click();
      URL.revokeObjectURL(url);
    } catch { setMsg('No se pudo descargar el TRF.'); }
  };

  if (loading) return <p className="text-sm text-gray-400 text-center py-16">Cargando evento…</p>;
  if (!t) return <EmptyState title="Evento no encontrado" hint="Revisa el enlace desde el panel de control." />;

  const liveRound = rounds.find((r) => !r.closed) || rounds[rounds.length - 1];

  return (
    <div className="max-w-6xl mx-auto">
      <Helmet><title>{t.name} — Chess Organizers Pro</title></Helmet>

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fide-900 via-fide-800 to-fide-700 dark:from-black dark:via-fide-900 dark:to-fide-800 text-white p-6 md:p-10 mb-4">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none text-7xl flex items-center justify-around">♚ ♛ ♜ ♝ ♞</div>
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={STATUS_STYLES[t.status] || STATUS_STYLES.active}>{t.status}</Badge>
              {t.federation && <span className="text-[11px] opacity-70">🌍 {t.federation}</span>}
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold mt-2">{t.name}</h1>
            <p className="text-sm opacity-80 mt-1">
              {[t.city, t.start_date, t.n_rounds ? `${t.n_rounds} rondas` : null, t.system, t.time_control].filter(Boolean).join(' · ')}
            </p>
            <div className="flex gap-4 mt-3 text-sm">
              <span>👥 <b>{players.length || t.player_count || '—'}</b> jugadores</span>
              <span>♟ <b>{rounds.length || t.n_rounds || '—'}</b> rondas</span>
              {liveRound && <span>🔴 <b>R{liveRound.number || liveRound.round_number}</b> en juego</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-[180px]">
            <Button size="sm" onClick={downloadTRF}>📄 Descargar TRF</Button>
            <Link to={`/public/tournament/${key}/tv`} className="text-center text-xs font-bold border border-white/30 rounded-xl px-4 py-2 hover:bg-white/10">📺 Wallboard TV</Link>
            <button onClick={() => { navigator.clipboard?.writeText(window.location.href); setMsg('Enlace copiado ✓'); }} className="text-xs font-semibold border border-white/30 rounded-xl px-4 py-2 hover:bg-white/10">🔗 Compartir</button>
            {msg && <p className="text-[11px] text-amber-300">{msg}</p>}
          </div>
        </div>
      </div>

      {mode === 'private' ? (
        <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
          <Card className="p-4">
            <h3 className="font-bold text-sm dark:text-white mb-2">🎛️ Consola del evento</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <Link to={`/app/tournament/${key}`} className="border dark:border-fide-700 rounded-xl p-3 hover:border-amber-400 dark:text-fide-100">⚙️ Gestión completa →<p className="opacity-60 mt-0.5">Pairings, resultados, rondas</p></Link>
              <Link to={`/app/tournament/${key}/scan`} className="border dark:border-fide-700 rounded-xl p-3 hover:border-amber-400 dark:text-fide-100">📸 Escáner IA →<p className="opacity-60 mt-0.5">Actas → PGN/TRF</p></Link>
              <Link to={`/t/${t.slug || key}`} className="border dark:border-fide-700 rounded-xl p-3 hover:border-amber-400 dark:text-fide-100">👁 Vista pública →<p className="opacity-60 mt-0.5">Lo que ven los jugadores</p></Link>
              <Link to={`/public/tournament/${key}`} className="border dark:border-fide-700 rounded-xl p-3 hover:border-amber-400 dark:text-fide-100">📊 Standings y pairings →<p className="opacity-60 mt-0.5">Clasificación en vivo</p></Link>
            </div>
            <h4 className="font-bold text-xs dark:text-white mt-4 mb-2">Rondas ({rounds.length})</h4>
            <div className="space-y-1.5">
              {rounds.map((r) => (
                <div key={r.id || r.number} className="flex items-center gap-2 text-xs border dark:border-fide-700 rounded-lg px-3 py-2 dark:text-fide-100">
                  <span className="font-bold">R{r.number || r.round_number}</span>
                  <span className="opacity-60">{r.pairings?.length ?? ''} partidas</span>
                  <span className="ml-auto">{r.closed ? '✅ cerrada' : r.published ? '📢 publicada' : '📝 borrador'}</span>
                </div>
              ))}
              {rounds.length === 0 && <p className="text-xs opacity-60">Sin rondas generadas todavía.</p>}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-bold text-sm dark:text-white mb-2">🔔 Estado y alertas</h3>
            <p className="text-xs dark:text-fide-200">👥 {players.length} jugadores inscritos</p>
            <p className="text-xs mt-1 dark:text-fide-200">⚠️ Revisa resultados pendientes antes de generar la siguiente ronda.</p>
            <Link to="/app/notifications" className="block text-center text-[11px] font-bold bg-fide-800 text-white rounded-lg px-2 py-2 mt-3">Abrir centro de notificaciones →</Link>
          </Card>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <Card className="p-4"><p className="font-bold text-xs dark:text-white mb-1">📊 Clasificación</p>
            <p className="text-xs opacity-70 mb-2">Tabla en vivo con desempates FIDE.</p>
            <Link to={`/public/tournament/${key}`} className="text-xs font-bold text-amber-600 hover:underline">Ver clasificación →</Link></Card>
          <Card className="p-4"><p className="font-bold text-xs dark:text-white mb-1">♟ Emparejamientos</p>
            <p className="text-xs opacity-70 mb-2">Por rondas, colores y tableros.</p>
            <Link to={`/public/tournament/${key}`} className="text-xs font-bold text-amber-600 hover:underline">Ver pairings →</Link></Card>
          <Card className="p-4"><p className="font-bold text-xs dark:text-white mb-1">📺 Directo</p>
            <p className="text-xs opacity-70 mb-2">Wallboard para pantallas del venue.</p>
            <Link to={`/public/tournament/${key}/tv`} className="text-xs font-bold text-amber-600 hover:underline">Abrir TV →</Link></Card>
        </div>
      )}
    </div>
  );
}

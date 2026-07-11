import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../api/client.js';
import { useTheme } from '../context/ThemeContext.jsx';

const FEATURES = [
  { icon: '♟', title: 'Pairings Automáticos', desc: 'Sistemas Suizo, Round-Robin, Burstein y Dubov con algoritmo FIDE estándar.' },
  { icon: '📊', title: 'Clasificación en Vivo', desc: 'Puntos, desempates FIDE, progreso y tabla cruzada actualizados al instante.' },
  { icon: '📄', title: 'Exportación Oficial', desc: 'PDF, CSV, TRF FIDE, boletines y certificados. Todo listo para federaciones.' },
  { icon: '🌐', title: 'Página Pública', desc: 'Cada torneo tiene su propia página con standings, pairings y wallboard TV.' },
  { icon: '🏆', title: 'Ligas y Circuitos', desc: 'Agrupa torneos en ligas con puntuación acumulada y clasificación general.' },
  { icon: '🤖', title: 'Árbitro IA', desc: 'Asistente basado en las Leyes FIDE 2023, potenciado por OpenRouter.' },
  { icon: '📧', title: 'Notificaciones', desc: 'Email, Telegram y WhatsApp para jugadores y organizadores.' },
  { icon: '📸', title: 'Escáner Pro', desc: 'Escanea libros de actas y planillas para archivar partidas en PGN/CBV.' },
];

const UPDATES = [
  { date: 'Jul 2026', text: 'Escáner de actas y planillas con OCR + IA — sube foto, obtén PGN.' },
  { date: 'Jun 2026', text: 'Migración a Supabase + Vercel serverless con OpenRouter AI.' },
  { date: 'May 2026', text: 'Ligas, Team Matches, FIDE homologación y certificados PDF.' },
  { date: 'Abr 2026', text: 'Self-registration, Stripe payments y notificaciones.' },
];

const FEATURED_TOURNAMENTS = [
  { name: 'ChessOrganizers Pro Masters', date: '15-22 Sep 2026', city: 'Madrid', players: 128, system: 'Suizo', color: '#f59e0b' },
  { name: 'COP World Blitz Championship', date: '10-14 Oct 2026', city: 'Barcelona', players: 200, system: 'Suizo', color: '#8b5cf6' },
  { name: 'European Club Cup', date: '1-8 Nov 2026', city: 'Valencia', players: 64, system: 'Round Robin', color: '#3b82f6' },
  { name: 'COP Fischer Random Open', date: '20-27 Nov 2026', city: 'Bilbao', players: 96, system: 'Suizo', color: '#06b6d4' },
  { name: 'Grand Slam Final 2026', date: '5-15 Dic 2026', city: 'Madrid', players: 8, system: 'Round Robin', color: '#ec4899' },
  { name: 'COP Online Arena Navideña', date: '26-30 Dic 2026', city: 'Online', players: 300, system: 'Suizo', color: '#14b8a6' },
];

function CountUp({ end, suffix = '' }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let i = 0; const t = setInterval(() => { i++; setCount(Math.min(i, end)); if (i >= end) clearInterval(t); }, 40);
    return () => clearInterval(t);
  }, [end]);
  return <>{count}{suffix}</>;
}

export default function Landing() {
  const { dark, toggle } = useTheme();
  const [tournaments, setTournaments] = useState([]);
  const featuredRef = useRef(null);

  useEffect(() => {
    api.public.listTournaments({ status: 'active', limit: 6, sort: 'created_at' })
      .then(setTournaments).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-fide-900 text-gray-900 dark:text-fide-100">
      <Helmet>
        <title>Chess Organizers Pro — Organiza Torneos de Ajedrez como un Profesional</title>
        <meta name="description" content="Plataforma profesional para organizar torneos de ajedrez. Pairings FIDE automáticos, clasificación en vivo, exportación TRF/PDF, ligas, notificaciones y escáner de actas IA." />
        <meta name="keywords" content="ajedrez, torneos, organizador, FIDE, pairings, suizo, round-robin, chess organizer" />
        <meta property="og:title" content="Chess Organizers Pro — Organiza Torneos de Ajedrez" />
        <meta property="og:description" content="Plataforma profesional para organizadores de ajedrez. Automatiza pairings, clasificación y exportación FIDE." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://chess-organizers-pro.vercel.app" />
        <meta property="og:image" content="https://chess-organizers-pro.vercel.app/og-image.png" />
        <link rel="canonical" href="https://chess-organizers-pro.vercel.app" />
      </Helmet>

      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-20px) rotate(5deg); } 75% { transform: translateY(10px) rotate(-3deg); } }
        @keyframes floatDelayed { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-15px) rotate(-5deg); } 75% { transform: translateY(8px) rotate(3deg); } }
        @keyframes pulseScale { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes carousel { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .chess-float { animation: float 6s ease-in-out infinite; }
        .chess-float-2 { animation: floatDelayed 7s ease-in-out infinite; }
        .chess-float-3 { animation: float 8s ease-in-out infinite 2s; }
        .shimmer-bg { background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%); background-size: 200% 100%; animation: shimmer 3s infinite; }
        .featured-scroll { display: flex; gap: 1rem; animation: carousel 30s linear infinite; }
        .featured-scroll:hover { animation-play-state: paused; }
      `}</style>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-fide-900/80 backdrop-blur-md border-b dark:border-fide-700">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-tight flex items-center gap-2">
            <span className="text-3xl chess-float">♛</span>
            <span className="dark:text-white">Chess Organizers</span>
            <span className="text-[10px] bg-amber-500 text-fide-900 px-1.5 py-0.5 rounded font-bold ml-1">PRO</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-fide-700 transition">
              {dark ? '☀️' : '🌙'}
            </button>
            <Link to="/login" className="text-sm font-medium text-fide-600 dark:text-fide-300 hover:underline">Ingresar</Link>
            <Link to="/register" className="text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-fide-900 px-4 py-1.5 rounded-lg transition">Empezar</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-fide-900 via-fide-800 to-fide-700 dark:from-black dark:via-fide-900 dark:to-fide-800" />
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5 L35 15 L45 15 L37 22 L40 32 L30 26 L20 32 L23 22 L15 15 L25 15 Z\' fill=\'%23fff\'/%3E%3C/svg%3E")', backgroundSize: '60px 60px' }} />

        {/* Chess pieces floating background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <span className="absolute text-7xl opacity-[0.06] chess-float" style={{ top: '10%', left: '5%' }}>♚</span>
          <span className="absolute text-6xl opacity-[0.05] chess-float-2" style={{ top: '20%', right: '10%' }}>♛</span>
          <span className="absolute text-8xl opacity-[0.04] chess-float" style={{ bottom: '15%', left: '15%' }}>♜</span>
          <span className="absolute text-5xl opacity-[0.06] chess-float-3" style={{ top: '40%', right: '25%' }}>♝</span>
          <span className="absolute text-7xl opacity-[0.04] chess-float-2" style={{ bottom: '25%', right: '5%' }}>♞</span>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-semibold mb-6 chess-float-3">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Nueva herramienta: Escáner de Actas con IA
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold text-white mb-4 leading-tight">
            Organiza Torneos de Ajedrez<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">Como un Profesional</span>
          </h1>
          <p className="text-lg md:text-xl text-fide-200 max-w-2xl mx-auto mb-8 leading-relaxed">
            Plataforma completa para organizadores: pairings automáticos FIDE, clasificación en vivo,
            exportación TRF/PDF, escáner de actas IA, ligas, notificaciones y más. Gratis para empezar.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="relative group bg-amber-500 hover:bg-amber-600 text-fide-900 font-bold px-10 py-3.5 rounded-xl text-lg transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105">
              Crear Cuenta Gratis
              <span className="absolute inset-0 rounded-xl shimmer-bg opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <Link to="/public" className="border border-fide-400 hover:border-fide-300 text-fide-100 px-8 py-3.5 rounded-xl text-lg transition hover:bg-white/5">
              Ver Torneos Públicos →
            </Link>
          </div>

          {/* Stats counters */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-3xl font-bold text-white"><CountUp end={24} />+</div>
              <div className="text-fide-300 text-xs mt-1">Sistemas</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-3xl font-bold text-amber-400"><CountUp end={500} />+</div>
              <div className="text-fide-300 text-xs mt-1">Jugadores</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-3xl font-bold text-white"><CountUp end={100} />%</div>
              <div className="text-fide-300 text-xs mt-1">Gratis</div>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-fide-900 to-transparent" />
      </section>

      {/* ── FEATURED TOURNAMENTS CAROUSEL ── */}
      <section className="py-16 overflow-hidden bg-gray-50 dark:bg-fide-800/30">
        <div className="max-w-6xl mx-auto px-4 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center dark:text-white">Torneos Destacados</h2>
          <p className="text-gray-500 dark:text-fide-400 text-center mt-1">Eventos internacionales organizados con Chess Organizers Pro</p>
        </div>
        <div className="relative">
          <div className="featured-scroll" ref={featuredRef}>
            {[...FEATURED_TOURNAMENTS, ...FEATURED_TOURNAMENTS].map((t, i) => (
              <div key={i} className="shrink-0 w-64 bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: t.color }}>♛</div>
                  <h3 className="font-bold text-sm dark:text-white truncate">{t.name}</h3>
                </div>
                <div className="space-y-1.5 text-xs text-gray-500 dark:text-fide-400">
                  <p>📅 {t.date}</p>
                  <p>📍 {t.city}</p>
                  <p>👥 {t.players} jugadores</p>
                  <p>♟ {t.system}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 dark:text-white">Todo lo que necesitas</h2>
          <p className="text-gray-500 dark:text-fide-400 text-center mb-12 max-w-xl mx-auto">
            Desde el club local hasta torneos federados internacionales.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="group bg-gray-50 dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 hover:shadow-lg hover:border-fide-300 dark:hover:border-fide-600 transition-all duration-300 hover:-translate-y-1">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">{f.icon}</div>
                <h3 className="font-bold text-sm dark:text-white mb-1.5">{f.title}</h3>
                <p className="text-xs text-gray-500 dark:text-fide-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TORNEOS ACTIVOS ── */}
      {tournaments.length > 0 && (
        <section className="py-16 md:py-24 px-4 bg-gray-50 dark:bg-fide-800/50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 dark:text-white">Torneos Activos</h2>
            <p className="text-gray-500 dark:text-fide-400 text-center mb-10">Inscríbete y sigue los resultados en vivo.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tournaments.map((t) => (
                <Link key={t.id} to={`/public/tournament/${t.id}`}
                  className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 hover:shadow-lg hover:border-fide-300 dark:hover:border-fide-600 transition group">
                  <div className="flex items-center gap-2 mb-2">
                    {t.logo_url && <img src={t.logo_url} alt="" className="w-6 h-6 rounded object-contain" />}
                    <h3 className="font-bold text-sm dark:text-white truncate group-hover:text-fide-600 dark:group-hover:text-fide-300 transition-colors">{t.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-fide-400">
                    {t.city && `${t.city} · `}{t.federation}{t.start_date && ` · ${t.start_date}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-fide-100 dark:bg-fide-700 text-fide-700 dark:text-fide-300 px-2 py-0.5 rounded-full">{t.system === 'dutch' ? 'Suizo' : t.system}</span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">{t.n_rounds} rondas</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/public" className="text-sm text-fide-600 dark:text-fide-300 hover:underline font-medium">Ver todos los torneos →</Link>
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 md:py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 dark:text-white">Cómo funciona</h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { step: '1', title: 'Crea tu torneo', desc: 'Define sistema, rondas, jugadores y configuración FIDE en minutos.' },
              { step: '2', title: 'Gestiona en vivo', desc: 'Pairings automáticos, resultados, clasificación y notificaciones.' },
              { step: '3', title: 'Exporta y comparte', desc: 'TRF, PDF, página pública, wallboard TV y homologación FIDE.' },
            ].map((s) => (
              <div key={s.step}>
                <div className="w-14 h-14 bg-gradient-to-br from-fide-600 to-fide-700 dark:from-fide-600 dark:to-fide-800 text-white rounded-xl flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg chess-float-3">{s.step}</div>
                <h3 className="font-bold text-lg mb-2 dark:text-white">{s.title}</h3>
                <p className="text-sm text-gray-500 dark:text-fide-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SCANNER ── */}
      <section className="py-20 px-4 bg-gradient-to-br from-fide-800 via-fide-900 to-fide-800 dark:from-black dark:via-fide-900 dark:to-black">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">📸</div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Escáner de Actas Inteligente</h2>
          <p className="text-fide-200 mb-8 text-lg max-w-2xl mx-auto">
            Sube una foto del libro de actas o planilla del torneo y nuestro OCR + IA extrae
            automáticamente todas las partidas en formato PGN, CBV, TRF o JSON.
            Ahorra horas de trabajo manual.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="bg-amber-500 hover:bg-amber-600 text-fide-900 font-bold px-8 py-3.5 rounded-xl text-lg transition shadow-lg shadow-amber-500/25">
              Probar Escáner Gratis
            </Link>
            <a href="#features" className="border border-fide-400 hover:border-fide-300 text-fide-100 px-8 py-3.5 rounded-xl text-lg transition">
              Más información →
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 bg-gradient-to-br from-fide-800 to-fide-900 dark:from-black dark:to-fide-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">¿Listo para organizar?</h2>
          <p className="text-fide-200 mb-8 text-lg">Empieza gratis. Sin tarjeta de crédito. En 2 minutos tienes tu torneo funcionando.</p>
          <Link to="/register" className="inline-block bg-amber-500 hover:bg-amber-600 text-fide-900 font-bold px-10 py-3.5 rounded-xl text-lg transition shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105 transition-all duration-300">
            Crear Cuenta Gratis
          </Link>
        </div>
      </section>

      {/* ── UPDATES ── */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-fide-800/30">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-sm font-semibold text-fide-500 dark:text-fide-400 uppercase tracking-wider text-center mb-6">Últimas actualizaciones</h3>
          <div className="space-y-3">
            {UPDATES.map((u) => (
              <div key={u.date} className="flex gap-3 text-sm">
                <span className="text-fide-400 dark:text-fide-500 shrink-0 w-16 font-mono">{u.date}</span>
                <span className="text-gray-600 dark:text-fide-300">{u.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-fide-900 dark:bg-black text-fide-300 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-bold text-white">Chess Organizers Pro</span> — Hecho para la comunidad ajedrecística.
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a href="https://chessorganizers.com" target="_blank" rel="noreferrer" className="hover:text-white transition">chessorganizers.com</a>
            <a href="https://github.com/ajedrezpremium/Chess_Organizers_Pro" target="_blank" rel="noreferrer" className="hover:text-white transition">GitHub</a>
            <Link to="/login" className="hover:text-white transition">Ingresar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

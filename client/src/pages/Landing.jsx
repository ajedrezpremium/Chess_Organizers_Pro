import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  { icon: '🛡', title: 'Homologación FIDE', desc: 'Genera reportes FIDE completos para enviar a tu federación.' },
];

const UPDATES = [
  { date: 'Jun 2026', text: 'Migración a Supabase + Vercel serverless con OpenRouter AI.' },
  { date: 'May 2026', text: 'Ligas, Team Matches, FIDE homologación y certificados PDF.' },
  { date: 'Abr 2026', text: 'Self-registration, Stripe payments y notificaciones.' },
  { date: 'Mar 2026', text: 'Live TV wallboard, bulletins PDF y estadísticas avanzadas.' },
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

  useEffect(() => {
    api.public.listTournaments({ status: 'active', limit: 6, sort: 'created_at' })
      .then(setTournaments).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-fide-900 text-gray-900 dark:text-fide-100">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-fide-900/80 backdrop-blur-md border-b dark:border-fide-700">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-tight">
            <span className="text-fide-600 dark:text-fide-300">♛</span>{' '}
            <span className="dark:text-white">Chess Organizers</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-fide-700 transition">
              {dark ? '☀️' : '🌙'}
            </button>
            <Link to="/login" className="text-sm font-medium text-fide-600 dark:text-fide-300 hover:underline">Ingresar</Link>
            <Link to="/register" className="text-sm font-semibold bg-fide-700 hover:bg-fide-800 text-white px-4 py-1.5 rounded-lg transition">Empezar</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-fide-900 via-fide-800 to-fide-700 dark:from-black dark:via-fide-900 dark:to-fide-800" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5 L35 15 L45 15 L37 22 L40 32 L30 26 L20 32 L23 22 L15 15 L25 15 Z\' fill=\'%23fff\'/%3E%3C/svg%3E")', backgroundSize: '60px 60px' }} />
        <div className="relative max-w-5xl mx-auto px-4 py-24 md:py-32 text-center">
          <div className="text-6xl mb-6">♛</div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 leading-tight">
            Organiza Torneos de Ajedrez<br /><span className="text-amber-400">Como un Profesional</span>
          </h1>
          <p className="text-lg md:text-xl text-fide-200 max-w-2xl mx-auto mb-8 leading-relaxed">
            Plataforma completa para organizadores: pairings automáticos FIDE, clasificación en vivo,
            exportación TRF/PDF, ligas, notificaciones y más. Gratis para empezar.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="bg-amber-500 hover:bg-amber-600 text-fide-900 font-bold px-8 py-3 rounded-xl text-lg transition shadow-lg shadow-amber-500/25">
              Crear Cuenta Gratis
            </Link>
            <Link to="/public" className="border border-fide-400 hover:border-fide-300 text-fide-100 px-8 py-3 rounded-xl text-lg transition">
              Ver Torneos Públicos →
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-center">
            <div><div className="text-3xl font-bold text-white"><CountUp end={24} />+</div><div className="text-fide-300 text-sm mt-1">Sistemas de torneo</div></div>
            <div><div className="text-3xl font-bold text-amber-400"><CountUp end={500} />+</div><div className="text-fide-300 text-sm mt-1">Jugadores por torneo</div></div>
            <div><div className="text-3xl font-bold text-white"><CountUp end={100} />%</div><div className="text-fide-300 text-sm mt-1">GRATIS para empezar</div></div>
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
              <div key={f.title} className="bg-gray-50 dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 hover:shadow-lg hover:border-fide-300 dark:hover:border-fide-600 transition">
                <div className="text-3xl mb-3">{f.icon}</div>
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
                  className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 hover:shadow-lg hover:border-fide-300 dark:hover:border-fide-600 transition">
                  <div className="flex items-center gap-2 mb-2">
                    {t.logo_url && <img src={t.logo_url} alt="" className="w-6 h-6 rounded object-contain" />}
                    <h3 className="font-bold text-sm dark:text-white truncate">{t.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-fide-400">
                    {t.city && `${t.city} · `}{t.federation}{t.start_date && ` · ${t.start_date}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-fide-100 dark:bg-fide-700 text-fide-700 dark:text-fide-300 px-2 py-0.5 rounded-full">{t.system}</span>
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
                <div className="w-12 h-12 bg-fide-700 dark:bg-fide-600 text-white rounded-xl flex items-center justify-center text-lg font-bold mx-auto mb-4">{s.step}</div>
                <h3 className="font-bold text-lg mb-2 dark:text-white">{s.title}</h3>
                <p className="text-sm text-gray-500 dark:text-fide-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 bg-gradient-to-br from-fide-800 to-fide-900 dark:from-black dark:to-fide-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">¿Listo para organizar?</h2>
          <p className="text-fide-200 mb-8 text-lg">Empieza gratis. Sin tarjeta de crédito. En 2 minutos tienes tu torneo funcionando.</p>
          <Link to="/register" className="inline-block bg-amber-500 hover:bg-amber-600 text-fide-900 font-bold px-10 py-3.5 rounded-xl text-lg transition shadow-lg shadow-amber-500/25">
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

import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { TOP_LINK_GROUPS, TOP_INFLUENCERS, TOP_HISPANO } from '../data/topLinks.js';

function LinkCard({ name, url, featured }) {
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className={`block px-3 py-2 rounded-xl border text-xs transition truncate hover:border-amber-400 hover:shadow-sm dark:text-fide-200 ${featured ? 'font-semibold bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-fide-700'}`}>
      {name}
    </a>
  );
}

export default function EnlacesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-fide-900">
      <Helmet>
        <title>TOP100 Enlaces de ajedrez — Chess Organizers Pro</title>
        <meta name="description" content="Directorio TOP100: organismos, rankings, bases de partidas, noticias, influencers y Top 30 hispano del ajedrez." />
      </Helmet>
      <header className="border-b border-gray-200 dark:border-fide-800 bg-white dark:bg-fide-950">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-amber-500 text-xl">♛</span>
            <span className="font-bold dark:text-white">Chess Organizers Pro</span>
          </Link>
          <Link to="/register" className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-lg transition">Empezar gratis</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold dark:text-white">🔗 TOP100 Webs de Ajedrez</h1>
          <p className="text-sm text-gray-500 dark:text-fide-400 mt-2">Organismos · Rankings · Bases · Noticias · Influencers · Top Hispano</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {TOP_LINK_GROUPS.map((g) => (
            <section key={g.id} className="bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 rounded-2xl p-4">
              <h2 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-3">{g.title}</h2>
              <div className="space-y-1.5">
                {g.links.map((l) => <LinkCard key={l.url} name={l.name} url={l.url} />)}
              </div>
            </section>
          ))}
        </div>

        <section className="bg-white dark:bg-fide-800 border border-gray-200 dark:border-fide-700 rounded-2xl p-4 sm:p-6 mb-6">
          <h2 className="text-sm font-bold dark:text-white mb-1">⭐ Top 25 Influencers 2025</h2>
          <p className="text-[11px] text-gray-500 dark:text-fide-400 mb-3">Selección por audiencia YouTube/Twitch/TikTok/IG — impacto, streaming y comunidad</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {TOP_INFLUENCERS.map((l) => <LinkCard key={l.url} name={l.name} url={l.url} />)}
          </div>
        </section>

        <section className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 sm:p-6">
          <h2 className="text-sm font-bold dark:text-white mb-1">🇪🇸 Top 30 Hispano (+80k)</h2>
          <p className="text-[11px] text-gray-500 dark:text-fide-400 mb-3">No hay lista oficial única — ampliado a 30 para incluir +80k significativos</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {TOP_HISPANO.map((l) => <LinkCard key={l.url} name={l.name} url={l.url} featured={l.featured} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useI18n } from '../i18n/context.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import SyncStatus from './SyncStatus.jsx';
import SWUpdatePrompt from './SWUpdatePrompt.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const userMenuRef = useRef(null);
  const moreRef = useRef(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SVG_ICONS = {
  tournaments: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  newTournament: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a7 7 0 100 14 7 7 0 000-14zm0 3a4 4 0 100 8 4 4 0 000-8zm0 3a1 1 0 110 2 1 1 0 010-2z" /></svg>,
  scan: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  elo: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  arbiter: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l7 4v5c0 5-3.5 9.5-7 10.5C8.5 20.5 5 16 5 11V6l7-4z" /></svg>,
  search: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>,
  directory: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01" /></svg>,
  leagues: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8m-4-3v3m0-3a5 5 0 005-5V5H7v8a5 5 0 005 5z" /></svg>,
  live: <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />EN DIRECTO</span>,
  dots: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>,
  calendar: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
};

const mainLinks = [
    { to: '/app/dashboard-pro', label: 'Panel', icon: 'tournaments', title: 'Panel de control' },
    { to: '/app/new', label: t('nav.newTournament'), icon: 'newTournament', title: 'Nuevo torneo' },
    { to: '/arbiter', label: t('nav.arbiter'), icon: 'arbiter', title: 'Árbitro' },
    { to: '/app/leagues', label: t('nav.leagues'), icon: 'leagues', title: t('nav.leagues') },
  ];

  const moreLinks = [
    { to: '/app/scan', label: t('nav.scanner'), icon: 'scan', title: 'Escanear planillas' },
    { to: '/app/elo', label: t('nav.elo'), icon: 'elo', title: 'Dashboard Elo' },
    { to: '/app/directory', label: 'Directorio', icon: 'directory', title: 'Directorio federaciones, clubes y escuelas' },
    { to: `/catalog?year=${currentYear}`, label: 'Calendario', icon: 'calendar', title: 'Calendario — torneos por fecha' },
    { to: 'https://calendar.fide.com/calendar.php', label: 'Calendario FIDE', icon: 'calendar', title: 'Calendario oficial FIDE', external: true },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-fide-900 dark:text-gray-100 transition-colors duration-300">
      <nav className="bg-fide-800 dark:bg-fide-950 text-white shadow-lg border-b border-fide-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/app/dashboard" className="flex items-center gap-2 group">
              <span className="text-amber-400 text-xl transition-transform duration-200 group-hover:scale-110">♛</span>
              <div className="leading-tight">
                <span className="font-bold text-base tracking-tight block">CHESS</span>
                <span className="text-amber-400 text-[11px] font-semibold tracking-widest block -mt-0.5">ORGANIZERS PRO</span>
              </div>
            </Link>
              <div className="hidden sm:flex items-center gap-1">
              {mainLinks.map((l) => {
                const isActive = location.pathname === l.to || (l.to !== '/' && location.pathname.startsWith(l.to));
                return (
                  <Link key={l.to} to={l.to} title={l.title}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      isActive ? 'bg-fide-700 text-white shadow-sm' : 'text-fide-300 hover:text-white hover:bg-fide-700/50'
                    }`}>
                    {SVG_ICONS[l.icon]}
                    <span className="hidden lg:inline">{l.label}</span>
                  </Link>
                );
              })}
              <a href="https://lichess.org/broadcast" target="_blank" rel="noreferrer" title="En directo — Lichess Broadcast" aria-label="En directo — Lichess Broadcast"
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white transition shadow-sm animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
              </a>
              <div className="relative" ref={moreRef}>
                <button onClick={() => setMoreOpen(!moreOpen)} title="Más herramientas"
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${moreOpen ? 'bg-fide-700 text-white' : 'text-fide-300 hover:text-white hover:bg-fide-700/50'}`}>
                  {SVG_ICONS.dots}
                  <span className="hidden lg:inline">Más</span>
                </button>
                {moreOpen && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl shadow-xl py-1.5 z-50">
                    {moreLinks.map((l) => (
                      l.external ? (
                        <a key={l.to} href={l.to} target="_blank" rel="noreferrer" onClick={() => setMoreOpen(false)} title={l.title}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm bg-red-600/10 text-red-500 dark:text-red-400 hover:bg-red-600 hover:text-white transition">
                          {SVG_ICONS[l.icon]}<span className="font-semibold text-xs tracking-wider">{l.label}</span>
                        </a>
                      ) : (
                        <Link key={l.to} to={l.to} onClick={() => setMoreOpen(false)} title={l.title}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">
                          <span className="text-fide-400">{SVG_ICONS[l.icon]}</span>{l.label}
                        </Link>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => setSearchNonce((n) => n + 1)} title="Buscar (Ctrl+K)" aria-label="Buscar"
              className="p-2 rounded-lg hover:bg-fide-700 text-fide-300 hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
            </button>
            <SyncStatus />
            <NotificationDropdown />
            <Link to="/pricing" title={t('nav.planMembership')} aria-label={t('nav.planMembership')} className="p-2 rounded-lg hover:bg-fide-700 transition text-base leading-none" >💎</Link>
            <GlobalSearch myTournaments={[]} openNonce={searchNonce} />
            <div className="hidden sm:relative sm:flex items-center" ref={userMenuRef}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} title={user?.name} aria-label={user?.name || t('nav.myProfile')}
                className="flex items-center gap-1.5 pl-2 border-l border-fide-700 hover:bg-fide-700/50 pr-1.5 py-1.5 rounded-lg transition">
                <div className="w-7 h-7 rounded-full bg-fide-600 flex items-center justify-center text-xs font-bold text-amber-400">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <svg className={`w-3 h-3 text-fide-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl shadow-xl py-1.5 z-50">
                  <div className="px-4 py-2 border-b dark:border-fide-700">
                    <p className="text-sm font-medium dark:text-white truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-fide-400 truncate">{user?.email}</p>
                  </div>
                  <Link to="/app/player" onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">
                    <span className="text-base">♟</span> {t('nav.myProfile')}
                  </Link>
                  <Link to="/app/inbox" onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">
                    <span className="text-base">📬</span> {t('nav.inbox')}
                  </Link>
                  <div className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-fide-200">
                    <span className="flex items-center gap-2"><span className="text-base">🌐</span></span>
                    <LangSwitcher />
                  </div>
                  <button onClick={() => toggle()}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">
                    <span className="text-base">{dark ? '☀️' : '🌙'}</span> {dark ? t('nav.lightMode') : t('nav.darkMode')}
                  </button>
                  <div className="border-t dark:border-fide-700 mt-1 pt-1">
                    <button onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      {t('nav.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden p-2 rounded-lg hover:bg-fide-700 transition-all duration-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-fide-700/50 px-4 py-3 space-y-1 bg-fide-800/95 backdrop-blur-sm animate-fadeIn max-h-[70vh] overflow-auto">
            {mainLinks.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} title={l.title}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-fide-200 hover:text-white hover:bg-fide-700 text-sm transition-all duration-200">
                {SVG_ICONS[l.icon]}
                {l.label}
              </Link>
            ))}
            <a href="https://lichess.org/broadcast" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)} title="En directo — Lichess Broadcast"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-600 text-white animate-pulse font-bold tracking-widest">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />EN DIRECTO
            </a>
            <p className="text-[10px] font-bold uppercase tracking-widest text-fide-500 px-3 pt-2">Más</p>
            {moreLinks.map((l) => (
              l.external ? (
                <a key={l.to} href={l.to} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)} title={l.title}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-600/15 text-red-400 transition-all duration-200">
                  {SVG_ICONS[l.icon]}
                  {l.label}
                </a>
              ) : (
                <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} title={l.title}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-fide-200 hover:text-white hover:bg-fide-700 text-sm transition-all duration-200">
                  {SVG_ICONS[l.icon]}
                  {l.label}
                </Link>
              )
            ))}
            <div className="border-t border-fide-700/50 pt-2 mt-2 space-y-1">
              <Link to="/app/player" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-fide-200 hover:text-white hover:bg-fide-700 text-sm transition-all duration-200">
                <span>♟</span> {t('nav.myProfile')}
              </Link>
              <Link to="/app/inbox" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-fide-200 hover:text-white hover:bg-fide-700 text-sm transition-all duration-200">
                <span>📬</span> {t('nav.inbox')}
              </Link>
              <Link to="/app/notifications" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-fide-200 hover:text-white hover:bg-fide-700 text-sm transition-all duration-200">
                <span>🔔</span> Notificaciones
              </Link>
              <Link to="/pricing" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-fide-200 hover:text-white hover:bg-fide-700 text-sm transition-all duration-200">
                <span>💎</span> {t('nav.planMembership')}
              </Link>
              <button onClick={() => { setMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-900/20 text-sm transition-all duration-200">
                {t('nav.logout')}
              </button>
            </div>
          </div>
        )}
      </nav>
      <SWUpdatePrompt />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-fide-950 border-t border-fide-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Column 1: Brand */}
            <div>
              <Link to="/app/dashboard" className="flex items-center gap-2 mb-3">
                <span className="text-amber-400 text-xl">♛</span>
                <div className="leading-tight">
                  <span className="font-bold text-base tracking-tight text-white block">CHESS</span>
                  <span className="text-amber-400 text-[11px] font-semibold tracking-widest block -mt-0.5">ORGANIZERS PRO</span>
                </div>
              </Link>
              <p className="text-xs text-fide-400 leading-relaxed">
                {t('app.tagline')}
              </p>
              <p className="text-[10px] text-fide-500 mt-3">
                &copy; {new Date().getFullYear()} Chess Organizers Pro. {t('app.allRights')}
              </p>
            </div>

            {/* Column 2: Legal */}
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">{t('footer.legal')}</h4>
              <ul className="space-y-2">
                <li><Link to="/legal/terms" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('footer.terms')}</Link></li>
                <li><Link to="/legal/privacy" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('footer.privacy')}</Link></li>
                <li><Link to="/legal/cookies" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('footer.cookies')}</Link></li>
                <li><Link to="/legal/notice" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('footer.legalNotice')}</Link></li>
              </ul>
            </div>

            {/* Column 3: Sitemap */}
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">{t('nav.sitemap') || 'Mapa del sitio'}</h4>
              <ul className="space-y-2">
                <li><Link to="/app/dashboard" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.tournaments')}</Link></li>
                <li><Link to="/app/new" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.newTournament')}</Link></li>
                <li><Link to="/app/player" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.myProfile')}</Link></li>
                <li><Link to="/arbiter" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.arbiter')}</Link></li>
                <li><Link to="/app/leagues" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.leagues')}</Link></li>
                <li><a href="/public" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('register.viewTournaments')}</a></li>
                <li><a href="/pricing" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.pricing') || 'Planes'}</a></li>
                <li><Link to="/enlaces" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">🔗 TOP100 Enlaces</Link></li>
                <li><Link to="/newsletter" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">Newsletter</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-fide-800 text-center">
            <p className="text-[10px] text-fide-500">
              ♛ Chess Organizers Pro v1.0 &middot; {t('app.tagline')} &middot; {t('app.allRights')}
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}

import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useI18n } from '../i18n/context.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import SyncStatus from './SyncStatus.jsx';
import SWUpdatePrompt from './SWUpdatePrompt.jsx';
import ChatBot from './ChatBot.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navLinks = [
    { to: '/', label: t('nav.tournaments'), icon: '◈' },
    { to: '/new', label: t('nav.newTournament'), icon: '+' },
    { to: '/player', label: t('nav.myProfile'), icon: '♟' },
    { to: '/arbiter', label: t('nav.arbiter'), icon: '⚖️' },
    { to: '/leagues', label: 'Ligas', icon: '🏆' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-fide-900 dark:text-gray-100 transition-colors duration-300">
      <nav className="bg-fide-800 dark:bg-fide-950 text-white shadow-lg border-b border-fide-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="text-amber-400 text-xl transition-transform duration-200 group-hover:scale-110">♛</span>
              <div className="leading-tight">
                <span className="font-bold text-base tracking-tight block">CHESS</span>
                <span className="text-amber-400 text-[11px] font-semibold tracking-widest block -mt-0.5">ORGANIZERS PRO</span>
              </div>
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {navLinks.map((l) => {
                const isActive = location.pathname === l.to || (l.to !== '/' && location.pathname.startsWith(l.to));
                return (
                  <Link key={l.to} to={l.to}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive ? 'bg-fide-700 text-white shadow-sm' : 'text-fide-300 hover:text-white hover:bg-fide-700/50'
                    }`}>
                    <span className="text-xs">{l.icon}</span>
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LangSwitcher />
            <SyncStatus />
            <NotificationDropdown />
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-fide-700 transition-all duration-200" title={dark ? 'Modo claro' : 'Modo oscuro'}>
              {dark ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-5 text-fide-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-fide-700">
              <div className="w-7 h-7 rounded-full bg-fide-600 flex items-center justify-center text-xs font-bold text-amber-400">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm text-fide-200 max-w-[120px] truncate">{user?.name}</span>
            </div>
            <button onClick={handleLogout}
              className="bg-fide-700 hover:bg-red-600 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden p-2 rounded-lg hover:bg-fide-700 transition-all duration-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-fide-700/50 px-4 py-3 space-y-1 bg-fide-800/95 backdrop-blur-sm animate-fadeIn">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-fide-200 hover:text-white hover:bg-fide-700 text-sm transition-all duration-200">
                <span className="text-xs">{l.icon}</span>
                {l.label}
              </Link>
            ))}
            <div className="border-t border-fide-700/50 pt-2 mt-2 flex items-center gap-2 px-3 py-2 text-fide-400 text-sm">
              <div className="w-6 h-6 rounded-full bg-fide-600 flex items-center justify-center text-xs font-bold text-amber-400">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
              {user?.name}
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
              <Link to="/" className="flex items-center gap-2 mb-3">
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
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">Términos y condiciones</a></li>
                <li><a href="#" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">Política de privacidad</a></li>
                <li><a href="#" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">Política de cookies</a></li>
                <li><a href="#" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">Aviso legal</a></li>
              </ul>
            </div>

            {/* Column 3: Sitemap */}
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">{t('nav.sitemap') || 'Mapa del sitio'}</h4>
              <ul className="space-y-2">
                <li><Link to="/" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.tournaments')}</Link></li>
                <li><Link to="/new" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.newTournament')}</Link></li>
                <li><Link to="/player" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.myProfile')}</Link></li>
                <li><Link to="/arbiter" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.arbiter')}</Link></li>
                <li><Link to="/leagues" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">Ligas</Link></li>
                <li><a href="/public" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('register.viewTournaments')}</a></li>
                <li><a href="/pricing" className="text-xs text-fide-400 hover:text-amber-400 transition-colors">{t('nav.pricing') || 'Planes'}</a></li>
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

      <ChatBot />
    </div>
  );
}

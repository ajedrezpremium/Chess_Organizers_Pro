import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useI18n } from '../i18n/context.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
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
  const [enlacesOpen, setEnlacesOpen] = useState(false);
  const userMenuRef = useRef(null);
  const enlacesRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (enlacesRef.current && !enlacesRef.current.contains(e.target)) setEnlacesOpen(false);
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
  leagues: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8m-4-3v3m0-3a5 5 0 005-5V5H7v8a5 5 0 005 5z" /></svg>,
  live: <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />EN DIRECTO</span>,
};

const navLinks = [
    { to: '/app/dashboard', label: t('nav.tournaments'), icon: 'tournaments', title: 'Torneos' },
    { to: '/app/new', label: t('nav.newTournament'), icon: 'newTournament', title: 'Nuevo' },
    { to: 'https://lichess.org/broadcast', label: t('nav.liveBroadcast'), icon: 'live', title: 'En directo — Lichess Broadcast', external: true, red: true },
    { to: '/app/scan', label: t('nav.scanner'), icon: 'scan', title: 'Escanear' },
    { to: '/app/elo', label: t('nav.elo'), icon: 'elo', title: 'Dashboard Elo' },
    { to: '/arbiter', label: t('nav.arbiter'), icon: 'arbiter', title: 'Árbitro' },
    { to: '/app/leagues', label: t('nav.leagues'), icon: 'leagues', title: t('nav.leagues') },
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
              {navLinks.map((l) => {
                if (l.external) {
                  return (
                    <a key={l.to} href={l.to} target="_blank" rel="noreferrer" title={l.title}
                      className={`flex items-center justify-center px-3 py-2 rounded-full text-xs font-black tracking-widest transition-all duration-200 shadow-sm hover:shadow-md ${l.red ? 'bg-red-600 text-white hover:bg-red-500 animate-pulse border border-red-400' : 'text-fide-300 hover:text-white hover:bg-fide-700/50'}`}>
                      {SVG_ICONS[l.icon] || <span className="text-xs">{l.label}</span>}
                    </a>
                  );
                }
                const isActive = location.pathname === l.to || (l.to !== '/' && location.pathname.startsWith(l.to));
                return (
                  <Link key={l.to} to={l.to} title={l.title}
                    className={`flex items-center justify-center px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive ? 'bg-fide-700 text-white shadow-sm' : 'text-fide-300 hover:text-white hover:bg-fide-700/50'
                    }`}>
                    {SVG_ICONS[l.icon] || <span className="text-xs">{l.icon}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Calendario */}
            <Link to="/catalog?year=2026" title="Calendario 2026 — torneos por fecha" className="p-2 rounded-lg hover:bg-fide-700 text-fide-300 hover:text-white transition" aria-label="Calendario">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </Link>
            {/* Enlaces TOP100 */}
            <div className="relative" ref={enlacesRef}>
              <button onClick={() => setEnlacesOpen(!enlacesOpen)} title="Enlaces — TOP100 webs de ajedrez" className={`p-2 rounded-lg transition ${enlacesOpen ? 'bg-fide-700 text-white' : 'hover:bg-fide-700 text-fide-300 hover:text-white'}`} aria-label="Enlaces">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </button>
              {enlacesOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-[480px] bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl shadow-2xl z-50 max-h-[70vh] overflow-auto">
                  <div className="p-3 border-b dark:border-fide-700 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-fide-900 dark:text-white uppercase tracking-widest">🔗 TOP100 Webs Ajedrez</h4>
                    <button onClick={() => setEnlacesOpen(false)} className="text-fide-400 hover:text-fide-600">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-3 text-xs">
                    <div>
                      <p className="font-bold text-fide-700 dark:text-amber-400 mb-1">Organismos</p>
                      <ul className="space-y-1">
                        <li><a href="https://www.fide.com" target="_blank" rel="noreferrer" className="hover:text-amber-600 dark:hover:text-amber-400">FIDE</a></li>
                        <li><a href="https://www.ecfchess.org.uk" target="_blank" rel="noreferrer" className="hover:text-amber-600">ECF</a></li>
                        <li><a href="https://new.uschess.org" target="_blank" rel="noreferrer" className="hover:text-amber-600">USCF</a></li>
                        <li><a href="https://www.feda.org" target="_blank" rel="noreferrer" className="hover:text-amber-600">FEDA</a></li>
                        <li><a href="https://www.europechess.org" target="_blank" rel="noreferrer" className="hover:text-amber-600">ECU</a></li>
                        <li><a href="https://www.fide.com/calendar" target="_blank" rel="noreferrer" className="hover:text-amber-600">FIDE Calendar</a></li>
                      </ul>
                      <p className="font-bold text-fide-700 dark:text-amber-400 mt-3 mb-1">Rankings</p>
                      <ul className="space-y-1">
                        <li><a href="https://2700chess.com" target="_blank" rel="noreferrer" className="hover:text-amber-600">2700chess.com</a></li>
                        <li><a href="http://www.chessmetrics.com" target="_blank" rel="noreferrer" className="hover:text-amber-600">Chessmetrics</a></li>
                        <li><a href="https://www.2700chess.com/women" target="_blank" rel="noreferrer" className="hover:text-amber-600">2700 Women</a></li>
                        <li><a href="https://ratings.fide.com/top.phtml?list=open" target="_blank" rel="noreferrer" className="hover:text-amber-600">FIDE Top100</a></li>
                        <li><a href="https://2700chess.com/live" target="_blank" rel="noreferrer" className="hover:text-amber-600">2700 Live</a></li>
                        <li><a href="https://www.chess.com/ratings" target="_blank" rel="noreferrer" className="hover:text-amber-600">Chess.com Ratings</a></li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-fide-700 dark:text-amber-400 mb-1">Bases &amp; Partidas</p>
                      <ul className="space-y-1">
                        <li><a href="https://www.chessgames.com" target="_blank" rel="noreferrer" className="hover:text-amber-600">Chessgames.com</a></li>
                        <li><a href="https://www.365chess.com" target="_blank" rel="noreferrer" className="hover:text-amber-600">365Chess</a></li>
                        <li><a href="https://www.chess.com" target="_blank" rel="noreferrer" className="hover:text-amber-600">Chess.com</a></li>
                        <li><a href="https://lichess.org" target="_blank" rel="noreferrer" className="hover:text-amber-600">Lichess.org</a></li>
                        <li><a href="https://www.chessbase.com" target="_blank" rel="noreferrer" className="hover:text-amber-600">ChessBase</a></li>
                        <li><a href="https://lichess.org/database" target="_blank" rel="noreferrer" className="hover:text-amber-600">Lichess DB</a></li>
                        <li><a href="https://www.chess.com/analysis" target="_blank" rel="noreferrer" className="hover:text-amber-600">Chess.com Analysis</a></li>
                      </ul>
                      <p className="font-bold text-fide-700 dark:text-amber-400 mt-3 mb-1">Noticias &amp; Streams</p>
                      <ul className="space-y-1">
                        <li><a href="https://www.chess.com/news" target="_blank" rel="noreferrer" className="hover:text-amber-600">Chess.com News</a></li>
                        <li><a href="https://en.chessbase.com" target="_blank" rel="noreferrer" className="hover:text-amber-600">ChessBase News</a></li>
                        <li><a href="https://www.thechessdrum.net" target="_blank" rel="noreferrer" className="hover:text-amber-600">The Chess Drum</a></li>
                        <li><a href="https://twitch.tv/chess" target="_blank" rel="noreferrer" className="hover:text-amber-600">Twitch Chess</a></li>
                        <li><a href="https://www.theweekinchess.com" target="_blank" rel="noreferrer" className="hover:text-amber-600">The Week in Chess</a></li>
                      </ul>
                    </div>
                  </div>
                  <div className="border-t dark:border-fide-700 p-3">
                    <p className="font-bold text-fide-700 dark:text-amber-400 mb-1 text-xs">⭐ Top 25 Influencers 2025 <span className="font-normal opacity-60">— impacto, streaming y comunidad</span></p>
                    <p className="text-[10px] opacity-50 mb-2">Selección por audiencia YouTube/Twitch/TikTok/IG</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] max-h-52 overflow-auto pr-1">
                      <a href="https://www.twitch.tv/gmhikaru" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">1. Hikaru Nakamura (GMHikaru) ⚡</a>
                      <a href="https://www.youtube.com/@GothamChess" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">2. Levy Rozman (GothamChess) ♔</a>
                      <a href="https://www.twitch.tv/annacramling" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">3. Anna Cramling ✨</a>
                      <a href="https://www.youtube.com/@MagnusCarlsen" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">4. Magnus Carlsen 👑</a>
                      <a href="https://www.twitch.tv/botezlive" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">5. BotezLive (Alexandra & Andrea) ♛</a>
                      <a href="https://www.youtube.com/@crestbook" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">6. Sergei Shipov (Crestbook) 🇷🇺</a>
                      <a href="https://www.youtube.com/@agadmator" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">7. Antonio Radić (Agadmator) 🎥</a>
                      <a href="https://www.youtube.com/@Chessbrahs" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">8. Chessbrah (Hansen & Hambleton) 🇨🇦</a>
                      <a href="https://www.youtube.com/@DanielNaroditskyGM" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">9. Daniel Naroditsky 📚</a>
                      <a href="https://www.twitch.tv/nemsko" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">10. Nemo Zhou (Nemsko)</a>
                      <a href="https://www.youtube.com/@RaffaelChess" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">11. Rafael Santos (Raffael Chess) 🇧🇷</a>
                      <a href="https://www.youtube.com/@reyenigma" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">12. Rey Enigma 🎭</a>
                      <a href="https://www.twitch.tv/juliensong" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">13. Julien Song 🇫🇷</a>
                      <a href="https://www.twitch.tv/alessiasanteramo" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">14. Alessia Santeramo</a>
                      <a href="https://www.youtube.com/@EricRosen" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">15. Eric Rosen — “oh no my queen!”</a>
                      <a href="https://www.youtube.com/@RemoteChessAcademy" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">16. Igor Smirnov</a>
                      <a href="https://www.youtube.com/@GMNeiksans" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">17. Arturs Neiksans 🇱🇻</a>
                      <a href="https://www.twitch.tv/dinabelenkaya" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">18. Dina Belenkaya</a>
                      <a href="https://www.twitch.tv/blitzstream" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">19. Blitzstream 🇫🇷</a>
                      <a href="https://www.youtube.com/@SamayRainaOfficial" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">20. Samay Raina 🇮🇳</a>
                      <a href="https://www.youtube.com/@chess" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">21. Chess.com</a>
                      <a href="https://www.youtube.com/@ChessBaseIndia" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">22. ChessBase India 🇮🇳</a>
                      <a href="https://www.youtube.com/@chess24" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">23. Chess24</a>
                      <a href="https://www.youtube.com/@STLChessClub" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">24. St. Louis Chess Club</a>
                      <a href="https://www.tiktok.com/@sarahchess" target="_blank" rel="noreferrer" className="hover:text-amber-600 truncate">25. Sarah El Barbry ✨</a>
                    </div>
                    <p className="text-[10px] opacity-50 mt-2">Enlaces con UTM/afiliado para tráfico → conversión usuarios</p>
                  </div>
                  <div className="p-2 border-t dark:border-fide-700 bg-gray-50 dark:bg-fide-900/50 text-[10px] text-fide-500 text-center">TOP100 completo en <a href="https://chessorganizers.com/enlaces" target="_blank" rel="noreferrer" className="underline hover:text-amber-600">chessorganizers.com/enlaces</a></div>
                </div>
              )}
            </div>
            {/* Newsletter */}
            <Link to="/newsletter" title="Newsletter — suscríbete (10 novedades programa + 10 mundial cada mes)" className="p-2 rounded-lg hover:bg-fide-700 text-fide-300 hover:text-white transition" aria-label="Newsletter">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </Link>
            <div className="w-px h-6 bg-fide-700 mx-1 hidden sm:block" />
            <LangSwitcher />
            <SyncStatus />
            <NotificationDropdown />
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-fide-700 transition-all duration-200" title={dark ? t('nav.lightMode') : t('nav.darkMode')}>
              {dark ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-5 text-fide-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <div className="hidden sm:relative sm:flex items-center" ref={userMenuRef}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 border-l border-fide-700 hover:bg-fide-700/50 pr-2 py-1.5 rounded-lg transition">
                <div className="w-7 h-7 rounded-full bg-fide-600 flex items-center justify-center text-xs font-bold text-amber-400">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-sm text-fide-200 max-w-[120px] truncate">{user?.name}</span>
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
                  <Link to="/pricing" onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">
                    <span className="text-base">💎</span> {t('nav.planMembership')}
                  </Link>
                  <Link to="/app/inbox" onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-fide-200 hover:bg-gray-50 dark:hover:bg-fide-700 transition">
                    <span className="text-base">📬</span> {t('nav.inbox')}
                  </Link>
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
          <div className="sm:hidden border-t border-fide-700/50 px-4 py-3 space-y-1 bg-fide-800/95 backdrop-blur-sm animate-fadeIn">
            {navLinks.map((l) => (
              l.external ? (
                <a key={l.to} href={l.to} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)} title={l.title}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${l.red ? 'bg-red-600 text-white animate-pulse' : 'text-fide-200 hover:text-white hover:bg-fide-700'}`}>
                  {SVG_ICONS[l.icon] || <span className="text-xs">{l.icon}</span>}
                  {l.label}
                </a>
              ) : (
                <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} title={l.title}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-fide-200 hover:text-white hover:bg-fide-700 text-sm transition-all duration-200">
                  {SVG_ICONS[l.icon] || <span className="text-xs">{l.icon}</span>}
                  {l.label}
                </Link>
              )
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

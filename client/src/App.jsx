import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import ChatBot from './components/ChatBot.jsx';

// Wraps React.lazy so a stale deploy (old index-*.js referencing a deleted
// hashed chunk like Register-*.js) triggers a single hard reload to fetch the
// fresh HTML/bundle instead of a blank "Failed to fetch dynamically imported
// module" page. Safe to retry only once (sessionStorage flag) to avoid loops.
function lazyWithReload(importer) {
  return lazy(async () => {
    try {
      const mod = await importer();
      sessionStorage.removeItem('chunk-reload');
      return mod;
    } catch (err) {
      const msg = String(err?.message || err);
      const isChunkError =
        /failed to fetch dynamically imported module|loading chunk \d+ failed|importing a module script failed/i.test(msg);
      if (isChunkError && !sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
      }
      throw err;
    }
  });
}

// Vite fires this when a <link rel="modulepreload"> fails (same stale-chunk cause).
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunk-reload')) {
    sessionStorage.setItem('chunk-reload', '1');
    window.location.reload();
  }
});

const Landing = lazyWithReload(() => import('./pages/Landing.jsx'));
const Login = lazyWithReload(() => import('./pages/Login.jsx'));
const Register = lazyWithReload(() => import('./pages/Register.jsx'));
const Dashboard = lazyWithReload(() => import('./pages/Dashboard.jsx'));
const TournamentNew = lazyWithReload(() => import('./pages/TournamentNew.jsx'));
const TournamentDetail = lazyWithReload(() => import('./pages/TournamentDetail.jsx'));
const PublicTournament = lazyWithReload(() => import('./pages/PublicTournament.jsx'));
const PublicTournamentsList = lazyWithReload(() => import('./pages/PublicTournamentsList.jsx'));
const PublicRegister = lazyWithReload(() => import('./pages/PublicRegister.jsx'));
const PublicTV = lazyWithReload(() => import('./pages/PublicTV.jsx'));
const PublicPlayersSearch = lazyWithReload(() => import('./pages/PublicPlayersSearch.jsx'));
const PublicPlayerProfile = lazyWithReload(() => import('./pages/PublicPlayerProfile.jsx'));
const PublicOrganizersList = lazyWithReload(() => import('./pages/PublicOrganizersList.jsx'));
const PublicOrganizerProfile = lazyWithReload(() => import('./pages/PublicOrganizerProfile.jsx'));
const PricingPage = lazyWithReload(() => import('./pages/PricingPage.jsx'));
const LegalPage = lazyWithReload(() => import('./pages/LegalPage.jsx'));
const PlayerDashboard = lazyWithReload(() => import('./pages/PlayerDashboard.jsx'));
const LeaguesPage = lazyWithReload(() => import('./pages/LeaguesPage.jsx'));
const InboxPage = lazyWithReload(() => import('./pages/InboxPage.jsx'));
const LeagueDetailPage = lazyWithReload(() => import('./pages/LeagueDetailPage.jsx'));
const ArbiterTournamentsList = lazyWithReload(() => import('./pages/ArbiterTournamentsList.jsx'));
const ArbiterPanel = lazyWithReload(() => import('./pages/ArbiterPanel.jsx'));
const TournamentCatalog = lazyWithReload(() => import('./pages/TournamentCatalog.jsx'));
const ScannerPage = lazyWithReload(() => import('./pages/ScannerPage.jsx'));
const EloDashboard = lazyWithReload(() => import('./pages/EloDashboard.jsx'));
const Newsletters = lazyWithReload(() => import('./pages/Newsletters.jsx'));
const EmbedTournament = lazyWithReload(() => import('./pages/EmbedTournament.jsx'));
const DashboardPro = lazyWithReload(() => import('./pages/DashboardPro.jsx'));
const SearchPage = lazyWithReload(() => import('./pages/SearchPage.jsx'));
const DirectoryPage = lazyWithReload(() => import('./pages/DirectoryPage.jsx'));
const NotificationsPage = lazyWithReload(() => import('./pages/NotificationsPage.jsx'));
const EventPage = lazyWithReload(() => import('./pages/EventPage.jsx'));

function Spinner() {
  return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-fide-500 border-t-transparent rounded-full" /></div>;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  const redirectTo = location.pathname && location.pathname.startsWith('/app/new') ? '/register' : '/login';
  return user ? children : <Navigate to={redirectTo} />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/app/dashboard" /> : children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" /> : children;
}

function App() {
  return (
    <HelmetProvider>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/public" element={<PublicTournamentsList />} />
              <Route path="/public/tournament/:id" element={<PublicTournament />} />
              <Route path="/public/tournament/:id/register" element={<PublicRegister />} />
              <Route path="/public/tournament/:id/tv" element={<PublicTV />} />
              <Route path="/public/players" element={<PublicPlayersSearch />} />
              <Route path="/public/players/:id" element={<PublicPlayerProfile />} />
              <Route path="/public/organizers" element={<PublicOrganizersList />} />
              <Route path="/public/organizers/:id" element={<PublicOrganizerProfile />} />
              <Route path="/catalog" element={<TournamentCatalog />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/directory" element={<DirectoryPage />} />
              <Route path="/t/:slug" element={<EventPage mode="public" />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/newsletter" element={<Newsletters />} />
              <Route path="/newsletters" element={<Newsletters />} />
              <Route path="/embed/tournament/:id" element={<EmbedTournament />} />
              <Route path="/legal/:page" element={<LegalPage />} />
              <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
              <Route path="/arbiter" element={<ProtectedRoute><ArbiterTournamentsList /></ProtectedRoute>} />
              <Route path="/arbiter/tournament/:id" element={<ProtectedRoute><ArbiterPanel /></ProtectedRoute>} />
              <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="dashboard-pro" element={<DashboardPro />} />
                <Route path="new" element={<TournamentNew />} />
                <Route path="tournament/:id" element={<TournamentDetail />} />
                <Route path="events/:id" element={<EventPage mode="private" />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="directory" element={<DirectoryPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="player" element={<PlayerDashboard />} />
                <Route path="leagues" element={<LeaguesPage />} />
                <Route path="leagues/:id" element={<LeagueDetailPage />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="catalog" element={<TournamentCatalog />} />
                <Route path="scan" element={<ScannerPage />} />
                <Route path="tournament/:id/scan" element={<ScannerPage />} />
                <Route path="elo" element={<EloDashboard />} />
                <Route path="newsletter" element={<Newsletters />} />
                <Route path="newsletters" element={<Newsletters />} />
              </Route>
            </Routes>
          </Suspense>
          <ChatBot />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;

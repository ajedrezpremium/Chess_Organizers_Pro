import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import ChatBot from './components/ChatBot.jsx';

const Landing = lazy(() => import('./pages/Landing.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const TournamentNew = lazy(() => import('./pages/TournamentNew.jsx'));
const TournamentDetail = lazy(() => import('./pages/TournamentDetail.jsx'));
const PublicTournament = lazy(() => import('./pages/PublicTournament.jsx'));
const PublicTournamentsList = lazy(() => import('./pages/PublicTournamentsList.jsx'));
const PublicRegister = lazy(() => import('./pages/PublicRegister.jsx'));
const PublicTV = lazy(() => import('./pages/PublicTV.jsx'));
const PublicPlayersSearch = lazy(() => import('./pages/PublicPlayersSearch.jsx'));
const PublicPlayerProfile = lazy(() => import('./pages/PublicPlayerProfile.jsx'));
const PublicOrganizersList = lazy(() => import('./pages/PublicOrganizersList.jsx'));
const PublicOrganizerProfile = lazy(() => import('./pages/PublicOrganizerProfile.jsx'));
const PricingPage = lazy(() => import('./pages/PricingPage.jsx'));
const PlayerDashboard = lazy(() => import('./pages/PlayerDashboard.jsx'));
const LeaguesPage = lazy(() => import('./pages/LeaguesPage.jsx'));
const InboxPage = lazy(() => import('./pages/InboxPage.jsx'));
const LeagueDetailPage = lazy(() => import('./pages/LeagueDetailPage.jsx'));
const ArbiterTournamentsList = lazy(() => import('./pages/ArbiterTournamentsList.jsx'));
const ArbiterPanel = lazy(() => import('./pages/ArbiterPanel.jsx'));
const TournamentCatalog = lazy(() => import('./pages/TournamentCatalog.jsx'));
const ScannerPage = lazy(() => import('./pages/ScannerPage.jsx'));

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
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/arbiter" element={<ProtectedRoute><ArbiterTournamentsList /></ProtectedRoute>} />
              <Route path="/arbiter/tournament/:id" element={<ProtectedRoute><ArbiterPanel /></ProtectedRoute>} />
              <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/app" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="new" element={<TournamentNew />} />
                <Route path="tournament/:id" element={<TournamentDetail />} />
                <Route path="player" element={<PlayerDashboard />} />
                <Route path="leagues" element={<LeaguesPage />} />
                <Route path="leagues/:id" element={<LeagueDetailPage />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="catalog" element={<TournamentCatalog />} />
                <Route path="scan" element={<ScannerPage />} />
                <Route path="tournament/:id/scan" element={<ScannerPage />} />
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

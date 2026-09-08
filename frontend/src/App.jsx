import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AIProvider } from './context/AIContext';
import { SessionProvider } from './context/SessionContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AIAssistant from './components/AIAssistant/AIAssistant';
import FloatingMenu from './components/FloatingMenu';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';

// Landing is the very first thing an unauthenticated visitor sees, so it
// stays in the main bundle (no waterfall: import -> render). Every other
// route is lazy — each becomes its own chunk, so a consumer never downloads
// admin code (and vice versa) and heavy per-page deps (recharts, Leaflet,
// the body-map SVG) only load when that page is actually visited.
import Landing from './pages/Landing';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SessionChat = lazy(() => import('./pages/SessionChat'));
const BodyMapPage = lazy(() => import('./pages/BodyMapPage'));
const History = lazy(() => import('./pages/History'));
const SessionDetail = lazy(() => import('./pages/SessionDetail'));
const HealthStats = lazy(() => import('./pages/HealthStats'));
const Dependents = lazy(() => import('./pages/Dependents'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const EmergencyContacts = lazy(() => import('./pages/EmergencyContacts'));
const Medications = lazy(() => import('./pages/Medications'));
const HealthScoreAchievements = lazy(() => import('./pages/HealthScoreAchievements'));
const PhotoLog = lazy(() => import('./pages/PhotoLog'));
const CareFinder = lazy(() => import('./pages/CareFinder'));
const CommunityInsights = lazy(() => import('./pages/CommunityInsights'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerifyOtp = lazy(() => import('./pages/VerifyOtp'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminVerifyOtp = lazy(() => import('./pages/admin/AdminVerifyOtp'));
const AcceptAdminInvite = lazy(() => import('./pages/admin/AcceptAdminInvite'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminSessions = lazy(() => import('./pages/admin/AdminSessions'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));
const AdminFlaggedSessions = lazy(() => import('./pages/admin/AdminFlaggedSessions'));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'));

// Shared fallback for lazy route chunks — matches PrivateRoute's existing
// "Loading..." treatment below so a lazy-chunk fetch looks identical to an
// auth check in progress, not a second, visually distinct spinner.
const RouteFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    Loading...
  </div>
);

// ─── Consumer route guards ──────────────────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      Loading...
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" /> : children;
};

// ─── Admin route guards ─────────────────────────────────────────────────────
// No role check needed here — /admin/auth/me is itself adminOnly-gated
// server-side, so a non-admin token can never produce isAuthenticated:true
// in useAdminAuth() in the first place.
const AdminPrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAdminAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/admin/login" />;
};

const AdminPublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAdminAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/admin" /> : children;
};

// Wraps each route's page so route changes get a consistent, lightweight
// fade/slide instead of an abrupt swap. Kept intentionally subtle so it
// doesn't clash with pages that haven't been migrated to the design system yet.
const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

// ─── Consumer app ───────────────────────────────────────────────────────────
// Owns AuthProvider/AIProvider/SessionProvider, and the chat assistant /
// floating menu — none of that renders under /admin at all.
function ConsumerApp() {
  const location = useLocation();

  return (
    <AuthProvider>
      <AIProvider>
        <SessionProvider>
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
                  <Route path="/login" element={<PublicRoute><PageTransition><Login /></PageTransition></PublicRoute>} />
                  <Route path="/register" element={<PublicRoute><PageTransition><Register /></PageTransition></PublicRoute>} />
                  <Route path="/verify-email" element={<PageTransition><VerifyEmail /></PageTransition>} />
                  <Route path="/verify-otp" element={<PageTransition><VerifyOtp /></PageTransition>} />
                  <Route path="/onboarding" element={<PrivateRoute><PageTransition><Onboarding /></PageTransition></PrivateRoute>} />
                  <Route path="/dashboard" element={<PrivateRoute><PageTransition><Dashboard /></PageTransition></PrivateRoute>} />
                  <Route path="/session" element={<PrivateRoute><PageTransition><SessionChat /></PageTransition></PrivateRoute>} />
                  <Route path="/body-map" element={<PrivateRoute><PageTransition><BodyMapPage /></PageTransition></PrivateRoute>} />
                  <Route path="/history" element={<PrivateRoute><PageTransition><History /></PageTransition></PrivateRoute>} />
                  <Route path="/history/:id" element={<PrivateRoute><PageTransition><SessionDetail /></PageTransition></PrivateRoute>} />
                  <Route path="/health-stats" element={<PrivateRoute><PageTransition><HealthStats /></PageTransition></PrivateRoute>} />
                  <Route path="/dependents" element={<PrivateRoute><PageTransition><Dependents /></PageTransition></PrivateRoute>} />
                  <Route path="/account-settings" element={<PrivateRoute><PageTransition><AccountSettings /></PageTransition></PrivateRoute>} />
                  <Route path="/emergency-contacts" element={<PrivateRoute><PageTransition><EmergencyContacts /></PageTransition></PrivateRoute>} />
                  <Route path="/medications" element={<PrivateRoute><PageTransition><Medications /></PageTransition></PrivateRoute>} />
                  <Route path="/health-score" element={<PrivateRoute><PageTransition><HealthScoreAchievements /></PageTransition></PrivateRoute>} />
                  <Route path="/photo-log" element={<PrivateRoute><PageTransition><PhotoLog /></PageTransition></PrivateRoute>} />
                  <Route path="/care-finder" element={<PrivateRoute><PageTransition><CareFinder /></PageTransition></PrivateRoute>} />
                  <Route path="/community" element={<PrivateRoute><PageTransition><CommunityInsights /></PageTransition></PrivateRoute>} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </AnimatePresence>
            </Suspense>
            <AIAssistant />
            <FloatingMenu />
            <InstallPrompt />
          </ErrorBoundary>
        </SessionProvider>
      </AIProvider>
    </AuthProvider>
  );
}

// ─── Admin app ──────────────────────────────────────────────────────────────
// Own auth provider, own routes, own layout — structurally isolated from the
// consumer tree above. login/verify-otp/accept-invite render standalone;
// everything else renders inside AdminLayout's sidebar via <Outlet/>.
function AdminApp() {
  return (
    <AdminAuthProvider>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="login" element={<AdminPublicRoute><AdminLogin /></AdminPublicRoute>} />
            <Route path="verify-otp" element={<AdminVerifyOtp />} />
            <Route path="accept-invite" element={<AcceptAdminInvite />} />
            <Route element={<AdminPrivateRoute><AdminLayout /></AdminPrivateRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="flagged" element={<AdminFlaggedSessions />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="system-settings" element={<SystemSettings />} />
              <Route path="audit-log" element={<AdminAuditLog />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin" />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AdminAuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/*" element={<ConsumerApp />} />
      </Routes>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AIProvider } from './context/AIContext';
import { SessionProvider } from './context/SessionContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AIAssistant from './components/AIAssistant/AIAssistant';
import FloatingMenu from './components/FloatingMenu';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import SessionChat from './pages/SessionChat';
import BodyMapPage from './pages/BodyMapPage';
import History from './pages/History';
import SessionDetail from './pages/SessionDetail';
import HealthStats from './pages/HealthStats';
import Dependents from './pages/Dependents';
import AccountSettings from './pages/AccountSettings';
import EmergencyContacts from './pages/EmergencyContacts';
import Medications from './pages/Medications';
import HealthScoreAchievements from './pages/HealthScoreAchievements';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';
import VerifyEmail from './pages/VerifyEmail';
import VerifyOtp from './pages/VerifyOtp';
import AdminLayout from './components/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminVerifyOtp from './pages/admin/AdminVerifyOtp';
import AcceptAdminInvite from './pages/admin/AcceptAdminInvite';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSessions from './pages/admin/AdminSessions';
import AdminSettings from './pages/admin/AdminSettings';

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
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AnimatePresence>
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
        <Routes>
          <Route path="login" element={<AdminPublicRoute><AdminLogin /></AdminPublicRoute>} />
          <Route path="verify-otp" element={<AdminVerifyOtp />} />
          <Route path="accept-invite" element={<AcceptAdminInvite />} />
          <Route element={<AdminPrivateRoute><AdminLayout /></AdminPrivateRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="sessions" element={<AdminSessions />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
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

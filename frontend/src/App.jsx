import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AIProvider } from './context/AIContext';
import { SessionProvider } from './context/SessionContext';
import AIAssistant from './components/AIAssistant/AIAssistant';
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
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSessions from './pages/admin/AdminSessions';
import VerifyEmail from './pages/VerifyEmail';
import VerifyOtp from './pages/VerifyOtp';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      Loading...
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" /> : children;
};

function AppContent() {
  return (
    <ErrorBoundary>
      <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/session" element={<PrivateRoute><SessionChat /></PrivateRoute>} />
        <Route path="/body-map" element={<PrivateRoute><BodyMapPage /></PrivateRoute>} />
        <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
        <Route path="/history/:id" element={<PrivateRoute><SessionDetail /></PrivateRoute>} />
        <Route path="/health-stats" element={<PrivateRoute><HealthStats /></PrivateRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/sessions" element={<AdminRoute><AdminSessions /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <AIAssistant />
      <Toaster position="top-right" />
       <InstallPrompt />
      </>
    </ErrorBoundary>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AIProvider>
          <SessionProvider>
            <AppContent />
          </SessionProvider>
        </AIProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/axios';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auto-restore active session on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    const restore = async () => {
      try {
        const res = await api.post('/ai/session/start', { mode: 'quick' });
        if (res.data.resumed) setActiveSession(res.data.session);
      } catch {}
    };
    restore();
  }, [isAuthenticated]);

  const startSession = async (mode = 'quick') => {
    setLoading(true);
    try {
      const res = await api.post('/ai/session/start', { mode });
      setActiveSession(res.data.session);
      return res.data.session;
    } catch (err) {
      console.error('Failed to start session', err);
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => setActiveSession(null);

  return (
    <SessionContext.Provider value={{ activeSession, setActiveSession, startSession, clearSession, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
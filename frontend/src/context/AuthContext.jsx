import { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const {
    user, token, isAuthenticated, deviceToken,
    pendingEmail, setAuth, setDeviceToken,
    setPendingEmail, logout, updateUser,
  } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          updateUser(res.data.user);
        } catch {
          logout();
        }
      }
      setLoading(false);
    };
    verify();
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, isAuthenticated, loading, deviceToken,
      pendingEmail, setAuth, setDeviceToken, setPendingEmail, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
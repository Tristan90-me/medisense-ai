import { createContext, useContext, useEffect, useState } from 'react';
import { useAdminAuthStore } from '../store/adminAuthStore';
import adminApi from '../api/adminApi';

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const {
    user, token, isAuthenticated,
    pendingEmail, setAuth,
    setPendingEmail, logout, updateUser,
  } = useAdminAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const storedToken = localStorage.getItem('admin_token');
      if (storedToken) {
        try {
          const res = await adminApi.get('/admin/auth/me');
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
    <AdminAuthContext.Provider value={{
      user, token, isAuthenticated, loading,
      pendingEmail, setAuth, setPendingEmail, logout,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAdminAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      pendingEmail: null,

      setAuth: (user, token) => {
        localStorage.setItem('admin_token', token);
        set({ user, token, isAuthenticated: true });
      },
      setPendingEmail: (email) => set({ pendingEmail: email }),
      logout: () => {
        localStorage.removeItem('admin_token');
        set({ user: null, token: null, isAuthenticated: false, pendingEmail: null });
      },
      updateUser: (user) => set({ user }),
    }),
    { name: 'medisense-admin-auth' }
  )
);

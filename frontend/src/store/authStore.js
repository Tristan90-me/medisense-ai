import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      deviceToken: null,
      pendingEmail: null,

      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      setDeviceToken: (deviceToken) => set({ deviceToken }),
      setPendingEmail: (email) => set({ pendingEmail: email }),
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false, pendingEmail: null });
      },
      updateUser: (user) => set({ user }),
    }),
    { name: 'medisense-auth' }
  )
);
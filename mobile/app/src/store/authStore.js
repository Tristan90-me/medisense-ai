// Ports frontend/src/store/authStore.js's shape 1:1 (same state fields and
// actions), swapping web-only pieces for their RN equivalents:
//   - localStorage.setItem('token', ...)  ->  the whole store persists via
//     expo-secure-store (see utils/secureStorage.js) instead of a separate
//     manual write, since RN has no localStorage.
//   - the 401 redirect (frontend/src/api/axios.js's `window.location.href`)
//     is handled in api/axios.js here via a navigation ref reset instead.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../utils/secureStorage';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      deviceToken: null,
      pendingEmail: null,

      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      setDeviceToken: (deviceToken) => set({ deviceToken }),
      setPendingEmail: (email) => set({ pendingEmail: email }),
      logout: () => set({
        user: null, token: null, isAuthenticated: false, pendingEmail: null,
      }),
      updateUser: (user) => set({ user }),
    }),
    {
      name: 'medisense-mobile-auth',
      storage: createJSONStorage(() => secureStorage),
      // deviceToken is a long-lived "remember this device" credential —
      // deliberately kept across logout (only cleared if the account itself
      // revokes it server-side), same as the web store's behavior.
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated, deviceToken: state.deviceToken }),
    },
  ),
);

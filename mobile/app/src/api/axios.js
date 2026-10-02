// Ports frontend/src/api/axios.js's shape (shared instance, Bearer-token
// request interceptor, force-logout-on-401 response interceptor), swapped
// for RN equivalents: base URL from app config instead of Vite's
// import.meta.env. The 401 handler just calls logout() rather than an
// imperative navigation reset (unlike the web version's window.location.href)
// — navigation/RootNavigator.jsx conditionally renders the Auth stack vs. the
// Main tabs based on isAuthenticated, React Navigation's documented pattern
// for auth flows, so flipping that flag alone already swaps the screen; an
// imperative reset would risk targeting a screen name that isn't mounted.
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

// Set in app.json's expo.extra.apiUrl. On a physical device "localhost"
// means the phone itself, not your dev machine — this must point at your
// machine's LAN IP (e.g. http://192.168.1.23:5001/api) to test via Expo Go
// on real hardware. The bare default only works in an emulator/simulator or
// `expo start --web`.
const baseURL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5001/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export default api;

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // A 401 here is usually "your session is invalid" (expired/bad token),
    // which should force a re-login. But a handful of endpoints also reuse
    // 401 for "the password you just typed is wrong" during an
    // already-authenticated confirmation flow (change password, delete
    // account, delete health history) — that's a user-input mistake, not an
    // auth failure, and should surface as an inline error, not a silent
    // logout+redirect. Those calls pass `skipAuthRedirect: true` to opt out.
    if (err.response?.status === 401 && !err.config?.skipAuthRedirect) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
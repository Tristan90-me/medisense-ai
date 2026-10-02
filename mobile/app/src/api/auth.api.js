// Same convention as the web app's per-domain api files: named exports, one
// per endpoint, each unwrapping res.data inline.
import api from './axios';

export const register = (data) => api.post('/auth/register', data).then((res) => res.data);
export const login = (data) => api.post('/auth/login', data).then((res) => res.data);
export const verifyOtp = (data) => api.post('/auth/verify-otp', data).then((res) => res.data);
export const resendOtp = (email) => api.post('/auth/resend-otp', { email }).then((res) => res.data);
export const resendVerification = (email) => api.post('/auth/resend-verification', { email }).then((res) => res.data);
export const getMe = () => api.get('/auth/me').then((res) => res.data.user);

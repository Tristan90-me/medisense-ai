import api from './axios';

// Triggers a browser download for a blob fetched through the authenticated
// api instance — a plain <a href> can't carry the Authorization header
// (mirrors AdminReports.jsx's downloadCsv).
async function downloadBlob(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const getAccount = () => api.get('/account').then((res) => res.data.user);

export const updateAccount = (data) => api.put('/account', data).then((res) => res.data.user);

// These three send a password for the backend to verify as part of an
// already-authenticated request — a wrong password comes back as 401, but
// that's a user-input mistake, not an invalid session, so skipAuthRedirect
// keeps the global interceptor from treating it as one (see axios.js).
export const changePassword = (data) => api.post('/account/change-password', data, { skipAuthRedirect: true }).then((res) => res.data);

export const listTrustedDevices = () => api.get('/account/trusted-devices').then((res) => res.data.devices);

export const revokeTrustedDevice = (id) => api.delete(`/account/trusted-devices/${id}`).then((res) => res.data);

export const deleteAccount = (password) => api.delete('/account', { data: { password }, skipAuthRedirect: true }).then((res) => res.data);

export const deleteHealthHistory = (password) => api.delete('/account/health-history', { data: { password }, skipAuthRedirect: true }).then((res) => res.data);

export const downloadMyData = () => downloadBlob('/account/export', `medisense-my-data-${Date.now()}.json`);

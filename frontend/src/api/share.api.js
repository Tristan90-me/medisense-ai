import api from './axios';

export const createShareLink = (sessionId) => api
  .post(`/share/session/${sessionId}`)
  .then((res) => res.data);

export const revokeShareLink = (token) => api
  .delete(`/share/${token}`)
  .then((res) => res.data);

// Public — called from SharedReport.jsx, a route no login is required for.
export const getSharedReport = (token) => api
  .get(`/share/${token}`)
  .then((res) => res.data.report);

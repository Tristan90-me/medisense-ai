import api from './axios';
import adminApi from './adminApi';

// Consumer notification bell — reads via the consumer token.
export const listAnnouncements = () => api
  .get('/announcements')
  .then((res) => res.data.announcements);

// Admin announcements page — reads/writes via the separate admin token.
export const adminListAnnouncements = () => adminApi
  .get('/announcements')
  .then((res) => res.data.announcements);

export const createAnnouncement = ({
  title, body, audience, targetUserId, criticalWindowDays,
}) => adminApi
  .post('/announcements', {
    title, body, audience, targetUserId, criticalWindowDays,
  })
  .then((res) => res.data.announcement);

export const deleteAnnouncement = (id) => adminApi
  .delete(`/announcements/${id}`)
  .then((res) => res.data);

// Preview how many/which users a 'critical' send would reach before committing to it.
export const adminGetCriticalPreview = (days) => adminApi
  .get('/announcements/critical-preview', { params: { days } })
  .then((res) => res.data);

// Reuses the same paginated user search that powers AdminUsers.jsx — no
// dedicated autocomplete endpoint needed for the "pick a user" step.
export const adminSearchUsers = (search) => adminApi
  .get('/admin/users', { params: { search, limit: 8 } })
  .then((res) => res.data.users);

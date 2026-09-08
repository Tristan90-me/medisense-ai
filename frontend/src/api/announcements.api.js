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

export const createAnnouncement = ({ title, body }) => adminApi
  .post('/announcements', { title, body })
  .then((res) => res.data.announcement);

export const deleteAnnouncement = (id) => adminApi
  .delete(`/announcements/${id}`)
  .then((res) => res.data);

import api from './axios';

export const getWeeklySummary = (refresh) => api
  .get('/ai/weekly-summary', { params: refresh ? { refresh: 'true' } : {} })
  .then((res) => res.data);

import api from './axios';

export const getCommunityTrends = (days) => api
  .get('/community/trends', { params: { days } })
  .then((res) => res.data.trends);

import api from './axios';

export const getHealthScore = (dependentId) => api
  .get('/health-score', { params: dependentId ? { dependent: dependentId } : {} })
  .then((res) => res.data.healthScore);

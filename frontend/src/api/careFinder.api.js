import api from './axios';

export const searchNearby = ({ lat, lng, radius, type }) => api
  .get('/care-finder/nearby', { params: { lat, lng, radius, type } })
  .then((res) => res.data.facilities);

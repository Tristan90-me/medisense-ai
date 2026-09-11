import api from './axios';

export const searchNearby = ({ lat, lng, radius, type }) => api
  .get('/care-finder/nearby', { params: { lat, lng, radius, type } })
  .then((res) => res.data.facilities);

export const geocodeSearch = (q) => api
  .get('/care-finder/geocode', { params: { q } })
  .then((res) => res.data.results);

export const reverseGeocode = (lat, lng) => api
  .get('/care-finder/reverse', { params: { lat, lng } })
  .then((res) => res.data.label);

export const getDirections = ({ fromLat, fromLng, toLat, toLng }) => api
  .get('/care-finder/directions', { params: { fromLat, fromLng, toLat, toLng } })
  .then((res) => res.data);

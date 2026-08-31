import api from './axios';

export const listMedications = (dependentId) => api
  .get('/medications', { params: dependentId ? { dependent: dependentId } : {} })
  .then((res) => res.data.medications);

export const createMedication = (data) => api.post('/medications', data).then((res) => res.data.medication);

export const updateMedication = (id, data) => api.put(`/medications/${id}`, data).then((res) => res.data.medication);

export const deleteMedication = (id) => api.delete(`/medications/${id}`).then((res) => res.data);

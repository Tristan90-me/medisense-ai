import api from './axios';

export const listAppointments = (dependentId) => api
  .get('/appointments', { params: dependentId ? { dependent: dependentId } : {} })
  .then((res) => res.data.appointments);

export const createAppointment = (data) => api.post('/appointments', data).then((res) => res.data.appointment);

export const updateAppointment = (id, data) => api.put(`/appointments/${id}`, data).then((res) => res.data.appointment);

export const deleteAppointment = (id) => api.delete(`/appointments/${id}`).then((res) => res.data);

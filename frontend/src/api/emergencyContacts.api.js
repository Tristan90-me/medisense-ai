import api from './axios';

export const listEmergencyContacts = () => api.get('/emergency-contacts').then((res) => res.data.contacts);

export const createEmergencyContact = (data) => api.post('/emergency-contacts', data).then((res) => res.data.contact);

export const updateEmergencyContact = (id, data) => api.put(`/emergency-contacts/${id}`, data).then((res) => res.data.contact);

export const deleteEmergencyContact = (id) => api.delete(`/emergency-contacts/${id}`).then((res) => res.data);

import api from './axios';

export const listDependents = () => api.get('/dependents').then((res) => res.data.dependents);

export const createDependent = (data) => api.post('/dependents', data).then((res) => res.data.dependent);

export const updateDependent = (id, data) => api.put(`/dependents/${id}`, data).then((res) => res.data.dependent);

export const deleteDependent = (id) => api.delete(`/dependents/${id}`).then((res) => res.data);

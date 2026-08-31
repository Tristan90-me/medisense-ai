import api from './axios';

export const getAccount = () => api.get('/account').then((res) => res.data.user);

export const updateAccount = (data) => api.put('/account', data).then((res) => res.data.user);

export const changePassword = (data) => api.post('/account/change-password', data).then((res) => res.data);

export const listTrustedDevices = () => api.get('/account/trusted-devices').then((res) => res.data.devices);

export const revokeTrustedDevice = (id) => api.delete(`/account/trusted-devices/${id}`).then((res) => res.data);

export const deleteAccount = (password) => api.delete('/account', { data: { password } }).then((res) => res.data);

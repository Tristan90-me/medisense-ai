import api from './axios';

export const listPhotos = (dependentId) => api
  .get('/photo-log', { params: dependentId ? { dependent: dependentId } : {} })
  .then((res) => res.data.photoLogs);

export const getPhoto = (id) => api.get(`/photo-log/${id}`).then((res) => res.data.photoLog);

// data is a FormData instance (must include a `photo` file field). Don't set
// a Content-Type header manually — axios/the browser needs to set it itself
// so the multipart boundary is included.
export const uploadPhoto = (formData) => api.post('/photo-log', formData).then((res) => res.data.photoLog);

export const deletePhoto = (id) => api.delete(`/photo-log/${id}`).then((res) => res.data);

// Records that a Quick Check/Full Assessment session was started from this
// photo, so its detail view can show "Linked to a check-in" afterward.
export const linkPhotoSession = (photoId, sessionId) => api
  .patch(`/photo-log/${photoId}/link-session`, { sessionId })
  .then((res) => res.data.photoLog);

// A bare <img src="/api/photo-log/:id/image"> can't carry the Authorization
// header, so this fetches the bytes as a blob through the authenticated axios
// instance and hands back an object URL instead. Callers MUST call
// URL.revokeObjectURL(url) when done with it (e.g. on unmount / before
// re-fetching) to avoid leaking memory.
export const getPhotoImageUrl = (id) => api
  .get(`/photo-log/${id}/image`, { responseType: 'blob' })
  .then((res) => URL.createObjectURL(res.data));

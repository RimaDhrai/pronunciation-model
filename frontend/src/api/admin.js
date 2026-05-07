import adminApi from './adminAxios';

// Admin endpoints — authenticated via X-Admin-Key header
export const getAllUsers    = ()         => adminApi.get('/api/admin/users');
export const getUserById   = (id)       => adminApi.get(`/api/admin/users/${id}`);
export const createUser    = (data)     => adminApi.post('/api/admin/users', data);
export const updateUser    = (id, data) => adminApi.put(`/api/admin/users/${id}`, data);
export const deleteUser    = (id)       => adminApi.delete(`/api/admin/users/${id}`);
export const getAdminStats = ()         => adminApi.get('/api/admin/stats');
export const getJvmMetrics  = ()         => adminApi.get('/api/admin/jvm');
export const getAdminConfig = ()         => adminApi.get('/api/admin/config');

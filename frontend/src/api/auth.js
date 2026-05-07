import api from './axios';

// AuthController routes → /auth/...
export const loginUser    = (email, password) => api.post('/auth/login',    { email, password });
export const forgotPassword = (email)         => api.post('/auth/forgot-password', { email });
export const registerUser = (data)            => api.post('/auth/register', {
  email:    data.email,
  password: data.password,
  fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.fullName || '',
});

// UserController routes → /api/user/...
export const getMe = () => api.get('/api/user/me');
export const updateProgress = (data) => api.put('/api/user/progress', data);
export const getSessions = () => api.get('/api/user/sessions');
export const saveSession = (data) => api.post('/api/user/sessions', data);
export const getCefrHistory = () => api.get('/api/level-test/history');

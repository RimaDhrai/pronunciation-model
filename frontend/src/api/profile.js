import api from './axios';

// UserController routes → /api/user/...
export const getMe           = ()     => api.get('/api/user/me');
export const updateProfile   = (data) => api.put('/api/user/profile', {
  fullName:   data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
  jobTitle:   data.jobTitle  ?? null,
  nativeLang: data.nativeLang ?? null,
});
export const updatePassword  = (data) => api.put('/api/user/password', { oldPassword: data.current, newPassword: data.newPw });

// These endpoints don't exist in the provided Spring Boot backend yet — they gracefully fail:
export const getPhoneticProfile = () => api.get('/api/practice/health');
export const uploadCV            = (formData) => Promise.resolve({ data: null }); // stub
export const getBadges           = () => Promise.resolve({ data: [] }); // stub

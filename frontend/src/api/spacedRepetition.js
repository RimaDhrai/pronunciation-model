import api from './axios';

const masterSid = () => localStorage.getItem('masterSessionId') || null;

export const recordErrors = (words) => {
  const sid = masterSid();
  const params = sid ? { master_session_id: sid } : {};
  return api.post('/api/spaced-repetition/errors', words, { params });
};
export const getDueItems   = ()    => api.get('/api/spaced-repetition/due');
export const getSoundsDue  = ()    => api.get('/api/spaced-repetition/sounds/due');
export const getDueCount   = ()    => api.get('/api/spaced-repetition/count');
export const markReviewed = (id) => {
  const sid = masterSid();
  const params = sid ? { master_session_id: sid } : {};
  return api.post(`/api/spaced-repetition/${id}/reviewed`, null, { params });
};

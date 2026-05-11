import api from './axios';

// GET /api/exercises/progress?lang=fr|en
export const getExerciseProgress = (lang = 'fr') =>
  api.get('/api/exercises/progress', { params: { lang } });

// GET /api/exercises/progress/:level?lang=fr|en
export const getLevelProgress = (level, lang = 'fr') =>
  api.get(`/api/exercises/progress/${level}`, { params: { lang } });

// POST /api/exercises/progress/:level/complete
export const completeLevel = (level, avgScore, totalPhrases = 10, lang = 'fr') =>
  api.post(`/api/exercises/progress/${level}/complete`, null, {
    params: { avgScore, totalPhrases, lang },
  });

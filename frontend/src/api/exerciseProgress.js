import api from './axios';

// GET /api/exercises/progress  → { A1: {...}, A2: {...}, ... }
export const getExerciseProgress = () =>
  api.get('/api/exercises/progress');

// GET /api/exercises/progress/:level
export const getLevelProgress = (level) =>
  api.get(`/api/exercises/progress/${level}`);

// POST /api/exercises/progress/:level/complete
export const completeLevel = (level, avgScore, totalPhrases = 10) =>
  api.post(`/api/exercises/progress/${level}/complete`, null, {
    params: { avgScore, totalPhrases },
  });

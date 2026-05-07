import api from './axios';

export const createBattle = (lang, level) =>
  api.post('/api/battle/create', { lang, level });

export const joinBattle = (code) =>
  api.post(`/api/battle/join/${code.toUpperCase()}`);

export const getBattle = (code) =>
  api.get(`/api/battle/${code.toUpperCase()}`);

export const submitBattleScore = (code, score) =>
  api.post(`/api/battle/${code.toUpperCase()}/submit`, { score });

export const getMyBattles = () => api.get('/api/battle/my');

export const analyzeBattleAudio = (blob, phrase, lang, level) => {
  const fd = new FormData();
  fd.append('file', blob, 'audio.webm');
  fd.append('expectedPhrase', phrase);
  fd.append('lang', lang);
  fd.append('level', level);
  return api.post('/analyze', fd, { headers: { 'Content-Type': undefined } });
};

import api from './axios';
import adminApi from './adminAxios';

// Retourne toujours les données même si Spring répond 503 (services down)
export const getPracticeHealth = () =>
  api.get('/api/practice/health').catch(err =>
    err.response ? err.response : Promise.resolve({ data: null })
  );

// Version admin — utilise X-Admin-Key (pas de token Keycloak depuis /admin)
export const getPracticeHealthAdmin = () =>
  adminApi.get('/api/practice/health').catch(err =>
    err.response ? err.response : Promise.resolve({ data: null })
  );

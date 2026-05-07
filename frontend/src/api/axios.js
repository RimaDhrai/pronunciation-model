import axios from 'axios';
import {
  kcRefresh, storeTokens, clearTokens,
  getStoredToken, getStoredRefresh, getTokenExpiry,
} from './keycloakAuth';

const api = axios.create({ baseURL: '' });

/* ── Intercepteur requête : injecte le Bearer token Keycloak ─────
   Si le token expire dans < 45s, on le rafraîchit automatiquement
   avant d'envoyer la requête.                                      */
api.interceptors.request.use(async (config) => {


  let token      = getStoredToken();
  const refresh  = getStoredRefresh();
  const expiresAt = getTokenExpiry();

  if (token && refresh && Date.now() > expiresAt - 45_000) {
    try {
      const res = await kcRefresh(refresh);
      storeTokens(res.data);
      token = res.data.access_token;
    } catch {
      // Only force-logout if the access token itself has already expired.
      // If token is still valid (< 45s left), proceed — the API will return 401 if needed.
      if (Date.now() >= expiresAt) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(new Error('Session expirée'));
      }
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ── Intercepteur réponse : gère les 401/403 ────────────────────── */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!window.location.pathname.startsWith('/admin') &&
        (err.response?.status === 401 || err.response?.status === 403)) {
      clearTokens();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

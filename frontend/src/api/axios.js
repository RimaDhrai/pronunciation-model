import axios from 'axios';
import {
  kcRefresh, storeTokens, clearTokens,
  getStoredToken, getStoredRefresh, getTokenExpiry,
} from './keycloakAuth';

const api = axios.create({ baseURL: '' });

let refreshPromise = null;

/* ── Intercepteur requête : injecte le Bearer token Keycloak ─────
   Si le token expire dans < 45s, on le rafraîchit automatiquement
   avant d'envoyer la requête.                                      */
api.interceptors.request.use(async (config) => {
  let token      = getStoredToken();
  const refresh  = getStoredRefresh();
  const expiresAt = getTokenExpiry();

  if (token && refresh && Date.now() > expiresAt - 45_000) {
    if (!refreshPromise) {
      refreshPromise = kcRefresh(refresh)
        .then(res => { storeTokens(res.data); return res.data.access_token; })
        .catch(() => {
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(new Error('Session expirée'));
        })
        .finally(() => { refreshPromise = null; });
    }
    try {
      token = await refreshPromise;
    } catch {
      return Promise.reject(new Error('Session expirée'));
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

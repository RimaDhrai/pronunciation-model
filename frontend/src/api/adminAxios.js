/**
 * adminAxios.js
 * Instance Axios dédiée au panneau admin.
 * Envoie le header X-Admin-Key au lieu d'un token Keycloak.
 * Spring Boot valide ce header via AdminKeyAuthFilter.
 *
 * Clé définie dans .env.local : VITE_ADMIN_KEY=...
 */
import axios from 'axios';

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';

const adminApi = axios.create({ baseURL: '' });

adminApi.interceptors.request.use((config) => {
  config.headers['X-Admin-Key'] = ADMIN_KEY;
  return config;
});

export default adminApi;

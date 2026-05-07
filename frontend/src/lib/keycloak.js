import Keycloak from 'keycloak-js';

// Local → direct Keycloak port | Tunnel/external → via Nginx /kc/ proxy
const keycloakUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:8090'
  : `${window.location.origin}/kc`;

const keycloak = new Keycloak({
  url: keycloakUrl,
  realm: 'talan',
  clientId: 'talan-frontend',
});

export default keycloak;

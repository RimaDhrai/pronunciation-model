import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8090',
  realm: 'talan',
  clientId: 'talan-frontend',
});

export default keycloak;

import { createContext, useContext, useEffect, useState } from 'react';
import keycloak from './lib/keycloak';

const KeycloakContext = createContext(null);

export function KeycloakProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    keycloak
      .init({
        onLoad: 'login-required',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      })
      .then((authenticated) => {
        if (authenticated) {
          setReady(true);
          // Refresh token automatically 60s before expiry
          setInterval(() => {
            keycloak.updateToken(60).catch(() => keycloak.logout());
          }, 30_000);
        } else {
          keycloak.login();
        }
      })
      .catch((err) => {
        console.error('[Keycloak] Init failed:', err);
        setError("Impossible de contacter le serveur d'authentification.");
      });
  }, []);

  if (error) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif' }}>
        <div style={{ textAlign:'center', color:'#dc2626' }}>
          <h2>Erreur d'authentification</h2>
          <p>{error}</p>
          <p style={{ color:'#6b7280', fontSize:'14px' }}>Vérifiez que Keycloak est démarré sur le port 8090.</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif' }}>
        <p style={{ color:'#6b7280' }}>Authentification en cours…</p>
      </div>
    );
  }

  return (
    <KeycloakContext.Provider value={keycloak}>
      {children}
    </KeycloakContext.Provider>
  );
}

export function useKeycloak() {
  return useContext(KeycloakContext);
}

export function useHasRole(role) {
  const kc = useKeycloak();
  return kc?.hasRealmRole(role) ?? false;
}

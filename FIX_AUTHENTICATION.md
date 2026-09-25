# 🔧 Correction des Erreurs d'Authentification

## Problème Identifié

Les erreurs 500/502 indiquent que le frontend ne peut pas se connecter au backend ou à Keycloak.

## Solutions

### 1. Vérifier que tous les services sont prêts

```bash
# Attendre 60 secondes pour que Spring Boot démarre complètement
docker logs speakcoach-spring | grep "Started"

# Vérifier Keycloak
curl http://localhost:8090/realms/master

# Vérifier Spring Boot
curl http://localhost:8080/actuator/health
```

### 2. Créer un utilisateur de test dans Keycloak

```bash
# Accéder à Keycloak Admin
# URL: http://localhost:8090/admin
# Username: admin
# Password: Admin1234!

# Créer un realm "talan" (si n'existe pas)
# Créer un utilisateur "test@example.com" avec mot de passe "Test1234!"
```

### 3. Vérifier la Configuration CORS

Le backend doit autoriser les requêtes du frontend sur port 8081.

Vérifier dans `application.properties` :
```properties
spring.security.oauth2.resourceserver.jwt.issuer-uri=http://localhost:8090/realms/talan
```

### 4. Redémarrer les Services

```bash
# Redémarrer tous les services
docker-compose restart

# Attendre 60 secondes
sleep 60

# Vérifier le statut
docker-compose ps
```

### 5. Tester la Connexion

```bash
# Test 1: Vérifier Keycloak
curl -X POST http://localhost:8090/realms/talan/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=talan-frontend&username=test@example.com&password=Test1234!&grant_type=password"

# Test 2: Vérifier le Backend
curl http://localhost:8080/api/health
```

## Erreurs Courantes

### Erreur 500 - Internal Server Error
- **Cause** : Backend n'est pas prêt ou erreur de configuration
- **Solution** : Attendre 60 secondes et redémarrer

### Erreur 502 - Bad Gateway
- **Cause** : Frontend ne peut pas atteindre le backend
- **Solution** : Vérifier que le backend écoute sur le port 8080

### Erreur 401 - Unauthorized
- **Cause** : Token JWT invalide ou expiré
- **Solution** : Se reconnecter

## Accès Direct

Si l'authentification ne fonctionne pas, tu peux accéder directement :

- **Frontend** : http://localhost:8081
- **Backend API** : http://localhost:8080
- **Keycloak Admin** : http://localhost:8090/admin
- **PgAdmin** : http://localhost:5050

## Prochaines Étapes

1. Attendre que tous les services soient prêts (60 secondes)
2. Créer un utilisateur de test dans Keycloak
3. Se connecter avec le frontend
4. Tester le chatbot

**Patience ! Les services prennent du temps à démarrer. ⏳**

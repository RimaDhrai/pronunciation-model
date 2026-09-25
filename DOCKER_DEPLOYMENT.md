# 🐳 Déploiement Docker - SpeakCoach

## ⚠️ Problème Identifié

**Sur Docker, Qwen 2.5 3B (Ollama) ne fonctionne pas.**
**Solution : Utiliser GPT-4.1-mini via Azure OpenAI en production.**

---

## 🚀 Démarrage Rapide

### 1. Configurer Azure OpenAI

```bash
# Éditer le fichier .env
cd backend_spring
cp .env.docker .env

# Remplacer les valeurs
# AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com/
# AZURE_OPENAI_KEY=YOUR_API_KEY
```

### 2. Démarrer Docker

```bash
# Depuis la racine du projet
cd model-train

# Démarrer les services
docker-compose up -d

# Vérifier le statut
docker-compose ps
```

### 3. Vérifier que tout fonctionne

```bash
# PostgreSQL
docker-compose logs postgres | grep "ready to accept"

# Backend
docker-compose logs backend | grep "Started"

# Keycloak
curl http://localhost:8090/realms/talan
```

---

## 🧪 Tester le Chatbot

```bash
# Créer une session
curl -X POST http://localhost:8081/api/chatbot/start \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-001",
    "language": "en",
    "level": "A2",
    "scenario": "restaurant"
  }'

# Envoyer un message
curl -X POST http://localhost:8081/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-001",
    "userText": "I would like a table for two, please",
    "weakWords": [],
    "pronScore": 0.78
  }'
```

---

## 🔍 Dépannage

### Erreur : "pull access denied for speakcoach/backend"

**Cause** : Les images n'existent pas sur Docker Hub

**Solution** : Utiliser `build:` au lieu de `image:` ✅ (déjà corrigé)

### Erreur : "AZURE_OPENAI_ENDPOINT variable is not set"

**Cause** : Variables d'environnement manquantes

**Solution** :
```bash
# Créer un fichier .env
cat > .env << EOF
AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com/
AZURE_OPENAI_KEY=YOUR_API_KEY
EOF

# Redémarrer
docker-compose down
docker-compose up -d
```

### Erreur : "Connection refused" sur port 8081

**Cause** : Backend n'est pas prêt

**Solution** :
```bash
# Attendre 30 secondes
sleep 30

# Vérifier les logs
docker-compose logs backend

# Redémarrer si nécessaire
docker-compose restart backend
```

---

## 📊 Architecture Docker

```
┌─────────────────────────────────────────┐
│         Docker Compose Network          │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │  PostgreSQL  │  │  Keycloak    │   │
│  │   :5432      │  │   :8090      │   │
│  └──────────────┘  └──────────────┘   │
│         ▲                  ▲            │
│         │                  │            │
│  ┌──────────────────────────────────┐  │
│  │   Spring Boot Backend            │  │
│  │   (GPT-4.1-mini via Azure)       │  │
│  │   :8081                          │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📈 Performance

| Métrique | Valeur |
|----------|--------|
| Latence LLM | 350-400ms |
| Latence STT | 800ms |
| Latence TTS | 200ms |
| **Total** | **1400-1500ms** |
| Uptime | 99.9% (Azure) |

---

## 🛑 Arrêter les Services

```bash
# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes
docker-compose down -v
```

---

## ✅ Checklist

- [ ] Azure OpenAI credentials configurés
- [ ] Fichier `.env` créé
- [ ] `docker-compose up -d` exécuté
- [ ] `docker-compose ps` montre 3/3 services UP
- [ ] `curl http://localhost:8081/api/health` répond
- [ ] Chatbot répond correctement

**Déploiement réussi ! 🎉**

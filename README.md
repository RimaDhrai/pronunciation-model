# SpeakCoach — Plateforme IA d'Entraînement à la Prononciation

Plateforme full-stack de coaching à la prononciation en **français et anglais** (niveaux A1→C2 CECRL), propulsée par Whisper STT, des agents LangGraph4J et des LLM Ollama locaux.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Front-end | React 18 + TypeScript + Vite + Tailwind CSS |
| Back-end | Spring Boot 3.3 + Java 21 + LangGraph4J |
| ML / Audio | FastAPI + Python + Faster-Whisper + Phonemizer |
| Base de données | PostgreSQL 16 + Hibernate JPA |
| Sécurité | Keycloak 24 (OAuth2/OIDC) |
| LLM | Ollama (Qwen2.5:3b / Qwen2.5:3b) |
| Déploiement | Docker Compose (6 services) |

## Prérequis

- Docker & Docker Compose
- Ollama installé localement : https://ollama.com
- Modèles Ollama : `ollama pull qwen2.5:3b && ollama pull qwen2.5:7b`

## Démarrage rapide

```bash
# 1. Cloner le dépôt
git clone https://github.com/Talan-PFE2026/pronunciation.git
cd pronunciation/model-train

# 2. Créer le fichier d'environnement backend
cp backend_spring/.env.example backend_spring/.env
# Éditer backend_spring/.env avec vos valeurs

# 3. Lancer tous les services
docker-compose up --build -d

# 4. Accès
#   Front-end  → http://localhost:8081
#   API Spring → http://localhost:8080/swagger-ui.html
#   Keycloak   → http://localhost:8090
#   FastAPI    → http://localhost:8000/docs
#   pgAdmin    → http://localhost:5050
```

## Variables d'environnement

Copier `backend_spring/.env.example` vers `backend_spring/.env` et renseigner :

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | Mot de passe PostgreSQL |
| `JWT_SECRET` | Clé secrète JWT (base64) |
| `KEYCLOAK_ADMIN_PASSWORD` | Mot de passe admin Keycloak |
| `MAIL_USERNAME` | Adresse email SMTP |
| `MAIL_PASSWORD` | App password Gmail |

## Comptes de test (Keycloak)

| Rôle | Login | Mot de passe |
|------|-------|--------------|
| Admin | `admin.talan` | `Admin1234!` |
| Collaborateur | `collaborateur.test` | `Collab1234!` |

## Architecture des services Docker

```
┌──────────────┐   ┌──────────────────┐   ┌────────────────┐
│  React/Nginx │   │   Spring Boot    │   │    FastAPI     │
│  :8081       │──▶│   :8080          │──▶│    :8000       │
└──────────────┘   └──────────────────┘   └────────────────┘
                          │    │
               ┌──────────┘    └──────────┐
               ▼                          ▼
        ┌─────────────┐          ┌──────────────┐
        │ PostgreSQL  │          │  Keycloak    │
        │ :5432       │          │  :8090       │
        └─────────────┘          └──────────────┘
                                       │
                                 ┌─────▼──────┐
                                 │  Ollama    │
                                 │  :11434    │
                                 └────────────┘
```

## Fonctionnalités principales

- **Test CECRL adaptatif** — 20 étapes gamifiées, 3 vies, attribution niveau automatique
- **Exercices de prononciation** — STT Whisper + scoring WER + feedback LLM
- **Battle Mode** — Compétition temps réel entre 2 apprenants (3 rounds)
- **Chatbot IA** — Conversation vocale FR/EN avec mémoire de session
- **Master Agent** — Orchestrateur LangGraph4J (CHATBOT / TEST de niveau / EXERCISE)
- **Répétition espacée** — Algorithme SM-2 intégré
- **Gamification** — XP, badges, streaks, tableau de bord

## Lancer les tests

```bash
# Tests Spring Boot + rapport JaCoCo
cd backend_spring
./mvnw test jacoco:report

# Tests frontend + couverture
cd frontend
npm ci
npm run test:coverage

# Tests FastAPI + couverture
cd fastapi
python -m pytest tests/ --cov=. --cov-report=xml
```

## CI/CD (Jenkins)

Deux pipelines Jenkins sont configurés :

- **`Jenkinsfile`** (racine) — Pipeline principal : Spring Boot + Frontend + FastAPI + SonarQube
- **`fastapi/Jenkinsfile`** — Pipeline dédié FastAPI (branche `fastapi`)

Le Quality Gate SonarQube bloque le build si la couverture est insuffisante.

## Structure du projet

```
model-train/
├── backend_spring/     Spring Boot 3.3 (Java 21)
│   ├── src/main/       15 controllers, 16 entités, 3 agents IA
│   └── src/test/       9 suites de tests (JUnit 5 + Mockito)
├── frontend/           React 18 + TypeScript + Vite
├── fastapi/            Python FastAPI (Whisper STT, Phonemizer, TTS)
├── docker-compose.yml  Orchestration 6 services
├── Jenkinsfile         Pipeline CI/CD principal
└── sonar-project.properties  Analyse SonarQube fullstack
```

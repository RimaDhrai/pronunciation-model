# 📊 Monitoring SpeakCoach — Prometheus + Grafana

Ce document décrit la stack de monitoring mise en place pour l'application SpeakCoach.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MONITORING STACK                                 │
│                                                                      │
│  ┌──────────────┐    scrape     ┌────────────────────────────────┐  │
│  │  Prometheus  │◄──────────────│  Spring Boot :8080             │  │
│  │  :9090       │  /actuator    │  /actuator/prometheus           │  │
│  │              │  /prometheus  └────────────────────────────────┘  │
│  │              │                                                    │
│  │              │◄──────────────┌────────────────────────────────┐  │
│  │              │  /metrics     │  FastAPI :8000                  │  │
│  │              │               │  /metrics (Prometheus format)   │  │
│  │              │               └────────────────────────────────┘  │
│  │              │                                                    │
│  │              │◄──────────────┌────────────────────────────────┐  │
│  │              │               │  PostgreSQL Exporter :9187      │  │
│  │              │               └────────────────────────────────┘  │
│  │              │                                                    │
│  │              │◄──────────────┌────────────────────────────────┐  │
│  │              │               │  Node Exporter :9100            │  │
│  │              │               │  (CPU, RAM, Disque, Réseau)     │  │
│  │              │               └────────────────────────────────┘  │
│  │              │                                                    │
│  │              │◄──────────────┌────────────────────────────────┐  │
│  │              │               │  cAdvisor :9200                 │  │
│  │              │               │  (Containers Docker)            │  │
│  └──────┬───────┘               └────────────────────────────────┘  │
│         │                                                            │
│         │  datasource           ┌────────────────────────────────┐  │
│         └──────────────────────►│  Grafana :3000                 │  │
│                                 │  Dashboards pré-configurés     │  │
│                                 └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 Démarrage

### Lancer toute la stack (app + monitoring)
```bash
docker compose up -d
```

### Lancer uniquement le monitoring
```bash
docker compose up -d prometheus grafana node-exporter cadvisor postgres-exporter
```

## 🌐 Accès aux interfaces

| Service | URL | Identifiants |
|---------|-----|-------------|
| **Grafana** | http://localhost:3000 | admin / Admin1234! |
| **Prometheus** | http://localhost:9090 | - |
| **Spring Boot Actuator** | http://localhost:8080/actuator | - |
| **Spring Boot /metrics Prometheus** | http://localhost:8080/actuator/prometheus | - |
| **FastAPI /metrics** | http://localhost:8000/metrics | - |
| **Node Exporter** | http://localhost:9100/metrics | - |
| **PostgreSQL Exporter** | http://localhost:9187/metrics | - |
| **cAdvisor** | http://localhost:9200 | - |

## 📈 Dashboard Grafana — SpeakCoach Monitoring Complet

Le dashboard pré-configuré **"SpeakCoach — Monitoring Complet"** contient :

### 🌐 Vue d'ensemble
- Statut UP/DOWN de tous les services (Spring Boot, FastAPI, PostgreSQL)
- Requêtes par seconde en temps réel
- Heap JVM utilisée

### ☕ Spring Boot — JVM & HTTP
- Mémoire JVM (Heap / Non-Heap)
- Threads JVM (actifs, daemon, peak)
- Requêtes HTTP par endpoint
- Latence p50 / p95 / p99

### 🐍 FastAPI — Whisper STT & TTS
- Requêtes par endpoint (/analyze, /api/chat/stt, /api/chat/tts)
- Latence Whisper p50 / p95 / p99
- Requêtes en cours (In-Progress)
- Taux d'erreurs 4xx / 5xx

### 🗄️ PostgreSQL
- Connexions actives
- Opérations/s (SELECT, INSERT, UPDATE, DELETE)

### 🖥️ Infrastructure
- CPU hôte (%)
- RAM hôte (utilisée / disponible / totale)
- Espace disque

## 🚨 Alertes configurées

Les alertes dans `monitoring/prometheus/alerts/speakcoach_alerts.yml` couvrent :

| Alerte | Condition | Sévérité |
|--------|-----------|----------|
| SpringBootDown | Service inaccessible > 1min | 🔴 Critical |
| FastAPIDown | Service inaccessible > 1min | 🔴 Critical |
| PostgresDown | DB inaccessible > 1min | 🔴 Critical |
| SpringBootHighMemory | Heap JVM > 85% pendant 5min | ⚠️ Warning |
| SpringBootHighErrorRate | Erreurs 5xx > 10% pendant 5min | ⚠️ Warning |
| SpringBootSlowResponses | Latence p95 > 2s pendant 5min | ⚠️ Warning |
| FastAPIHighLatency | Latence p95 > 10s pendant 5min | ⚠️ Warning |
| PostgresHighConnections | Connexions > 80% max | ⚠️ Warning |
| HighCPUUsage | CPU hôte > 90% pendant 10min | ⚠️ Warning |
| LowDiskSpace | Disque < 15% libre | ⚠️ Warning |
| HighMemoryUsage | RAM hôte > 90% pendant 5min | ⚠️ Warning |

## 🔧 Structure des fichiers

```
monitoring/
├── prometheus/
│   ├── prometheus.yml              # Configuration Prometheus (scrape jobs)
│   └── alerts/
│       └── speakcoach_alerts.yml  # Règles d'alerte
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── prometheus.yml     # Datasource Prometheus (auto-config)
        └── dashboards/
            ├── dashboard.yml      # Provisionning dashboards
            └── speakcoach_dashboard.json  # Dashboard principal
```

## 🔄 Recharger la configuration Prometheus sans redémarrer

```bash
curl -X POST http://localhost:9090/-/reload
```

## 📦 Intégration dans le code

### Spring Boot — `pom.xml`
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

### Spring Boot — `application.properties`
```properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoint.prometheus.enabled=true
management.metrics.export.prometheus.enabled=true
```

### FastAPI — `requirements.txt`
```
prometheus-fastapi-instrumentator>=6.1.0
```

### FastAPI — `main.py`
```python
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

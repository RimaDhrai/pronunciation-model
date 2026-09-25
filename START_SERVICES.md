# 🚀 Quick Start Guide

## Start All Services

### Windows PowerShell

```powershell
cd "d:\projet rima\pronunciation-main\pronunciation\model-train"

# Set environment variables
$env:POSTGRES_PASSWORD='123456789'
$env:KEYCLOAK_ADMIN_PASSWORD='Admin1234!'
$env:KEYCLOAK_ADMIN_PASSWORD_SPRING='Admin1234!'
$env:PGADMIN_DEFAULT_PASSWORD='admin'
$env:AZURE_OPENAI_KEY='VOTRE_CLE_AZURE_ICI'

# Start services
docker-compose up -d

# Wait for services to be healthy (60 seconds)
Start-Sleep -Seconds 60

# Check status
docker-compose ps
```

### Linux/Mac

```bash
cd "d:\projet rima\pronunciation-main\pronunciation\model-train"

# Set environment variables
export POSTGRES_PASSWORD='123456789'
export KEYCLOAK_ADMIN_PASSWORD='Admin1234!'
export KEYCLOAK_ADMIN_PASSWORD_SPRING='Admin1234!'
export PGADMIN_DEFAULT_PASSWORD='admin'
export AZURE_OPENAI_KEY='VOTRE_CLE_AZURE_ICI'

# Start services
docker-compose up -d

# Wait for services to be healthy
sleep 60

# Check status
docker-compose ps
```

## Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:8081 | admin / Admin1234! |
| **Backend API** | http://localhost:8080 | (OAuth2 via Keycloak) |
| **Keycloak Admin** | http://localhost:8090/admin | admin / Admin1234! |
| **PgAdmin** | http://localhost:5050 | rima.dhrai@esprit.tn / admin |
| **SonarQube** | http://localhost:9000 | admin / admin |

## Stop Services

```bash
docker-compose down
```

## View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f speakcoach-spring
docker-compose logs -f speakcoach-keycloak
docker-compose logs -f speakcoach-frontend
```

## Restart Services

```bash
docker-compose restart
```

## Clean Up (Remove all data)

```bash
docker-compose down -v
docker system prune -f
```

## Verify Services are Healthy

```bash
# Check all containers
docker-compose ps

# Test backend health
curl http://localhost:8080/actuator/health

# Test Keycloak
curl http://localhost:8090/realms/master

# Test FastAPI
curl http://localhost:8000/health
```

---

**Note**: All services take 60 seconds to fully start. Wait before accessing them.

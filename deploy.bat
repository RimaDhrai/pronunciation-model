@echo off
chcp 65001 >nul
title SpeakCoach Deploy

cd /d "D:\projet rima\pronunciation-main\pronunciation\model-train"

echo.
echo ╔══════════════════════════════════════╗
echo ║        SPEAKCOACH DEPLOY             ║
echo ╚══════════════════════════════════════╝
echo.

:: ── GIT PUSH ──────────────────────────────────────────────────────────────────
echo [1/3] GIT - Push vers GitHub...
git add -A
git commit -m "deploy: %date% %time%"
git push origin main
if %errorlevel% neq 0 (
    echo [WARN] Git push a échoué ou rien à pusher - on continue quand même
)
echo.

:: ── DOCKER BUILD ──────────────────────────────────────────────────────────────
echo [2/3] DOCKER - Build des images...
docker-compose build spring-boot frontend fastapi
if %errorlevel% neq 0 (
    echo [ERREUR] Docker build a échoué !
    pause
    exit /b 1
)
echo.

:: ── DOCKER UP ─────────────────────────────────────────────────────────────────
echo [3/3] DOCKER - Démarrage des services...
docker-compose up -d --force-recreate spring-boot frontend fastapi
if %errorlevel% neq 0 (
    echo [ERREUR] Docker up a échoué !
    pause
    exit /b 1
)
echo.

:: ── STATUS ────────────────────────────────────────────────────────────────────
echo ✅ Deploy terminé ! Services actifs :
docker-compose ps
echo.
echo   → Frontend  : http://localhost:8081
echo   → Spring    : http://localhost:8080
echo   → FastAPI   : http://localhost:8000
echo   → pgAdmin   : http://localhost:5050
echo.
pause

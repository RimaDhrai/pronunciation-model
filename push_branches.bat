@echo off
setlocal

set REPO=https://github.com/Talan-PFE2026/pronunciation.git
set WORK_DIR=%~dp0
set TEMP_DIR=%TEMP%\pronunciation_push_%RANDOM%

echo ============================================
echo  Push vers GitHub par branche
echo  Repo: %REPO%
echo ============================================
echo.

:: ── 1. PUSH FASTAPI ──────────────────────────────────────────
echo [1/3] Push branche fastapi...
set FASTAPI_DIR=%TEMP_DIR%\fastapi
mkdir "%FASTAPI_DIR%"
xcopy /E /I /Q "%WORK_DIR%mon_projettalan_fastapi\*" "%FASTAPI_DIR%\" /EXCLUDE:%WORK_DIR%xcopy_exclude.txt

cd /d "%FASTAPI_DIR%"
git init
git remote add origin %REPO%
git checkout -b fastapi
git add .
git commit -m "feat: FastAPI pronunciation model service"
git push origin fastapi --force
echo [OK] branche fastapi poussee
echo.

:: ── 2. PUSH BACKEND SPRING ───────────────────────────────────
echo [2/3] Push branche backend-spring...
set SPRING_DIR=%TEMP_DIR%\backend-spring
mkdir "%SPRING_DIR%"
xcopy /E /I /Q "%WORK_DIR%backend_spring\*" "%SPRING_DIR%\"

cd /d "%SPRING_DIR%"
git init
git remote add origin %REPO%
git checkout -b backend-spring
git add .
git commit -m "feat: Spring Boot backend service"
git push origin backend-spring --force
echo [OK] branche backend-spring poussee
echo.

:: ── 3. PUSH FRONTEND ─────────────────────────────────────────
echo [3/3] Push branche frontend-main...
set FRONT_DIR=%TEMP_DIR%\frontend-main
mkdir "%FRONT_DIR%"
xcopy /E /I /Q "%WORK_DIR%frontend\*" "%FRONT_DIR%\" /EXCLUDE:%WORK_DIR%xcopy_exclude.txt

cd /d "%FRONT_DIR%"
git init
git remote add origin %REPO%
git checkout -b frontend-main
git add .
git commit -m "feat: React frontend"
git push origin frontend-main --force
echo [OK] branche frontend-main poussee
echo.

:: ── NETTOYAGE ─────────────────────────────────────────────────
cd /d "%WORK_DIR%"
rmdir /S /Q "%TEMP_DIR%"

echo ============================================
echo  Termine! Verifier sur GitHub:
echo  https://github.com/Talan-PFE2026/pronunciation
echo ============================================
pause

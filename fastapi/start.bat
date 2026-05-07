@echo off
title SpeakCoach API

:: ── Aller dans le dossier du projet ──────────────────────────────
cd /d "%~dp0"

:: ── Activer le venv Python 3.12 (situé au niveau parent) ─────────
call ..\venv\Scripts\activate.bat

:: ── Vérifier la version Python (doit afficher 3.12.x) ───────────
echo.
echo [INFO] Version Python utilisee :
python --version
echo.

:: ── Lancer uvicorn avec le BON python (celui du venv) ───────────
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause

:: ── Comment installer et lancer le projet :
:: ── py -3.12 -m venv ..\venv
:: ── ..\venv\Scripts\activate
:: ── pip install -r requirements.txt
:: ── python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

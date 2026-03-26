@echo off
setlocal

echo ===========================================
echo   Starting Meeting Copilot Services
echo ===========================================

pushd "%~dp0"

echo.
echo [1/2] Starting Backend (FastAPI) Server...
cd /d "%~dp0backend"
start "Meeting Copilot - Backend" cmd /k "..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo [2/2] Starting Frontend (Vite) Server...
cd /d "%~dp0frontend"
start "Meeting Copilot - Frontend" cmd /k "npm run dev -- --host"

echo.
echo ===========================================
echo  All services are opening in new windows!
echo.
echo  Local PC Address (Current PC):
echo  - http://localhost:5173
echo.
echo  Other PC Address (Same Wi-Fi/Network):
echo  - http://192.168.15.55:5173
echo ===========================================
echo.
pause

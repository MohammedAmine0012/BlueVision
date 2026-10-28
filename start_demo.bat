@echo off
start "AquaGuard API" cmd /k "cd backend && uvicorn main:app --port 8000"
start "AquaGuard Web" cmd /k "cd frontend && npm run dev"
timeout /t 4 >nul
start http://localhost:5173

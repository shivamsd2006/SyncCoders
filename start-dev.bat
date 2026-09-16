@echo off
echo ===================================================
echo   SyncCoders - Starting Full Stack Development
echo ===================================================
echo Starting Backend Server on http://localhost:5000 ...
start "SyncCoders Backend (Port 5000)" cmd /k "cd server && npm run dev"

echo Starting Frontend Client on http://localhost:5173 ...
start "SyncCoders Frontend (Port 5173)" cmd /k "cd client && npm run dev"

echo Both servers launched in separate windows!
echo Open http://localhost:5173 in your browser.

@echo off
echo Starting EarnHub Backend and Frontend...
echo.

echo [1/2] Starting Backend on port 5000...
start "EarnHub Backend" cmd /k "cd /d %~dp0\backend && npm run dev"

timeout /t 5 /nobreak > nul

echo [2/2] Starting Frontend on port 3000...
start "EarnHub Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ✓ Backend starting at http://localhost:5000
echo ✓ Frontend starting at http://localhost:3000
echo.
echo Press any key to close this window (servers will keep running)...
pause > nul

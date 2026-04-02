@echo off
echo ============================================
echo Restarting EarnHub Services
echo ============================================
echo.

echo [1/2] Stopping existing Node processes...
tasklist | findstr /i "node.exe" > nul
if %errorlevel% == 0 (
    echo Found running Node processes. Please close them manually or run:
    echo   taskkill /F /IM node.exe
    echo.
    choice /C YN /M "Kill all Node processes now?"
    if errorlevel 2 goto :skip_kill
    if errorlevel 1 taskkill /F /IM node.exe > nul 2>&1
    timeout /t 2 /nobreak > nul
)

:skip_kill
echo.
echo [2/2] Starting services...
echo.

echo Starting Backend...
start "EarnHub Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 5 /nobreak > nul

echo Starting Frontend...
start "EarnHub Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================
echo [✓] Services Restarted!
echo ============================================
echo.
echo - Backend:  http://localhost:5000
echo - Frontend: http://localhost:3000
echo.
echo Login: +254711111111 / Test@1234
echo.
pause

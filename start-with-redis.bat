@echo off
echo ============================================
echo Starting EarnHub Full Stack with Redis
echo ============================================
echo.

echo [1/3] Starting Redis...
docker ps | findstr earnhub-redis >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Redis container...
    docker start earnhub-redis >nul 2>&1
    if %errorlevel% neq 0 (
        echo Creating new Redis container...
        docker run -d --name earnhub-redis -p 6379:6379 redis:7-alpine redis-server --requirepass changeme
    )
    timeout /t 3 /nobreak > nul
)
echo [✓] Redis ready on port 6379

echo.
echo [2/3] Starting Backend on port 5000...
start "EarnHub Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 5 /nobreak > nul

echo.
echo [3/3] Starting Frontend on port 3000...
start "EarnHub Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================
echo [✓] All services starting...
echo ============================================
echo.
echo - Redis:    localhost:6379
echo - Backend:  http://localhost:5000
echo - Frontend: http://localhost:3000
echo.
echo Login with: +254711111111 / Test@1234
echo.
pause

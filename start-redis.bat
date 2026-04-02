@echo off
echo Starting Redis with Docker...
echo.

REM Check if Redis container exists
docker ps -a | findstr earnhub-redis >nul 2>&1
if %errorlevel% == 0 (
    echo Redis container exists, starting it...
    docker start earnhub-redis
) else (
    echo Creating new Redis container...
    docker run -d --name earnhub-redis -p 6379:6379 redis:7-alpine redis-server --requirepass changeme
)

if %errorlevel% == 0 (
    echo.
    echo [✓] Redis is running on port 6379
    echo [✓] Password: changeme
    echo.
    echo Test with: docker exec -it earnhub-redis redis-cli -a changeme ping
) else (
    echo.
    echo [✗] Failed to start Redis
    echo.
    echo Make sure Docker Desktop is running!
)

echo.
pause

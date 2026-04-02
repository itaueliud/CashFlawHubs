@echo off
echo ============================================
echo Redis Installation for Windows
echo ============================================
echo.

echo Checking for Docker...
docker --version >nul 2>&1
if %errorlevel% == 0 (
    echo [✓] Docker is installed
    echo.
    echo Starting Redis with Docker...
    docker run -d --name earnhub-redis -p 6379:6379 redis:7-alpine --requirepass changeme
    if %errorlevel% == 0 (
        echo.
        echo [✓] Redis is now running on port 6379
        echo [✓] Password: changeme
        echo.
        echo Test connection with:
        echo docker exec -it earnhub-redis redis-cli -a changeme
    ) else (
        echo [✗] Failed to start Redis container
        echo Try: docker start earnhub-redis
    )
    goto :end
)

echo [✗] Docker not found
echo.
echo ============================================
echo Installation Options:
echo ============================================
echo.
echo Option 1: Install Docker Desktop (Recommended)
echo   - Download: https://www.docker.com/products/docker-desktop
echo   - Then run this script again
echo.
echo Option 2: Install Memurai (Redis for Windows)
echo   - Download: https://www.memurai.com/get-memurai
echo   - Free developer edition available
echo.
echo Option 3: Use Chocolatey
echo   - Run in Admin PowerShell: choco install redis-64
echo.
echo Option 4: Manual Download
echo   - Download: https://github.com/tporadowski/redis/releases
echo   - Extract and run redis-server.exe
echo.
pause

:end

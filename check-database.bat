@echo off
echo ============================================
echo Checking Database Users
echo ============================================
echo.

cd /d "%~dp0backend"
node check-users.js

echo.
echo ============================================
echo.
echo If no users exist, run: run-seed.bat
echo.
pause

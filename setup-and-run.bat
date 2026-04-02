@echo off
echo ============================================
echo EarnHub Complete Setup
echo ============================================
echo.

echo [Step 1/3] Seeding Database...
echo.
cd /d "%~dp0backend"
node scripts/seed.js
if %errorlevel% neq 0 (
    echo.
    echo [✗] Seed failed! Make sure MongoDB is running.
    pause
    exit /b 1
)

echo.
echo [✓] Database seeded successfully!
echo.
echo Test accounts created:
echo   - Admin: +254700000000 / Admin@1234
echo   - User:  +254711111111 / Test@1234
echo.
echo ============================================
echo.

timeout /t 3 /nobreak > nul

echo [Step 2/3] Starting Backend on port 5000...
start "EarnHub Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 5 /nobreak > nul

echo [Step 3/3] Starting Frontend on port 3000...
start "EarnHub Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================
echo [✓] EarnHub Setup Complete!
echo ============================================
echo.
echo Services Running:
echo   - Backend:  http://localhost:5000
echo   - Frontend: http://localhost:3000
echo.
echo Login Credentials:
echo   Phone:    +254711111111
echo   Password: Test@1234
echo.
echo OTP is BYPASSED in development mode.
echo Use any 6-digit code for registration.
echo.
echo Press any key to close this window...
pause > nul

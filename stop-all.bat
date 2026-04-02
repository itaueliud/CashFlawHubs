@echo off
echo ============================================
echo Stopping All EarnHub Services
echo ============================================
echo.

echo Checking for Node.js processes...
tasklist | findstr /i "node.exe" > nul
if %errorlevel% == 0 (
    echo.
    echo Found running Node processes:
    tasklist | findstr /i "node.exe"
    echo.
    choice /C YN /M "Stop all Node processes?"
    if errorlevel 2 goto :end
    if errorlevel 1 (
        taskkill /F /IM node.exe
        echo.
        echo [✓] All Node processes stopped
    )
) else (
    echo No Node.js processes found running.
)

:end
echo.
pause

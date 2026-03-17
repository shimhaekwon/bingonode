@echo off
echo ========================================
echo Killing process on port 3000...
echo ========================================

REM Find and kill process using port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Found process ID: %%a
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel!==0 (
        echo Failed to kill process %%a
    ) else (
        echo Successfully killed process %%a
    )
)

echo.
echo Port 3000 is now free!
echo ========================================
pause

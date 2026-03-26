@echo off
setlocal

echo ===========================================
echo   Meeting Copilot - Open Firewall Port
echo ===========================================

:: Check for Administrative Privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: Administrative privileges required!
    echo Please right-click this file and select "Run as administrator".
    echo.
    pause
    exit /B
)

echo.
echo Adding Firewall Rule for Port 8000...
netsh advfirewall firewall add rule name="FastAPI 8000" dir=in action=allow protocol=TCP localport=8000

echo.
echo ===========================================
echo Firewall configuration complete! 
echo Other PCs can now connect to this server.
echo ===========================================
echo.
pause

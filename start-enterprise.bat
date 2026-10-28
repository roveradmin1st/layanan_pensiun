@echo off
SET PATH=C:\Program Files\nodejs;%PATH%
echo ============================================================================
echo   LAYANAN PENSIUNAN ENTERPRISE FULL-STACK LAUNCHER (v2.5.0)
echo   Backend API : http://localhost:4000
echo   Frontend Web: http://localhost:5173
echo ============================================================================
start "LP Enterprise Backend API" cmd /k "cd /d "%~dp0backend" && node src/server.js"
start "LP Enterprise Frontend Web" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo Server sedang dijalankan... Silakan buka http://localhost:5173 di browser Anda.

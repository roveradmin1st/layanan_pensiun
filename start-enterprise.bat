@echo off
SET PATH=C:\Program Files\nodejs;C:\tools\ngrok;%PATH%
echo ============================================================================
echo   LAYANAN PENSIUNAN ENTERPRISE FULL-STACK LAUNCHER (v2.5.0)
echo   Backend API  : http://localhost:4000
echo   Frontend Web : http://localhost:5173
echo   Ngrok Tunnel : https://unlaurelled-mildred-overreadily.ngrok-free.dev
echo ============================================================================

REM 1. Jalankan Backend Server (Port 4000)
start "LP Enterprise Backend API" cmd /k "cd /d "%~dp0backend" && node src/server.js"

REM 2. Jalankan Frontend Dev Server (Port 5173)
start "LP Enterprise Frontend Web" cmd /k "cd /d "%~dp0frontend" && npm run dev"

REM 3. Jalankan Ngrok Tunnel Otomatis ke Port 4000
start "LP Ngrok Tunnel" cmd /k "cd /d "C:\tools\ngrok" && ngrok http --url=unlaurelled-mildred-overreadily.ngrok-free.dev 4000"

echo Server dan Ngrok sedang dijalankan...
echo Tautan publik: https://unlaurelled-mildred-overreadily.ngrok-free.dev

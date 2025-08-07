@echo off
REM Influence Hub Stop Script for Windows

echo 🛑 Stopping Influence Hub servers...

REM Kill all node processes (aggressive but effective)
echo 🧹 Stopping all Node.js processes...
taskkill /f /im node.exe 2>nul || echo No Node.js processes found

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Test if servers are stopped
curl --noproxy "*" -s -m 2 "http://127.0.0.1:3002/status" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️ HTTP server still responding - may need manual cleanup
) else (
    echo ✅ HTTP server stopped
)

echo ✅ Influence Hub stopped

pause
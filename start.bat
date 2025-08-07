@echo off
REM Influence Hub Startup Script for Windows

echo 🚀 Starting Influence Hub...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the influence-hub directory
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

REM Check if .env exists
if not exist ".env" (
    echo ⚠️ No .env file found. Copying from .env.example...
    copy ".env.example" ".env"
    echo 📝 Please edit .env with your API keys:
    echo    - YOUTUBE_API_KEY=your_api_key
    echo    - Add other platform credentials as needed
    echo.
    echo 💡 After editing .env, run this script again.
    pause
    exit /b 0
)

REM Build the project
echo 🔨 Building project...
call npm run build

if errorlevel 1 (
    echo ❌ Build failed. Please check for TypeScript errors.
    pause
    exit /b 1
)

REM Kill any existing processes
echo 🧹 Cleaning up existing processes...
taskkill /f /im node.exe 2>nul || echo No existing node processes found

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start the HTTP server
echo 🌐 Starting HTTP server...
start /b "" cmd /c "npm start > server.log 2>&1"

REM Wait for server to start
echo ⏳ Waiting for server to initialize...
timeout /t 5 /nobreak >nul

REM Test if HTTP server is working
curl --noproxy "*" -s -m 3 "http://127.0.0.1:3002/selftest" >nul 2>&1
if errorlevel 1 (
    echo ❌ HTTP server failed to start properly
    echo Check server.log for errors
    pause
    exit /b 1
) else (
    echo ✅ HTTP server is running at http://127.0.0.1:3002
    echo 📊 Dashboard: http://127.0.0.1:3002/selftest
)

REM Start MCP server
echo 🤖 Starting MCP server for AI integration...
start /b "" cmd /c "npm run mcp > mcp.log 2>&1"

echo.
echo 🎉 Influence Hub is running!
echo.
echo 📊 HTTP API Server:
echo    • Dashboard: http://127.0.0.1:3002/selftest
echo    • API: http://127.0.0.1:3002/
echo    • Status: http://127.0.0.1:3002/status
echo.
echo 🤖 MCP Server:
echo    • Running for Claude Code integration
echo    • Ready to receive AI queries
echo.
echo 🔍 View logs:
echo    • HTTP Server: type server.log
echo    • MCP Server: type mcp.log
echo.
echo 🛑 To stop servers: run stop.bat
echo.
echo Press any key to exit (servers will keep running)...
pause >nul
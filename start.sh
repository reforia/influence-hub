#!/bin/bash

# Influence Hub Startup Script
echo "🚀 Starting Influence Hub..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the influence-hub directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env with your API keys:"
    echo "   - YOUTUBE_API_KEY=your_api_key"
    echo "   - Add other platform credentials as needed"
    echo ""
    echo "💡 After editing .env, run this script again."
    exit 0
fi

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check for TypeScript errors."
    exit 1
fi

# Kill any existing server processes
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*dist/index.js" 2>/dev/null || true
pkill -f "influence-hub" 2>/dev/null || true

# Wait a moment for processes to die
sleep 2

# Start the HTTP server
echo "🌐 Starting HTTP server..."
npm start &
HTTP_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to initialize..."
sleep 3

# Test if HTTP server is working
if curl --noproxy "*" -s -m 3 "http://127.0.0.1:3002/selftest" > /dev/null; then
    echo "✅ HTTP server is running at http://127.0.0.1:3002"
    echo "📊 Dashboard: http://127.0.0.1:3002/selftest"
else
    echo "❌ HTTP server failed to start properly"
    kill $HTTP_PID 2>/dev/null
    exit 1
fi

# Start MCP server
echo "🤖 Starting MCP server for AI integration..."
npm run mcp &
MCP_PID=$!

echo ""
echo "🎉 Influence Hub is running!"
echo ""
echo "📊 HTTP API Server:"
echo "   • Dashboard: http://127.0.0.1:3002/selftest"
echo "   • API: http://127.0.0.1:3002/"
echo "   • Status: http://127.0.0.1:3002/status"
echo ""
echo "🤖 MCP Server:"
echo "   • Running for Claude Code integration"
echo "   • Ready to receive AI queries"
echo ""
echo "📝 Process IDs:"
echo "   • HTTP Server PID: $HTTP_PID"
echo "   • MCP Server PID: $MCP_PID"
echo ""
echo "🛑 To stop servers:"
echo "   kill $HTTP_PID $MCP_PID"
echo "   # Or run: ./stop.sh"
echo ""
echo "🔍 View logs:"
echo "   tail -f nohup.out"

# Save PIDs for stop script
echo "$HTTP_PID" > .http_pid
echo "$MCP_PID" > .mcp_pid

# Keep script alive to show status
echo ""
echo "📡 Server Status Monitor (Ctrl+C to exit, servers will keep running):"
while true; do
    sleep 10
    if curl --noproxy "*" -s -m 2 "http://127.0.0.1:3002/status" > /dev/null; then
        echo "$(date): ✅ HTTP server healthy"
    else
        echo "$(date): ❌ HTTP server not responding"
    fi
done
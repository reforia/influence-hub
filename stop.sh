#!/bin/bash

# Influence Hub Stop Script
echo "🛑 Stopping Influence Hub servers..."

# Kill by saved PIDs
if [ -f ".http_pid" ]; then
    HTTP_PID=$(cat .http_pid)
    echo "🌐 Stopping HTTP server (PID: $HTTP_PID)..."
    kill $HTTP_PID 2>/dev/null || echo "HTTP server already stopped"
    rm -f .http_pid
fi

if [ -f ".mcp_pid" ]; then
    MCP_PID=$(cat .mcp_pid)
    echo "🤖 Stopping MCP server (PID: $MCP_PID)..."
    kill $MCP_PID 2>/dev/null || echo "MCP server already stopped"
    rm -f .mcp_pid
fi

# Kill by process name as backup
echo "🧹 Cleaning up any remaining processes..."
pkill -f "node.*dist/index.js" 2>/dev/null || true
pkill -f "node.*mcp/server" 2>/dev/null || true
pkill -f "influence-hub" 2>/dev/null || true

sleep 2

# Verify they're stopped
if curl --noproxy "*" -s -m 2 "http://127.0.0.1:3002/status" > /dev/null 2>&1; then
    echo "⚠️  HTTP server still responding - may need manual cleanup"
else
    echo "✅ HTTP server stopped"
fi

echo "✅ Influence Hub stopped"
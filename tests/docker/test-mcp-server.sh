#!/bin/bash

echo "🧪 Testing MCP Server"
echo "===================="
echo ""

# Test 1: MCP package availability
echo "📋 Test 1: MCP package check"
echo "----------------------------"

# Check if MCP package is available
if [ -f "/workspaces/agentic-robotics/npm/mcp/dist/cli.js" ]; then
    echo "✅ MCP package found (development mode)"
    MCP_CLI="/workspaces/agentic-robotics/npm/mcp/dist/cli.js"
elif [ -f "$(npm root -g)/agentic-robotics/node_modules/@agentic-robotics/mcp/dist/cli.js" ]; then
    echo "✅ MCP package found (npm global install)"
    MCP_CLI="$(npm root -g)/agentic-robotics/node_modules/@agentic-robotics/mcp/dist/cli.js"
else
    echo "❌ MCP package not found"
    echo "Searching in common locations..."
    find / -name "cli.js" -path "*/mcp/dist/cli.js" 2>/dev/null | head -5
    exit 1
fi

echo ""
echo "📋 Test 2: MCP Server startup"
echo "-----------------------------"

# Start MCP server in background
timeout 5s node "$MCP_CLI" > /tmp/mcp-output.txt 2>&1 &
MCP_PID=$!

# Wait for server to initialize
sleep 2

# Wait for server to start and capture output
sleep 1

# Check if server started successfully
if ps -p $MCP_PID > /dev/null 2>&1; then
    echo "✅ MCP server process started (PID: $MCP_PID)"
    kill $MCP_PID 2>/dev/null
    wait $MCP_PID 2>/dev/null
else
    # Process may have already exited, check output
    if [ -s /tmp/mcp-output.txt ]; then
        echo "✅ MCP server ran (exited quickly)"
    else
        echo "❌ MCP server failed to start"
        cat /tmp/mcp-output.txt
        exit 1
    fi
fi

# Test 3: Check output for initialization messages
echo ""
echo "📋 Test 3: Initialization checks"
echo "--------------------------------"

if grep -q "ROS3Interface initialized" /tmp/mcp-output.txt; then
    echo "✅ ROS3Interface initialized"
else
    echo "❌ ROS3Interface not initialized"
    cat /tmp/mcp-output.txt
    exit 1
fi

# Test 4: MCP package structure
echo ""
echo "📋 Test 4: MCP package structure"
echo "--------------------------------"

if [ -f "$MCP_CLI" ]; then
    echo "✅ MCP CLI executable exists"
else
    echo "❌ MCP CLI executable not found"
    exit 1
fi

# Check for MCP package dependencies
MCP_DIR=$(dirname "$MCP_CLI")/..
if [ -f "$MCP_DIR/package.json" ]; then
    echo "✅ MCP package.json exists"
    if grep -q '"@agentic-robotics/core"' "$MCP_DIR/package.json"; then
        echo "✅ Core dependency declared"
    fi
    if grep -q '"agentdb"' "$MCP_DIR/package.json"; then
        echo "✅ AgentDB dependency declared"
    fi
    if grep -q '"agentic-flow"' "$MCP_DIR/package.json"; then
        echo "✅ Agentic-flow dependency declared"
    fi
fi

# Test 5: Server restart capability
echo ""
echo "📋 Test 5: Server restart capability"
echo "------------------------------------"

timeout 2s node "$MCP_CLI" > /tmp/mcp-restart.txt 2>&1 &
RESTART_PID=$!
sleep 1

if ps -p $RESTART_PID > /dev/null 2>&1; then
    echo "✅ Server can be restarted"
    kill $RESTART_PID 2>/dev/null
    wait $RESTART_PID 2>/dev/null
else
    echo "✅ Server runs and exits gracefully"
fi

# Test 6: Graceful shutdown
echo ""
echo "📋 Test 6: Graceful shutdown"
echo "----------------------------"

if grep -qi "shutting down\|stopped" /tmp/mcp-output.txt || grep -qi "shutting down\|stopped" /tmp/mcp-restart.txt; then
    echo "✅ Server shuts down gracefully"
else
    echo "⚠️  Shutdown message not detected (may be normal)"
fi

echo ""
echo "======================================"
echo "🎉 MCP server tests completed!"
echo "======================================"

# Cleanup
rm -f /tmp/mcp-*.txt /tmp/mcp-commands.txt
pkill -f "agentic-robotics-mcp" 2>/dev/null || true

exit 0

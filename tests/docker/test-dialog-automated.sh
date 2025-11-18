#!/bin/bash

echo "🧪 Testing Dialog Command (Limited Automation)"
echo "==============================================="
echo ""
echo "NOTE: Dialog mode is designed for interactive use."
echo "These tests verify basic functionality only."
echo ""

echo "📋 Test 1: Dialog mode starts correctly"
echo "---------------------------------------"

# Test that dialog mode can start and exit
printf "exit\n" | timeout 5s npx agentic-robotics dialog > /tmp/dialog-start.txt 2>&1

if grep -q "Welcome to Agentic Robotics Interactive Dialog" /tmp/dialog-start.txt; then
    echo "✅ Dialog mode starts successfully"
else
    echo "❌ Dialog mode failed to start"
    cat /tmp/dialog-start.txt
    exit 1
fi

echo ""
echo "📋 Test 2: Help command works"
echo "-----------------------------"

printf "help\nexit\n" | timeout 5s npx agentic-robotics dialog > /tmp/dialog-help.txt 2>&1

if grep -q "Available commands:" /tmp/dialog-help.txt; then
    echo "✅ Help command works"
else
    echo "❌ Help command failed"
    exit 1
fi

if grep -q "create <name>" /tmp/dialog-help.txt && grep -q "pub <topic>" /tmp/dialog-help.txt; then
    echo "✅ All commands listed in help"
else
    echo "❌ Help command incomplete"
    exit 1
fi

echo ""
echo "📋 Test 3: Info command works"
echo "-----------------------------"

printf "info\nexit\n" | timeout 5s npx agentic-robotics dialog > /tmp/dialog-info.txt 2>&1

if grep -q "Agentic Robotics Framework" /tmp/dialog-info.txt; then
    echo "✅ Info command works"
else
    echo "❌ Info command failed"
    exit 1
fi

echo ""
echo "📋 Test 4: Node creation works"
echo "------------------------------"

printf "create test-node\nexit\n" | timeout 5s npx agentic-robotics dialog > /tmp/dialog-create.txt 2>&1

if grep -q "Node.*created successfully" /tmp/dialog-create.txt; then
    echo "✅ Node creation works"
else
    echo "❌ Node creation failed"
    exit 1
fi

echo ""
echo "📋 Test 5: Status command works"
echo "-------------------------------"

printf "status\nexit\n" | timeout 5s npx agentic-robotics dialog > /tmp/dialog-status.txt 2>&1

if grep -q "Current Status:" /tmp/dialog-status.txt; then
    echo "✅ Status command works"
else
    echo "❌ Status command failed"
    exit 1
fi

echo ""
echo "📋 Test 6: Agents command works"
echo "-------------------------------"

printf "agents\nexit\n" | timeout 5s npx agentic-robotics dialog > /tmp/dialog-agents.txt 2>&1

if grep -q "Quick Agent Overview" /tmp/dialog-agents.txt || grep -q "AgenticNode" /tmp/dialog-agents.txt; then
    echo "✅ Agents command works"
else
    echo "❌ Agents command failed"
    exit 1
fi

echo ""
echo "📋 Test 7: Graceful exit"
echo "------------------------"

printf "exit\n" | timeout 5s npx agentic-robotics dialog > /tmp/dialog-exit.txt 2>&1

if grep -q "Goodbye" /tmp/dialog-exit.txt; then
    echo "✅ Exit command works"
else
    echo "❌ Exit command failed"
    exit 1
fi

echo ""
echo "==============================================="
echo "🎉 Dialog basic tests completed!"
echo "==============================================="
echo ""
echo "⚠️  NOTE: Full publisher/subscriber testing"
echo "    requires interactive input due to readline"
echo "    interface limitations with piped stdin."
echo ""
echo "✅ Manual testing recommended for:"
echo "   - Publisher creation (pub command)"
echo "   - Message sending (send command)"
echo "   - Statistics display (stats command)"
echo ""

# Cleanup
rm -f /tmp/dialog-*.txt

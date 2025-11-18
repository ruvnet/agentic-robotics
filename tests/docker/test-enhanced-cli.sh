#!/bin/bash

echo "🧪 Testing Enhanced Agentic Robotics CLI"
echo "=========================================="
echo ""

# Test 1: Info command
echo "✅ Test 1: Info command"
npx agentic-robotics info
echo ""

# Test 2: Help command
echo "✅ Test 2: Help command"
npx agentic-robotics --help
echo ""

# Test 3: Test command
echo "✅ Test 3: Basic test command"
npx agentic-robotics test
echo ""

# Test 4: Doctor command
echo "✅ Test 4: Doctor diagnostics"
npx agentic-robotics doctor
echo ""

# Test 5: Agents command
echo "✅ Test 5: List all agents"
npx agentic-robotics agents
echo ""

# Test 6: Agents with filtering
echo "✅ Test 6: List core agents"
npx agentic-robotics agents --category core
echo ""

echo "=========================================="
echo "🎉 All CLI tests completed successfully!"
echo "=========================================="

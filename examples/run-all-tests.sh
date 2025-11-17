#!/bin/bash
# Run all agentic robotics simulation tests

echo "█████████████████████████████████████████████████████████"
echo "  🤖 AGENTIC ROBOTICS - SIMULATION TEST SUITE"
echo "█████████████████████████████████████████████████████████"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Industrial Robotics
echo "Test 1/3: Industrial Assembly Line Robot..."
if timeout 10 npx ts-node examples/test-industrial-robot.ts > /dev/null 2>&1; then
    echo "✅ PASSED"
    ((TESTS_PASSED++))
else
    echo "❌ FAILED"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Autonomous Vehicle
echo "Test 2/3: Autonomous Vehicle (Level 4/5)..."
if timeout 10 npx ts-node examples/test-autonomous-vehicle.ts > /dev/null 2>&1; then
    echo "✅ PASSED"
    ((TESTS_PASSED++))
else
    echo "❌ FAILED"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Autonomous Drone
echo "Test 3/3: Autonomous Drone (Aerial Robotics - 100Hz control)..."
if timeout 15 npx ts-node examples/test-autonomous-drone.ts > /dev/null 2>&1; then
    echo "✅ PASSED"
    ((TESTS_PASSED++))
else
    echo "❌ FAILED"
    ((TESTS_FAILED++))
fi
echo ""

echo "█████████████████████████████████████████████████████████"
echo "  TEST RESULTS"
echo "█████████████████████████████████████████████████████████"
echo ""
echo "Tests Passed: $TESTS_PASSED/3"
echo "Tests Failed: $TESTS_FAILED/3"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✨ All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed"
    exit 1
fi

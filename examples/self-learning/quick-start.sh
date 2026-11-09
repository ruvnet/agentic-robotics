#!/bin/bash
# Quick Start Script for Self-Learning Optimization System

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Self-Learning Optimization System - Quick Start           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
print_info "Checking dependencies..."

if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install npm"
    exit 1
fi

print_success "Node.js $(node --version) found"
print_success "npm $(npm --version) found"

# Check if tsx is available
if ! command -v npx &> /dev/null; then
    print_error "npx not found"
    exit 1
fi

print_success "npx available"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
else
    print_success "Dependencies already installed"
fi

echo ""
print_info "Running validation..."
npx tsx examples/self-learning/metrics-validator.ts || print_warning "Some validation checks failed (non-critical)"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Quick Start Options                                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "1. Run Benchmark Optimizer (Quick - 3 minutes)"
echo "2. Run Self-Improving Navigator (Quick - 2 minutes)"
echo "3. Run Full Master Orchestrator (Complete - 15+ minutes)"
echo "4. Run Custom Configuration"
echo "5. View Previous Results"
echo "6. Exit"
echo ""

read -p "Select option (1-6): " option

case $option in
    1)
        print_info "Starting Benchmark Optimizer (6 agents, 5 iterations)..."
        npx tsx examples/self-learning/benchmark-optimizer.ts 6 5
        print_success "Benchmark optimization complete!"
        echo ""
        print_info "View results in: examples/data/benchmarks/"
        ;;
    2)
        print_info "Starting Self-Improving Navigator (10 tasks)..."
        npx tsx examples/self-learning/self-improving-navigator.ts 10
        print_success "Navigation optimization complete!"
        echo ""
        print_info "View results in: examples/data/navigation/"
        ;;
    3)
        print_info "Starting Master Orchestrator (all components)..."
        print_warning "This will take 15+ minutes. Press Ctrl+C to cancel."
        sleep 3
        npx tsx examples/self-learning/master-orchestrator.ts
        print_success "Full orchestration complete!"
        echo ""
        print_info "View results in: examples/data/orchestration/"
        ;;
    4)
        echo ""
        echo "Custom Configuration:"
        read -p "  Swarm size (default: 8): " swarm_size
        read -p "  Iterations (default: 5): " iterations
        swarm_size=${swarm_size:-8}
        iterations=${iterations:-5}

        print_info "Starting custom benchmark ($swarm_size agents, $iterations iterations)..."
        npx tsx examples/self-learning/benchmark-optimizer.ts $swarm_size $iterations
        print_success "Custom benchmark complete!"
        ;;
    5)
        echo ""
        print_info "Recent Results:"
        echo ""

        if [ -d "examples/data/benchmarks" ] && [ "$(ls -A examples/data/benchmarks/*.md 2>/dev/null)" ]; then
            echo "=== Latest Benchmark ==="
            ls -t examples/data/benchmarks/*.md | head -1 | xargs cat
            echo ""
        fi

        if [ -d "examples/data/validation" ] && [ "$(ls -A examples/data/validation/*.md 2>/dev/null)" ]; then
            echo "=== Latest Validation ==="
            ls -t examples/data/validation/*.md | head -1 | xargs cat
            echo ""
        fi

        if [ -f "examples/data/memory-bank.json" ]; then
            echo "=== Memory Bank Status ==="
            cat examples/data/memory-bank.json | head -20
            echo ""
        fi
        ;;
    6)
        print_info "Exiting..."
        exit 0
        ;;
    *)
        print_error "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Quick Start Complete!                                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
print_info "Next steps:"
echo "  - Review results in examples/data/"
echo "  - Check memory bank: examples/data/memory-bank.json"
echo "  - Run validation: npx tsx examples/self-learning/metrics-validator.ts"
echo "  - Full docs: examples/self-learning/README.md"
echo ""

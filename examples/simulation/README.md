# Robot Simulation Examples

Comprehensive simulation examples demonstrating various robot capabilities with AgentDB-powered learning and memory.

## 📋 Available Simulations

### 1. Warehouse Robot Simulation (`warehouse-robot-sim.ts`)

Demonstrates warehouse navigation and inventory picking tasks.

**Features:**
- 3x3 shelf grid navigation
- Pick-and-place operations
- Load capacity management
- Path optimization
- Collision avoidance

**Run:**
```bash
npx tsx examples/simulation/warehouse-robot-sim.ts [robot-id] [num-tasks]

# Examples:
npx tsx examples/simulation/warehouse-robot-sim.ts warehouse-bot-1 15
npx tsx examples/simulation/warehouse-robot-sim.ts warehouse-bot-2 20
```

**Parameters:**
- `robot-id`: Unique identifier for the robot (default: `warehouse-bot-1`)
- `num-tasks`: Number of pick tasks to execute (default: `15`)

---

### 2. Humanoid Walking Simulation (`humanoid-walking-sim.ts`)

Simulates bipedal locomotion with learning-based gait optimization.

**Features:**
- Multiple gait patterns (cautious, normal, fast, dynamic)
- Balance control and fall recovery
- Terrain adaptation
- Energy efficiency optimization
- Learning from falls

**Run:**
```bash
npx tsx examples/simulation/humanoid-walking-sim.ts [robot-id] [num-sessions]

# Examples:
npx tsx examples/simulation/humanoid-walking-sim.ts humanoid-1 8
npx tsx examples/simulation/humanoid-walking-sim.ts humanoid-2 12
```

**Parameters:**
- `robot-id`: Robot identifier (default: `humanoid-1`)
- `num-sessions`: Number of walking sessions (default: `8`)

---

### 3. Drone Delivery Simulation (`drone-delivery-sim.ts`)

Autonomous aerial delivery with dynamic obstacle avoidance.

**Features:**
- 3D flight navigation
- Battery management
- Dynamic obstacle avoidance
- Multi-waypoint delivery
- Weather adaptation
- Package handling

**Run:**
```bash
npx tsx examples/simulation/drone-delivery-sim.ts [drone-id] [num-deliveries]

# Examples:
npx tsx examples/simulation/drone-delivery-sim.ts drone-1 10
npx tsx examples/simulation/drone-delivery-sim.ts drone-2 15
```

**Parameters:**
- `drone-id`: Drone identifier (default: `delivery-drone-1`)
- `num-deliveries`: Number of delivery tasks (default: `10`)

---

### 4. Assembly Line Simulation (`assembly-line-sim.ts`)

Robotic arm assembly operations with precision control.

**Features:**
- Pick-and-place assembly
- Grip force calibration
- Part damage detection
- Quality control
- Learning from failures
- Retry logic

**Run:**
```bash
npx tsx examples/simulation/assembly-line-sim.ts [robot-id] [num-assemblies]

# Examples:
npx tsx examples/simulation/assembly-line-sim.ts arm-1 5
npx tsx examples/simulation/assembly-line-sim.ts arm-2 10
```

**Parameters:**
- `robot-id`: Robotic arm identifier (default: `assembly-arm-1`)
- `num-assemblies`: Number of products to assemble (default: `5`)

---

### 5. Multi-Robot Swarm Simulation (`multi-robot-swarm-sim.ts`)

Coordinated multi-robot behavior with swarm intelligence.

**Features:**
- Dynamic formation control (circle, line, grid, wedge)
- Distributed task allocation
- Collision avoidance between robots
- Swarm metrics (cohesion, alignment, separation)
- Emergent behavior
- Console-based visualization

**Run:**
```bash
npx tsx examples/simulation/multi-robot-swarm-sim.ts [num-robots] [duration]

# Examples:
npx tsx examples/simulation/multi-robot-swarm-sim.ts 6 60
npx tsx examples/simulation/multi-robot-swarm-sim.ts 10 120
```

**Parameters:**
- `num-robots`: Number of robots in swarm (default: `6`)
- `duration`: Simulation duration in seconds (default: `60`)

---

### 6. Obstacle Course Simulation (`obstacle-course-sim.ts`)

Complex navigation through challenging obstacle courses.

**Features:**
- 4 course sections with varying difficulty
- Static and dynamic obstacles
- Multiple navigation strategies
- Collision detection and recovery
- Near-miss tracking
- Strategy learning and adaptation

**Run:**
```bash
npx tsx examples/simulation/obstacle-course-sim.ts [robot-id] [num-runs]

# Examples:
npx tsx examples/simulation/obstacle-course-sim.ts navigator-1 2
npx tsx examples/simulation/obstacle-course-sim.ts navigator-2 3
```

**Parameters:**
- `robot-id`: Navigator identifier (default: `navigator-1`)
- `num-runs`: Number of complete course runs (default: `2`)

---

### 7. Learning Comparison Simulation (`learning-comparison-sim.ts`)

Compare different reinforcement learning strategies.

**Features:**
- 5 learning algorithms:
  - Random (baseline)
  - Epsilon-greedy
  - UCB (Upper Confidence Bound)
  - Thompson Sampling
  - Experience Replay with AgentDB
- Performance metrics and learning curves
- Exploration vs exploitation analysis
- Comparative visualization

**Run:**
```bash
npx tsx examples/simulation/learning-comparison-sim.ts [robot-id]

# Examples:
npx tsx examples/simulation/learning-comparison-sim.ts learner-1
npx tsx examples/simulation/learning-comparison-sim.ts learner-2
```

**Parameters:**
- `robot-id`: Learner identifier (default: `learner-1`)

---

### 8. Benchmark Suite (`benchmark-sim.ts`)

Comprehensive performance benchmarking across all capabilities.

**Features:**
- 7 benchmark categories:
  - Basic operations
  - AgentDB memory operations
  - Learning performance
  - Skill consolidation
  - Concurrent operations
  - Scalability testing
  - Real-time processing
- Memory profiling
- Throughput analysis
- Latency measurements

**Run:**
```bash
npx tsx examples/simulation/benchmark-sim.ts [benchmark-id]

# Examples:
npx tsx examples/simulation/benchmark-sim.ts bench-001
npx tsx examples/simulation/benchmark-sim.ts performance-test
```

**Parameters:**
- `benchmark-id`: Unique benchmark identifier (default: auto-generated timestamp)

---

## 🎯 Common Features

All simulations include:

- **AgentDB Integration**: Persistent memory and learning
- **Visualization**: Console-based progress indicators
- **Metrics Export**: JSON output with detailed statistics
- **Learning Progress**: Tracks improvement over time
- **Error Handling**: Robust failure recovery
- **Reproducibility**: Deterministic with seed options

## 📊 Output Format

Each simulation exports metrics in JSON format:

```json
{
  "robotId": "robot-name",
  "totalOperations": 100,
  "successRate": 0.85,
  "metrics": [ /* detailed metrics */ ],
  "timestamp": "2025-11-18T12:00:00.000Z"
}
```

## 🧠 AgentDB Integration

All simulations use AgentDB for:

- **Episodic Memory**: Store experiences with context
- **Skill Consolidation**: Merge similar patterns
- **Experience Replay**: Learn from past successes
- **Query System**: Retrieve relevant memories

Data is stored in `examples/data/*.db` files.

## 🔧 Requirements

```bash
# Install dependencies
npm install

# Build the project (if needed)
npm run build

# Run any simulation
npx tsx examples/simulation/<simulation-name>.ts
```

## 📈 Performance Tips

1. **First Run**: Initial runs may be slower as AgentDB builds indices
2. **Learning**: Run multiple times to see learning improvements
3. **Memory**: Clear `.db` files to reset learned behaviors
4. **Scaling**: Adjust parameters based on your system capabilities

## 🎓 Learning Examples

### Example: Training a Warehouse Robot

```bash
# Run 1: Initial learning
npx tsx examples/simulation/warehouse-robot-sim.ts bot-1 10

# Run 2: Improved performance with memory
npx tsx examples/simulation/warehouse-robot-sim.ts bot-1 15

# Run 3: Even better with more experience
npx tsx examples/simulation/warehouse-robot-sim.ts bot-1 20
```

### Example: Comparing Learning Strategies

```bash
# Run learning comparison to see which algorithm performs best
npx tsx examples/simulation/learning-comparison-sim.ts learner-1

# Results will show:
# - Random baseline
# - Epsilon-greedy performance
# - UCB optimization
# - Thompson Sampling
# - Experience Replay with AgentDB
```

### Example: Benchmarking System Performance

```bash
# Run comprehensive benchmark
npx tsx examples/simulation/benchmark-sim.ts performance-test-1

# View detailed metrics for:
# - Operation throughput
# - Memory efficiency
# - Learning convergence
# - Query performance
```

## 🐛 Debugging

Enable verbose logging:

```bash
# Set debug mode
DEBUG=* npx tsx examples/simulation/warehouse-robot-sim.ts

# Or specific components
DEBUG=agentdb:* npx tsx examples/simulation/learning-comparison-sim.ts
```

## 📚 Further Reading

- [AgentDB Documentation](https://github.com/ruvnet/agentdb)
- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow)
- [ROS3 MCP Server](../../npm/mcp/README.md)

## 🤝 Contributing

To add new simulations:

1. Create a new `.ts` file in `examples/simulation/`
2. Follow the existing patterns for AgentDB integration
3. Include console visualization
4. Export metrics in standard format
5. Add documentation to this README

## 📄 License

See the main project LICENSE file.

---

**Happy Simulating! 🤖**

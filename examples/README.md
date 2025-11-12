# ROS3 Robot Examples

This directory contains a comprehensive set of robot implementations demonstrating ROS3 capabilities, ranging from simple to exotic and complex.

## Overview

| Example | Complexity | Concepts Demonstrated | Runtime |
|---------|------------|----------------------|---------|
| `01-hello-robot.ts` | **Simple** | Basic pub/sub, state publishing | 10s |
| `02-autonomous-navigator.ts` | **Intermediate** | Pathfinding, obstacle avoidance, LIDAR | 30s |
| `03-multi-robot-coordinator.ts` | **Advanced** | Task allocation, coordination, leader election | 30s |
| `04-swarm-intelligence.ts` | **Exotic** | Flocking, emergent behavior, stigmergy | 60s |

## Prerequisites

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build:ts

# Ensure ROS3 core is built
cargo build --release
```

## Running Examples

### Example 1: Hello World Robot

**Simple introduction to ROS3 pub/sub messaging**

```bash
# Run with default robot ID
node examples/01-hello-robot.ts

# Run with custom robot ID
node examples/01-hello-robot.ts my-robot
```

**What it demonstrates:**
- Basic ROS3 message publishing
- Periodic state updates
- AgentDB memory integration
- Simple robot movement simulation

**Expected output:**
```
🤖 Hello Robot alpha started!
📢 Publishing: Hello from robot alpha! Count: 1
📢 Publishing: Hello from robot alpha! Count: 2
...
📊 Querying past greetings...
Found 5 past greetings:
  1. Published greeting #5 (confidence: 1)
```

---

### Example 2: Autonomous Navigator

**Intermediate pathfinding with dynamic obstacle avoidance**

```bash
# Run autonomous navigation
node examples/02-autonomous-navigator.ts

# Run with custom robot ID
node examples/02-autonomous-navigator.ts nav-beta
```

**What it demonstrates:**
- A* pathfinding algorithm
- LIDAR-based obstacle detection
- Dynamic path replanning
- Memory-based route optimization
- Multi-waypoint navigation

**Features:**
- Synthetic obstacle generation
- Real-time path planning
- Collision avoidance
- Navigation memory queries

**Expected output:**
```
🤖 Autonomous Navigator nav-alpha started!
📍 Initial position: (0.00, 0.00)
🎯 Navigation goal set: (3.00, 2.00)
💭 Found 0 similar past navigation attempts
🗺️  Planned path with 6 waypoints
✓ Waypoint reached. 5 remaining.
✅ Reached goal!
```

---

### Example 3: Multi-Robot Coordinator

**Advanced cooperative task execution**

```bash
# Run with 3 robots (default)
node examples/03-multi-robot-coordinator.ts

# Run with 5 robots
node examples/03-multi-robot-coordinator.ts 5
```

**What it demonstrates:**
- Distributed task allocation
- Leader election algorithm
- Inter-robot communication
- Cooperative area coverage
- Fault tolerance (robot failures)
- Battery management

**Architecture:**
- **Leader**: Manages task queue, assigns tasks
- **Workers**: Execute assigned tasks
- **Heartbeat system**: Monitors robot health

**Expected output:**
```
🚀 Starting multi-robot coordination system with 3 robots...
🤖 Coordinator Robot robot-0 started!
👑 robot-0: Elected as leader
📋 Leader created 10 tasks

📊 System Status:
  robot-0 👑: idle | Battery: 98% | Tasks: 3/10 completed
  robot-1   : moving | Battery: 95% | Tasks: 3/10 completed
  robot-2   : working | Battery: 92% | Tasks: 3/10 completed

🎉 Coordination mission complete!
📈 Final Results:
   Active Robots: 3
   Tasks Completed: 8/10
   Success Rate: 80.0%
```

---

### Example 4: Swarm Intelligence

**Exotic emergent behavior and collective intelligence**

```bash
# Run swarm simulation (3 scouts, 10 workers, 2 guards)
node examples/04-swarm-intelligence.ts
```

**What it demonstrates:**
- **Flocking behavior**: Separation, alignment, cohesion (Boids algorithm)
- **Stigmergy**: Indirect communication via pheromone trails
- **Emergent foraging**: Collective food gathering
- **Role differentiation**: Scouts, workers, guards
- **Self-organization**: No central control

**Swarm Roles:**
- **Scouts** (3): Explore to find food sources, high mobility
- **Workers** (10): Follow pheromone trails, collect and transport food
- **Guards** (2): Patrol home base perimeter

**Behaviors:**
- Levy flight exploration
- Pheromone trail following
- Collective decision-making
- Dynamic task switching

**Expected output:**
```
🐝 Initializing swarm...
   Scouts: 3, Workers: 10, Guards: 2

🍯 Generated 5 food sources
🚀 Swarm simulation running...

🎯 scout-1: Found food! (quality: 0.87, remaining: 15)
🍯 worker-3: Deposited food (quality: 0.87)

📊 Swarm Stats (t=30s):
   Agents: 15 (3 scouts, 10 workers, 2 guards)
   Average Energy: 67.3%
   Food Collected: 23
   Food Remaining: 52
   Agents Carrying Food: 4

🎉 Swarm simulation complete!
📈 Final Results:
   Total Food Collected: 45
   Collection Efficiency: 3.00 per agent
   Average Energy: 54.2%
```

---

## Performance Characteristics

### Computational Complexity

| Example | Time Complexity | Space Complexity | Update Rate |
|---------|----------------|------------------|-------------|
| Hello Robot | O(1) | O(1) | 0.5 Hz |
| Navigator | O(n log n) pathfinding | O(n) obstacles | 10 Hz |
| Coordinator | O(n²) message passing | O(n×m) tasks×robots | 10 Hz |
| Swarm | O(n²) neighbor checks | O(n) agents | 10 Hz |

### Resource Usage

- **Memory**: ~50-200 MB per robot (depending on AgentDB history)
- **CPU**: ~1-5% per robot (Apple M1/Intel i7)
- **Latency**: 10-50µs message passing (Zenoh)

---

## Advanced Usage

### Modifying Behaviors

Each example exposes parameters you can tune:

**Navigator:**
```typescript
// In 02-autonomous-navigator.ts
const tolerance = 0.2; // Goal reach threshold
const numWaypoints = 5; // Path granularity
const speed = 0.5; // Robot velocity
```

**Coordinator:**
```typescript
// In 03-multi-robot-coordinator.ts
const capabilities = ['survey', 'inspect', 'transport', 'guard'];
const heartbeatInterval = 1000; // ms
const taskTimeout = 5000; // ms
```

**Swarm:**
```typescript
// In 04-swarm-intelligence.ts
private behavior: SwarmBehavior = {
  separation: 1.5,
  alignment: 1.0,
  cohesion: 1.0,
  exploration: 0.3,
};
```

### Querying Robot Memories

All examples store experiences in AgentDB. Query them:

```bash
# Query navigation memories
npx agentdb query --query "navigation to target" \
  --path ./examples/data/navigator-alpha.db \
  --k 10 --format json

# Query swarm foraging success
npx agentdb query --query "food collection" \
  --path ./examples/data/swarm-worker-0.db \
  --min-confidence 0.7
```

---

## Benchmarking

Run benchmarks to measure performance:

```bash
# Build release mode for accurate benchmarks
cargo build --release

# Run Rust benchmarks
cargo bench

# Benchmark example performance
npm run benchmark:examples
```

---

## Troubleshooting

### Common Issues

**1. Module not found errors**
```bash
# Rebuild TypeScript
npm run build:ts
```

**2. Database locked errors**
```bash
# Clear example databases
rm -rf examples/data/*.db
```

**3. Performance issues**
```bash
# Use release build
cargo build --release

# Reduce robot count
node examples/03-multi-robot-coordinator.ts 2
```

---

## Next Steps

After exploring these examples, consider:

1. **Combining Examples**: Use swarm coordination for navigator robots
2. **Custom Behaviors**: Implement your own robot controllers
3. **Real Hardware**: Deploy to Raspberry Pi or Jetson Nano
4. **Visualization**: Add web-based visualization (WebSocket + Canvas)
5. **Machine Learning**: Train RL agents using AgentDB memories

---

## Architecture Notes

All examples follow this pattern:

```
┌─────────────────────────────────────────┐
│          TypeScript Robot Node          │
│  ┌─────────────┐      ┌──────────────┐ │
│  │  Behavior   │◄────►│  ROS3 MCP    │ │
│  │  Controller │      │  Server      │ │
│  └─────────────┘      └──────────────┘ │
│         ▲                     │         │
│         │                     ▼         │
│         │              ┌──────────────┐ │
│         │              │  AgentDB     │ │
│         │              │  Memory      │ │
│         │              └──────────────┘ │
└─────────┼───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│         ROS3 Rust Core (via FFI)        │
│  ┌──────────┐  ┌──────────┐            │
│  │  Zenoh   │  │  Tokio   │            │
│  │  Pub/Sub │  │  Runtime │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

---

## Contributing

To add your own example:

1. Create `examples/0X-your-example.ts`
2. Follow the existing pattern (ROS3McpServer integration)
3. Add documentation to this README
4. Test with `npm run test:examples`
5. Submit a pull request

---

## License

MIT License - See main repository LICENSE file

---

## Resources

- **ROS3 Documentation**: ../README.md
- **AgentDB CLI**: `npx agentdb --help`
- **Zenoh Protocol**: https://zenoh.io
- **Swarm Intelligence**: Reynolds, C. W. (1987). Flocks, herds and schools

**Questions?** Open an issue on GitHub!

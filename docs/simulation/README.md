# Robot Simulation System Documentation

Welcome to the Agentic Robotics simulation system documentation. This comprehensive guide will help you build, deploy, and optimize intelligent robot simulations.

## 📚 Documentation Contents

### Getting Started
- **[This README](#quick-start)** - Overview and quick start guide
- **[Examples Guide](./examples-guide.md)** - Step-by-step walkthroughs

### Core Documentation
- **[Architecture](./architecture.md)** - System design and components
- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Robot Types](./robot-types.md)** - Detailed guide to robot types

### Advanced Topics
- **[Training Guide](./training-guide.md)** - How to train robots with AgentDB
- **[Performance Tuning](./performance-tuning.md)** - Optimization strategies
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## 🎯 What is Agentic Robotics?

Agentic Robotics is a next-generation framework that combines:

- **🦀 High-Performance Rust Core** - Microsecond-scale latency (10-50µs)
- **🧠 AI-Native Integration** - Built-in LLM support with 21 MCP tools
- **📡 Real-Time Pub/Sub** - Zero-copy message passing
- **💾 AgentDB Memory** - 13,168x faster experience storage
- **🤖 Self-Learning** - Automatic skill consolidation from experience

## ⚡ Quick Start

### Installation

```bash
# Install globally
npm install -g agentic-robotics

# Or add to your project
npm install agentic-robotics
```

### Your First Robot (60 seconds)

```javascript
const { AgenticNode } = require('agentic-robotics');

async function main() {
  // Create a robot node
  const robot = new AgenticNode('my-robot');

  // Create sensor publisher
  const sensorPub = await robot.createPublisher('/sensors/temperature');

  // Create command subscriber
  const cmdSub = await robot.createSubscriber('/commands');

  // Listen for commands
  await cmdSub.subscribe((message) => {
    const cmd = JSON.parse(message);
    console.log('Received:', cmd);

    if (cmd.action === 'read_sensor') {
      const reading = {
        value: 20 + Math.random() * 10,
        unit: 'celsius',
        timestamp: Date.now()
      };

      sensorPub.publish(JSON.stringify(reading));
    }
  });

  console.log('Robot ready!');
}

main().catch(console.error);
```

## 🤖 Available Robot Types

### 1. Industrial Robots
High-precision manufacturing with AI vision inspection and predictive maintenance.

```javascript
const { AssemblyLineRobot } = require('agentic-robotics/industrial');
const robot = new AssemblyLineRobot('ROBOT-001', './memory.db');
await robot.initialize();
```

**Features:**
- ±0.1mm pick-and-place accuracy
- AI-powered quality inspection
- Real-time coordination (10Hz)
- Predictive maintenance

### 2. Autonomous Vehicles
Level 4/5 self-driving with sensor fusion and V2V communication.

```javascript
const { AutonomousVehicle } = require('agentic-robotics/vehicles');
const car = new AutonomousVehicle('CAR-001', './memory.db');
await car.initialize();
```

**Features:**
- LIDAR + camera + radar fusion
- 50Hz control loop (20ms response)
- Emergency braking
- Multi-vehicle coordination

### 3. Autonomous Drones
Multi-purpose aerial robots for delivery, inspection, and surveying.

```javascript
const { AutonomousDrone } = require('agentic-robotics/drones');
const drone = new AutonomousDrone('DRONE-001', './memory.db');
await drone.initialize();
```

**Features:**
- 100Hz flight control
- 3D obstacle avoidance
- Mission planning
- Swarm coordination

### 4. Swarm Robots
Emergent collective intelligence with flocking and foraging behaviors.

```javascript
const { SwarmRobot } = require('agentic-robotics/swarm');
const swarm = new SwarmManager();
await swarm.initialize(3, 10, 2); // scouts, workers, guards
```

**Features:**
- Flocking algorithms (Boids)
- Stigmergy (pheromone trails)
- Collective decision-making
- Role specialization

## 🧠 AI Integration

### Control Robots with Claude

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentic-robotics": {
      "command": "npx",
      "args": ["@agentic-robotics/mcp"],
      "env": {
        "AGENTDB_PATH": "./robot-memory.db"
      }
    }
  }
}
```

Then ask Claude:
```
You: Tell my robot to move to position (10, 5) and read the temperature
Claude: [Uses MCP tools to control robot]
```

### Self-Learning with AgentDB

Robots automatically learn from experience:

```javascript
// Store experience
await memory.storeEpisode({
  taskName: 'obstacle_avoidance',
  confidence: 0.95,
  success: true,
  outcome: 'Successfully avoided obstacle',
  strategy: 'dynamic_replanning'
});

// Retrieve similar situations
const memories = await memory.retrieveMemories(
  'obstacle avoidance in narrow corridor',
  5
);

// Apply learned strategy
const bestStrategy = memories[0].strategy;
```

## 📊 Performance Benchmarks

| Metric | Value | Comparison |
|--------|-------|------------|
| Message Latency | 10-50µs | **10x faster** than ROS2 |
| Episode Storage | 0.175ms | **13,168x faster** |
| Memory Query | 0.334ms | **5,988x faster** |
| Control Loop | Up to 10 kHz | **10x faster** |
| Storage Throughput | 5,725 ops/sec | Production-ready |

## 🔧 Common Use Cases

### 1. Manufacturing Automation
- Assembly line coordination
- Quality inspection with AI
- Predictive maintenance
- Multi-robot task allocation

### 2. Autonomous Navigation
- Warehouse logistics
- Delivery robots
- Security patrol
- Indoor mapping

### 3. Aerial Operations
- Package delivery
- Infrastructure inspection
- Agricultural monitoring
- Search and rescue

### 4. Research & Education
- Swarm robotics research
- Multi-agent systems
- Reinforcement learning
- Behavior trees

## 📖 Next Steps

1. **Learn the Architecture** - Read [architecture.md](./architecture.md) to understand system design
2. **Explore Examples** - Follow [examples-guide.md](./examples-guide.md) for hands-on tutorials
3. **Master the API** - Reference [api-reference.md](./api-reference.md) for complete API docs
4. **Train Your Robot** - Use [training-guide.md](./training-guide.md) to implement learning
5. **Optimize Performance** - Apply [performance-tuning.md](./performance-tuning.md) best practices

## 🆘 Getting Help

- **Documentation Issues?** See [troubleshooting.md](./troubleshooting.md)
- **API Questions?** Check [api-reference.md](./api-reference.md)
- **Performance Problems?** Read [performance-tuning.md](./performance-tuning.md)
- **Community Support**: [GitHub Discussions](https://github.com/ruvnet/agentic-robotics/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/ruvnet/agentic-robotics/issues)

## 🌟 Key Features

```
┌─────────────────────────────────────────┐
│         Your Application                │
├─────────────────────────────────────────┤
│  Industrial  │  Vehicles  │   Drones    │
│    Robots    │   (L4/L5)  │  (Aerial)   │
├─────────────────────────────────────────┤
│         21 MCP Tools (AI Integration)   │
├─────────────────────────────────────────┤
│  AgentDB Memory (13,168x faster)        │
│  • Reflexion  • Skills  • Reasoning     │
├─────────────────────────────────────────┤
│  Node.js API (TypeScript)               │
├─────────────────────────────────────────┤
│  Rust Core (High Performance)           │
│  • Pub/Sub  • Real-Time  • Zero-Copy    │
└─────────────────────────────────────────┘
```

## 💡 Philosophy

**Traditional Robotics**: Hard-coded behaviors for every scenario
```javascript
if (obstacle_distance < 1.0) {
  stop();
} else if (battery < 20) {
  go_to_charger();
} else if (task_pending) {
  execute_task();
}
// ... endless if-else chains
```

**Agentic Robotics**: AI-powered adaptive behavior
```javascript
// Robot learns from experience
const memories = await memory.retrieveMemories(currentSituation, 5);
const strategy = selectBestStrategy(memories);
await executeStrategy(strategy);

// Automatically improves over time
await memory.storeEpisode({
  success: result.success,
  strategy: strategy.name,
  confidence: result.confidence
});
```

## 🎓 Learning Path

**Beginner** (1-2 hours)
1. ✅ Read this README
2. ✅ Run "Hello Robot" example
3. ✅ Try pub/sub communication
4. ✅ Explore MCP tools with Claude

**Intermediate** (4-6 hours)
1. ✅ Build an autonomous navigator
2. ✅ Implement obstacle avoidance
3. ✅ Add memory/learning
4. ✅ Create custom behaviors

**Advanced** (1-2 days)
1. ✅ Design multi-robot coordination
2. ✅ Optimize performance
3. ✅ Implement swarm intelligence
4. ✅ Build production system

## 📄 License

MIT OR Apache-2.0 - Free for commercial and open-source use

---

**Ready to build intelligent robots?** Start with the [Examples Guide](./examples-guide.md)!

© 2025 ruvnet. Built with ❤️ for the robotics and AI community.

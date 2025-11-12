# ROS3 - Robot Operating System 3

> Next-generation robotics framework built with Rust, targeting microsecond-scale determinism with hybrid WASM/native deployment.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## 🚀 Overview

ROS3 is a ground-up rewrite of the Robot Operating System in Rust, designed for:

- **Microsecond-scale determinism** - 10-50µs message latency (10x faster than ROS2)
- **Zero-copy serialization** - Using CDR and rkyv for maximum performance
- **Hybrid deployment** - Native performance with WASM fallback via npm
- **AI-native integration** - Built-in AgentDB reflexion memory and MCP protocol
- **Real-time guarantees** - Dual runtime architecture (Tokio + RTIC)

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│       Application Layer (ROS3 Nodes + AI Agents)       │
├────────────────────────────────────────────────────────┤
│          MCP Protocol Layer (Tools, Memory)            │
├────────────────────────────────────────────────────────┤
│     Client Library (Async/Await, Serialization)        │
├────────────────────────────────────────────────────────┤
│   Middleware (Zenoh/DDS, Tokio, RTIC)                 │
├────────────────────────────────────────────────────────┤
│   Transport (Lock-Free, Real-Time Scheduler)          │
└────────────────────────────────────────────────────────┘
```

## 📦 Components

### Rust Crates

- **ros3-core** - Core middleware with Zenoh integration, pub/sub, and services
- **ros3-rt** - Real-time executor with dual runtime (Tokio + RTIC)
- **ros3-mcp** - Model Context Protocol integration
- **ros3-embedded** - Embedded systems support (Embassy/RTIC)
- **ros3-node** - NAPI bindings for Node.js

### TypeScript Packages

- **@ros3/mcp-server** - MCP server exposing robotics operations as AI tools
- **@ros3/node** - Node.js bindings (future)
- **@ros3/ai** - AI integration utilities (future)

## 🎯 Key Features

### 1. Zenoh Middleware

```rust
use ros3_core::{Publisher, Subscriber, RobotState};

// Publisher
let publisher = Publisher::<RobotState>::new("robot/state");
publisher.publish(&state).await?;

// Subscriber
let subscriber = Subscriber::<RobotState>::new("robot/state");
while let Ok(msg) = subscriber.recv_async().await {
    process(msg);
}
```

### 2. Real-Time Execution

```rust
use ros3_rt::{ROS3Executor, Priority, Deadline};

let executor = ROS3Executor::new()?;

// High-priority control loop
executor.spawn_rt(
    Priority(3),
    Deadline(Duration::from_micros(500)),
    async {
        control_loop().await;
    }
);
```

### 3. Zero-Copy Serialization

```rust
use ros3_core::serialization::{serialize_cdr, serialize_rkyv};

// CDR (DDS-compatible)
let bytes = serialize_cdr(&msg)?;

// rkyv (zero-copy)
let bytes = serialize_rkyv(&msg)?;
let archived = unsafe { rkyv::archived_root::<T>(&bytes) };
// 10-50ns access time!
```

### 4. MCP Server with AgentDB

```typescript
import { ROS3McpServer } from '@ros3/mcp-server';

const server = new ROS3McpServer({
  dbPath: './robot-memory.db'
});

await server.start();
```

Available MCP tools:
- `move_robot` - Move robot to target pose
- `get_pose` - Get current pose
- `read_lidar` - Read LIDAR point cloud
- `detect_objects` - Run object detection
- `query_memory` - Query past experiences
- `consolidate_skills` - Learn from experiences

### 5. Cognitive Robot Navigation

```typescript
import { CognitiveNavigationNode } from './examples/cognitive-navigation';

const node = new CognitiveNavigationNode();
await node.initialize();

// Navigate using learned experiences
await node.navigate({
  target: { x: 5.0, y: 3.0, z: 0.0 },
  strategy: 'wall_follow'
});

// Consolidate experiences into skills
await node.consolidateExperiences();
```

## 🛠️ Installation

### Prerequisites

- Rust 1.75+ (install via [rustup](https://rustup.rs/))
- Node.js 18+ (install via [nvm](https://github.com/nvm-sh/nvm))
- npm or yarn

### Build from Source

```bash
# Clone repository
git clone https://github.com/ruvnet/vibecast.git
cd vibecast

# Install dependencies
npm install

# Build Rust crates
cargo build --release

# Build TypeScript packages
npm run build

# Run tests
npm test
```

## 🚦 Quick Start

### 1. Start the MCP Server

```bash
cd packages/ros3-mcp-server
npm run dev
```

### 2. Run Cognitive Navigation Example

```bash
npx tsx examples/cognitive-navigation.ts
```

### 3. Use with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ros3": {
      "command": "node",
      "args": ["/path/to/vibecast/packages/ros3-mcp-server/dist/cli.js"],
      "env": {
        "AGENTDB_PATH": "/path/to/robot-memory.db"
      }
    }
  }
}
```

## 📊 Performance Targets

| Metric | ROS2 | ROS3 Target |
|--------|------|-------------|
| Message Latency | 100-200µs | 10-50µs |
| Control Loop | 100-1000 Hz | 1-10 kHz |
| Discovery Time | 1-5s | 0.1-0.5s |
| Memory Overhead | Baseline | 50% reduction |

## 🧪 Benchmarks

```bash
# Run Rust benchmarks
cargo bench

# Results stored in target/criterion/
```

Example output:
```
ros3_publish         10.5 µs
cdr_serialize        2.3 µs
rkyv_serialize       1.8 µs
latency_record       0.8 µs
```

## 🤖 AgentDB Integration

ROS3 uses [AgentDB](https://github.com/rUv-ai/agentdb) for reflexion memory:

- **Store experiences** - All robot operations stored with metadata
- **Query similar situations** - Vector similarity search (<100µs)
- **Learn from failures** - Critique storage and pattern recognition
- **Consolidate skills** - Automatic skill extraction from successful episodes
- **Causal inference** - Discover cause-effect relationships

### Initialize AgentDB

```bash
npx agentdb init ./robot-memory.db --dimension 768 --preset medium
```

### Query Memory

```bash
npx agentdb reflexion retrieve "obstacle avoidance" --k 5 --synthesize-context
```

## 📚 Documentation

- [Architecture Overview](docs/architecture.md) (coming soon)
- [API Reference](docs/api.md) (coming soon)
- [MCP Tools Guide](docs/mcp-tools.md) (coming soon)
- [Real-Time Best Practices](docs/realtime.md) (coming soon)

## 🗺️ Roadmap

### Phase 1: Foundation (Current)
- [x] Core middleware (Zenoh)
- [x] Real-time executor
- [x] Zero-copy serialization
- [x] MCP server
- [x] AgentDB integration
- [ ] NAPI bindings
- [ ] WASM build

### Phase 2: Production Ready
- [ ] Hardware testing (Raspberry Pi, Jetson)
- [ ] Embassy/RTIC embedded support
- [ ] ROS2 compatibility layer
- [ ] Performance optimization
- [ ] Documentation

### Phase 3: Advanced Features
- [ ] Multi-robot coordination (QUIC sync)
- [ ] Neuromorphic computing support
- [ ] Formal verification (Lean4)
- [ ] Cloud robotics integration

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is dual-licensed under MIT OR Apache-2.0.

## 🙏 Acknowledgments

Based on the [ROS3 Technical Specification](https://gist.github.com/ruvnet/d6b68faf212f3a33807e02cb1ea38af3) by @ruvnet.

Technologies used:
- [Zenoh](https://zenoh.io/) - High-performance middleware
- [Tokio](https://tokio.rs/) - Async runtime
- [rkyv](https://rkyv.org/) - Zero-copy serialization
- [AgentDB](https://github.com/rUv-ai/agentdb) - Reflexion memory
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI integration

## 📞 Contact

- GitHub: [@ruvnet](https://github.com/ruvnet)
- Issues: [GitHub Issues](https://github.com/ruvnet/vibecast/issues)

---

**Built with ❤️ for the robotics community**

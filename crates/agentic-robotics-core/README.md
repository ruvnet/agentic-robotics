# agentic-robotics-core

[![Crates.io](https://img.shields.io/crates/v/agentic-robotics-core.svg)](https://crates.io/crates/agentic-robotics-core)
[![Documentation](https://docs.rs/agentic-robotics-core/badge.svg)](https://docs.rs/agentic-robotics-core)
[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue.svg)](../../LICENSE)

**Core pub/sub messaging and serialization for Agentic Robotics**

Part of the [Agentic Robotics](https://github.com/ruvnet/vibecast) framework - high-performance robotics middleware with ROS2 compatibility.

## Features

- 🚀 **Sub-microsecond pub/sub**: 540ns serialization, 30ns channel messaging
- 📡 **Multiple middleware backends**: Zenoh and DDS/RTPS support
- 🔄 **Zero-copy serialization**: Direct CDR encoding to network buffers
- 🔐 **Type-safe messaging**: Rust's type system ensures correctness
- 🌐 **ROS2 compatible**: CDR serialization, DDS protocol support
- ⚡ **Lock-free channels**: Wait-free fast path for local pub/sub

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
agentic-robotics-core = "0.1.0"
tokio = { version = "1", features = ["full"] }
```

## Quick Start

### Basic Publisher/Subscriber

```rust
use agentic_robotics_core::{Node, Publisher, Subscriber};
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create a node
    let mut node = Node::new("robot_node")?;

    // Create publisher
    let publisher = node.publish::<String>("/status")?;

    // Create subscriber
    let subscriber = node.subscribe::<String>("/status")?;

    // Publish messages
    tokio::spawn(async move {
        loop {
            publisher.publish(&"Robot active".to_string()).await.ok();
            sleep(Duration::from_millis(100)).await;
        }
    });

    // Receive messages
    while let Some(msg) = subscriber.recv().await {
        println!("Received: {}", msg);
    }

    Ok(())
}
```

### Custom Message Types

```rust
use serde::{Serialize, Deserialize};
use agentic_robotics_core::Node;

#[derive(Serialize, Deserialize, Debug)]
struct RobotPose {
    x: f64,
    y: f64,
    theta: f64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut node = Node::new("pose_publisher")?;
    let pub_pose = node.publish::<RobotPose>("/robot/pose")?;

    let pose = RobotPose { x: 1.0, y: 2.0, theta: 0.5 };
    pub_pose.publish(&pose).await?;

    Ok(())
}
```

## Performance

Real measurements from production hardware:

| Operation | Latency | Throughput |
|-----------|---------|------------|
| **Serialization (CDR)** | 540 ns | 1.85 M ops/sec |
| **Channel send+recv** | 30 ns | 33 M msgs/sec |
| **Pub/sub (local)** | < 1 µs | > 1 M msgs/sec |

### Comparison with ROS2

| Metric | agentic-robotics-core | ROS2 (rclcpp) | Improvement |
|--------|----------------------|---------------|-------------|
| Serialization | **540 ns** | 1-5 µs | **2-9x faster** |
| Message overhead | **~4 bytes** | 12-24 bytes | **3-6x smaller** |

## Architecture

```
┌─────────────────────────────────────┐
│     agentic-robotics-core           │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Node (pub/sub management)   │  │
│  └──────────────────────────────┘  │
│              │                      │
│  ┌──────────────────────────────┐  │
│  │  Publisher / Subscriber      │  │
│  │  • Lock-free channels        │  │
│  │  • Type-safe messaging       │  │
│  └──────────────────────────────┘  │
│              │                      │
│  ┌──────────────────────────────┐  │
│  │  Serialization               │  │
│  │  • CDR (DDS-standard)        │  │
│  │  • JSON (human-readable)     │  │
│  │  • rkyv (zero-copy)          │  │
│  └──────────────────────────────┘  │
│              │                      │
│  ┌──────────────────────────────┐  │
│  │  Middleware                  │  │
│  │  • Zenoh (default)           │  │
│  │  • DDS/RTPS (ROS2 compat)    │  │
│  └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

## Serialization Formats

The crate supports multiple serialization formats:

### CDR (Common Data Representation)

DDS-standard binary format, compatible with ROS2:

```rust
use agentic_robotics_core::serialization::{serialize_cdr, deserialize_cdr};

let data = RobotState { /* ... */ };
let bytes = serialize_cdr(&data)?;
let recovered: RobotState = deserialize_cdr(&bytes)?;
```

**Performance**: 540 ns per serialization (56-byte struct)

### JSON

Human-readable format for debugging:

```rust
use agentic_robotics_core::serialization::{serialize_json, deserialize_json};

let data = RobotState { /* ... */ };
let json = serialize_json(&data)?;
println!("State: {}", json); // {"position":[1,2,3],...}
```

**Performance**: ~1.2 µs per serialization (56-byte struct)

## Middleware Backends

### Zenoh (Default)

Modern pub/sub with automatic peer discovery:

```rust
let mut node = Node::new("robot")?;
// Zenoh automatically discovers peers on the network
```

**Features**:
- Zero-configuration discovery
- Lower latency than traditional DDS
- Built-in reliability

### DDS/RTPS (ROS2 Compatible)

Standard DDS protocol for ROS2 interoperability:

```rust
use agentic_robotics_core::{Node, Middleware};

let mut node = Node::with_middleware("robot", Middleware::Dds)?;
// Now compatible with ROS2 nodes
```

**Features**:
- Full ROS2 compatibility
- Standard RTPS wire protocol
- Works with ros2 topic list/echo

## Topics and Message Passing

### Topic Naming

Follow ROS2 conventions:

```rust
node.publish::<String>("/robot/status")?;      // ✅ Good
node.publish::<Image>("/camera/rgb/image")?;   // ✅ Good
node.publish::<String>("status")?;             // ⚠️  No leading slash
```

### Quality of Service (QoS)

Configure reliability and durability:

```rust
use agentic_robotics_core::{Node, QoS, Reliability};

let qos = QoS {
    reliability: Reliability::BestEffort,  // Or Reliability::Reliable
    durability: Durability::Volatile,      // Or Durability::Transient
    history_depth: 10,
};

let pub_sensor = node.publish_with_qos::<SensorData>("/sensor", qos)?;
```

## Error Handling

The crate uses `anyhow::Result` for ergonomic error handling:

```rust
use anyhow::{Context, Result};

fn setup_robot() -> Result<()> {
    let mut node = Node::new("robot")
        .context("Failed to create node")?;

    let pub_cmd = node.publish::<Command>("/cmd")
        .context("Failed to create publisher")?;

    Ok(())
}
```

## Examples

See the [examples directory](../../examples) for complete working examples:

- **hello-robot**: Basic pub/sub
- **autonomous-navigator**: A* pathfinding with obstacle avoidance
- **vision-tracking**: Multi-object tracking with Kalman filters
- **swarm-intelligence**: 15-robot swarm coordination

## ROS2 Compatibility

### Message Type Compatibility

Use standard ROS2 message types:

```rust
// Equivalent to std_msgs/String
pub_status.publish(&"OK".to_string()).await?;

// Equivalent to geometry_msgs/Pose
#[derive(Serialize, Deserialize)]
struct Pose {
    position: Point,
    orientation: Quaternion,
}
```

### Topic Bridging

Bridge with ROS2 nodes:

```bash
# Terminal 1: Run your Agentic Robotics node
cargo run --example autonomous-navigator

# Terminal 2: Echo topics from ROS2
ros2 topic echo /robot/pose

# Terminal 3: Publish from ROS2
ros2 topic pub /cmd_vel geometry_msgs/Twist "..."
```

## Performance Tuning

### Buffer Pooling

Reuse buffers for zero-allocation messaging:

```rust
use agentic_robotics_core::buffer::BufferPool;

let pool = BufferPool::new(128, 4096); // 128 buffers of 4KB each
node.set_buffer_pool(pool);
```

### Batching

Batch multiple messages for higher throughput:

```rust
let mut batch = Vec::new();
for i in 0..100 {
    batch.push(format!("Message {}", i));
}
pub_status.publish_batch(&batch).await?;
```

## Testing

```bash
# Run unit tests
cargo test --package agentic-robotics-core

# Run integration tests
cargo test --package agentic-robotics-core --test integration

# Run with logging
RUST_LOG=debug cargo test --package agentic-robotics-core
```

## Benchmarks

Run performance benchmarks:

```bash
cargo bench --package agentic-robotics-core --bench message_passing
```

Expected results:
```
message_serialization/CDR   time: [539 ns 541 ns 543 ns]
message_passing/send_recv   time: [29 ns 30 ns 31 ns]
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](../../LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT License ([LICENSE-MIT](../../LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

## Links

- **Homepage**: [ruv.io](https://ruv.io)
- **Documentation**: [docs.rs/agentic-robotics-core](https://docs.rs/agentic-robotics-core)
- **Repository**: [github.com/ruvnet/vibecast](https://github.com/ruvnet/vibecast)
- **Performance Report**: [PERFORMANCE_REPORT.md](../../PERFORMANCE_REPORT.md)

---

**Part of the Agentic Robotics framework** • Built with ❤️ by the Agentic Robotics Team

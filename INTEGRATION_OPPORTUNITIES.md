# Agentic Robotics: Integration Opportunities Analysis

**Date:** 2025-11-15
**Status:** Complete ecosystem analysis
**Version:** 0.1.2

---

## Executive Summary

This document analyzes integration opportunities across the Agentic Robotics crate ecosystem and provides concrete recommendations for improving cross-crate functionality. The analysis identifies **15 high-value integration opportunities** across 6 crates.

**Key Findings:**
- ✅ **Core-MCP integration**: Successfully implemented (v0.1.2)
- ⚠️ **Core-RT integration**: Limited integration, significant opportunities
- ⚠️ **Core-Node integration**: Minimal real functionality, needs major work
- ⚠️ **Core-Embedded integration**: Stub implementation only
- 🚀 **Cross-cutting opportunities**: 8 high-impact improvements identified

---

## Current Ecosystem Overview

### Crate Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                  agentic-robotics-core                      │
│         (Publishers, Subscribers, Middleware)               │
└────────┬──────────────┬──────────────┬───────────┬─────────┘
         │              │              │           │
    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐ ┌───▼──────┐
    │   mcp   │   │   rt    │   │  node   │ │ embedded │
    │ (0.1.2) │   │ (0.1.1) │   │ (0.1.1) │ │ (0.1.1)  │
    └─────────┘   └─────────┘   └─────────┘ └──────────┘
         ✅           ⚠️            ⚠️           ⚠️
    Full impl    Limited        Stub         Stub
                  integration   only         only
```

### Integration Maturity Matrix

| Crate Pair | Current Status | Integration Level | Opportunity Score |
|------------|----------------|-------------------|-------------------|
| **Core ↔ MCP** | ✅ Implemented | High | ⭐⭐⭐⭐⭐ (Complete) |
| **Core ↔ RT** | ⚠️ Separate | Low | ⭐⭐⭐⭐⭐ (Critical) |
| **Core ↔ Node** | ⚠️ Stub | Minimal | ⭐⭐⭐⭐⭐ (Critical) |
| **Core ↔ Embedded** | ⚠️ Stub | Minimal | ⭐⭐⭐⭐ (High) |
| **RT ↔ MCP** | ❌ None | None | ⭐⭐⭐⭐⭐ (Critical) |
| **RT ↔ Node** | ❌ None | None | ⭐⭐⭐⭐ (High) |
| **MCP ↔ Node** | ❌ None | None | ⭐⭐⭐⭐⭐ (Critical) |
| **Embedded ↔ RT** | ❌ None | None | ⭐⭐⭐⭐ (High) |

---

## 🚀 High-Priority Integration Opportunities

### 1. **Core + RT Integration** ⭐⭐⭐⭐⭐

**Current State:**
- `agentic-robotics-rt` has priority scheduling and dual runtimes
- `agentic-robotics-core` has Publisher/Subscriber but no priority awareness
- **They don't talk to each other!**

**Problem:**
```rust
// Core doesn't know about RT priorities
let publisher = node.publish::<SensorData>("/sensors")?;
publisher.publish(&data).await?; // What priority? No control!

// RT doesn't know about Core pub/sub
executor.spawn_rt(Priority::High, deadline, async {
    // Can't easily use Core publishers here
});
```

**Opportunity: Priority-Aware Pub/Sub**

Add priority to Core's Publisher/Subscriber:

```rust
// NEW API in agentic-robotics-core
use agentic_robotics_rt::Priority;

pub struct Publisher<T: Message> {
    topic: String,
    priority: Option<Priority>,  // NEW
    // ...
}

impl<T: Message> Publisher<T> {
    /// Create publisher with RT priority
    pub fn with_priority(topic: impl Into<String>, priority: Priority) -> Self {
        // ...
    }

    /// Publish with guaranteed priority scheduling
    pub async fn publish_rt(&self, msg: &T) -> Result<()> {
        if let Some(priority) = self.priority {
            // Use RT executor's high/low runtime based on priority
            // ...
        }
        // ...
    }
}
```

**Use Case:**
```rust
use agentic_robotics_core::Node;
use agentic_robotics_rt::{ROS3Executor, Priority, Deadline};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut node = Node::new("robot")?;
    let executor = ROS3Executor::new()?;

    // High-priority control publisher (guarantees < 1ms deadline)
    let cmd_pub = node.publish_with_priority::<JointCmd>(
        "/joint_commands",
        Priority::High
    )?;

    // Low-priority telemetry (allows > 10ms deadline)
    let log_pub = node.publish_with_priority::<Log>(
        "/logs",
        Priority::Low
    )?;

    // High-priority 1kHz control loop
    executor.spawn_rt(
        Priority(3),
        Deadline::from_hz(1000),
        async move {
            loop {
                let cmd = compute_control().await;
                cmd_pub.publish_rt(&cmd).await?; // Runs on high-priority runtime
                tokio::time::sleep(Duration::from_millis(1)).await;
            }
        }
    )?;

    executor.run().await?;
    Ok(())
}
```

**Benefits:**
- ✅ Control loops never blocked by low-priority work
- ✅ Predictable latencies (< 1ms for critical messages)
- ✅ Better CPU utilization (work stealing between priorities)
- ✅ Unified API (one crate, but with RT guarantees)

**Implementation Checklist:**
- [ ] Add `priority: Option<Priority>` to `Publisher` struct
- [ ] Add `with_priority()` constructor to `Publisher`
- [ ] Add `publish_rt()` method that dispatches to RT executor
- [ ] Add `Subscriber::recv_rt()` with priority-aware polling
- [ ] Update `Node` to hold optional `ROS3Executor` reference
- [ ] Add `Node::with_executor()` constructor
- [ ] Add feature flag `rt` to core crate (optional RT dependency)
- [ ] Write integration tests showing 1kHz control loops
- [ ] Update Core README with RT integration examples
- [ ] Bump versions and publish

**Estimated Effort:** 2-3 days

---

### 2. **MCP + RT Integration** ⭐⭐⭐⭐⭐

**Current State:**
- MCP server handles tool calls but has no priority awareness
- Tools might be computationally expensive (vision, planning)
- **No way to guarantee real-time response for critical tools**

**Problem:**
```rust
// MCP tool that blocks control loop!
server.register_tool("navigate", "Navigate to position", tool(|params| {
    // This could take 500ms for path planning
    // But we're in a control loop that needs < 1ms!
    let path = expensive_path_planning(start, goal); // 😱 BLOCKS!
    Ok(text_response("Navigating..."))
}));
```

**Opportunity: Priority-Aware MCP Tools**

```rust
// NEW API in agentic-robotics-mcp
use agentic_robotics_rt::{ROS3Executor, Priority};

pub struct McpServer {
    tools: Arc<RwLock<HashMap<String, (McpTool, ToolHandler, Priority)>>>, // Added Priority
    executor: Option<Arc<ROS3Executor>>,  // NEW
    // ...
}

impl McpServer {
    /// Create MCP server with RT executor
    pub fn with_executor(name: impl Into<String>, executor: Arc<ROS3Executor>) -> Self {
        Self {
            executor: Some(executor),
            // ...
        }
    }

    /// Register tool with priority
    pub fn register_tool_rt(
        &mut self,
        name: impl Into<String>,
        description: impl Into<String>,
        priority: Priority,
        handler: ToolHandler,
    ) {
        // ...
    }

    async fn handle_call_tool(&self, id: i64, params: Option<Value>) -> McpResponse {
        // Extract tool priority
        let (tool, handler, priority) = /* ... */;

        // Execute on appropriate runtime
        if let Some(executor) = &self.executor {
            match priority {
                Priority::High => {
                    executor.high_priority_runtime()
                        .spawn(async move { handler(params) })
                        .await
                }
                Priority::Low => {
                    executor.low_priority_runtime()
                        .spawn(async move { handler(params) })
                        .await
                }
            }
        } else {
            // Fallback: execute directly
            handler(params).await
        }
    }
}
```

**Use Case:**
```rust
use agentic_robotics_mcp::{McpServer, tool_rt, Priority};
use agentic_robotics_rt::ROS3Executor;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let executor = Arc::new(ROS3Executor::new()?);
    let mut server = McpServer::with_executor("robot-controller", executor.clone());

    // High-priority tool (emergency stop - must be < 1ms)
    server.register_tool_rt(
        "emergency_stop",
        "Stop robot immediately",
        Priority::High,
        tool(|_| {
            stop_all_motors(); // Fast!
            Ok(text_response("Emergency stop activated"))
        })
    );

    // Low-priority tool (path planning - can take 100ms)
    server.register_tool_rt(
        "plan_path",
        "Plan path from A to B",
        Priority::Low,
        tool(|params| {
            let path = expensive_planning(params); // Slow, but OK
            Ok(text_response(format!("Path: {:?}", path)))
        })
    );

    // Medium-priority tool (sensor query - ~10ms)
    server.register_tool_rt(
        "get_sensor_data",
        "Get current sensor readings",
        Priority::Medium,
        tool(|_| {
            let data = read_sensors();
            Ok(json_response(data))
        })
    );

    executor.run().await?;
    Ok(())
}
```

**Benefits:**
- ✅ Critical MCP tools (emergency stop) guaranteed < 1ms response
- ✅ Heavy tools (planning, vision) don't block control loops
- ✅ AI assistants can control robots in real-time
- ✅ Better user experience (no hanging/slow responses)

**Implementation Checklist:**
- [ ] Add `executor: Option<Arc<ROS3Executor>>` to `McpServer`
- [ ] Add `with_executor()` constructor
- [ ] Add `Priority` field to tool registration
- [ ] Add `register_tool_rt()` method
- [ ] Update `handle_call_tool()` to dispatch by priority
- [ ] Add `tool_rt()` helper for priority-aware tools
- [ ] Add feature flag `rt` to MCP crate
- [ ] Write integration tests
- [ ] Update MCP README with RT examples
- [ ] Publish v0.1.3

**Estimated Effort:** 1-2 days

---

### 3. **Core + Node Integration** ⭐⭐⭐⭐⭐

**Current State:**
- `agentic-robotics-node` has stub NAPI bindings
- **No actual Core functionality exposed!**
- TypeScript examples won't work

**Problem:**
```rust
// Current node/src/lib.rs
#[napi]
pub async fn publish(&self, topic: String, data: String) -> Result<()> {
    // In real implementation, this would use ros3-core
    Ok(())  // 😱 Does nothing!
}
```

**Opportunity: Full Core API in Node.js**

```rust
// NEW Implementation in agentic-robotics-node/src/lib.rs
use agentic_robotics_core::{Publisher, Subscriber, Message};
use napi::bindgen_prelude::*;
use serde_json::Value;

#[napi]
pub struct ROS3Node {
    name: String,
    publishers: HashMap<String, Arc<Publisher<Value>>>,  // Generic JSON messages
    subscribers: HashMap<String, Arc<Subscriber<Value>>>,
}

#[napi]
impl ROS3Node {
    #[napi(constructor)]
    pub fn new(name: String) -> Result<Self> {
        Ok(Self {
            name,
            publishers: HashMap::new(),
            subscribers: HashMap::new(),
        })
    }

    #[napi]
    pub fn create_publisher(&mut self, topic: String) -> Result<ROS3Publisher> {
        // Create real Core publisher
        let publisher = Publisher::<Value>::new(topic.clone());
        let publisher_arc = Arc::new(publisher);
        self.publishers.insert(topic.clone(), publisher_arc.clone());

        Ok(ROS3Publisher {
            topic,
            inner: publisher_arc,
        })
    }

    #[napi]
    pub fn create_subscriber(
        &mut self,
        topic: String,
        callback: JsFunction,
    ) -> Result<ROS3Subscriber> {
        // Create real Core subscriber
        let subscriber = Subscriber::<Value>::new(topic.clone());
        let subscriber_arc = Arc::new(subscriber);

        // Spawn task to call JS callback on messages
        let cb = callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        tokio::spawn(async move {
            loop {
                if let Ok(Some(msg)) = subscriber_arc.try_recv() {
                    let json_str = serde_json::to_string(&msg).unwrap();
                    cb.call(Ok(json_str), ThreadsafeFunctionCallMode::Blocking);
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        });

        Ok(ROS3Subscriber {
            topic,
            inner: subscriber_arc,
        })
    }
}

#[napi]
pub struct ROS3Publisher {
    topic: String,
    inner: Arc<Publisher<Value>>,
}

#[napi]
impl ROS3Publisher {
    #[napi]
    pub async fn publish(&self, data: String) -> Result<()> {
        let value: Value = serde_json::from_str(&data)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        self.inner.publish(&value)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(())
    }

    #[napi]
    pub fn get_topic(&self) -> String {
        self.topic.clone()
    }
}

#[napi]
pub struct ROS3Subscriber {
    topic: String,
    inner: Arc<Subscriber<Value>>,
}

#[napi]
impl ROS3Subscriber {
    #[napi]
    pub fn get_topic(&self) -> String {
        self.topic.clone()
    }
}
```

**TypeScript Usage:**
```typescript
import { ROS3Node } from 'agentic-robotics';

const node = new ROS3Node('my_robot');

// Create publisher (now works!)
const pubCmd = node.createPublisher('/cmd_vel');
await pubCmd.publish(JSON.stringify({
    linear: { x: 0.5, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: 0.1 }
}));

// Create subscriber (now works!)
const subPose = node.createSubscriber('/robot/pose', (msg) => {
    const pose = JSON.parse(msg);
    console.log('Robot position:', pose.x, pose.y);
});
```

**Benefits:**
- ✅ TypeScript examples actually work
- ✅ Full Rust performance from Node.js
- ✅ Seamless integration with existing Node.js robotics code
- ✅ AI agents can control robots via JavaScript

**Implementation Checklist:**
- [ ] Add real `Publisher<Value>` creation in `create_publisher()`
- [ ] Add real `Subscriber<Value>` creation in `create_subscriber()`
- [ ] Implement threadsafe callback mechanism for subscribers
- [ ] Add `ROS3Publisher` and `ROS3Subscriber` NAPI structs
- [ ] Handle JSON serialization/deserialization
- [ ] Add error handling and conversion
- [ ] Write JavaScript integration tests
- [ ] Update TypeScript type definitions
- [ ] Test with existing examples (01-hello-robot.ts, etc.)
- [ ] Publish to npm and crates.io

**Estimated Effort:** 3-4 days

---

### 4. **MCP + Node Integration** ⭐⭐⭐⭐⭐

**Current State:**
- MCP server exists in Rust only
- **No way to control robots from Node.js via MCP**
- Missing huge use case: AI + JavaScript ecosystem

**Opportunity: MCP Server in Node.js**

**Vision:**
```typescript
// NEW: agentic-robotics-mcp Node.js bindings
import { McpServer } from 'agentic-robotics/mcp';
import { ROS3Node } from 'agentic-robotics';

const node = new ROS3Node('robot_controller');
const server = new McpServer('robot-ai', '1.0.0');

// Register tools that control robot
server.registerTool({
    name: 'move_forward',
    description: 'Move robot forward by distance',
    parameters: {
        distance: { type: 'number', description: 'Distance in meters' }
    },
    handler: async (params) => {
        const pubCmd = node.createPublisher('/cmd_vel');
        await pubCmd.publish(JSON.stringify({
            linear: { x: params.distance, y: 0, z: 0 },
            angular: { x: 0, y: 0, z: 0 }
        }));
        return { success: true, message: `Moved ${params.distance}m` };
    }
});

// Run STDIO transport for Claude Desktop
server.runStdio();
```

**Benefits:**
- ✅ Control robots from Claude Desktop using JavaScript
- ✅ Leverage huge Node.js ecosystem (vision libraries, ML, etc.)
- ✅ Easier for web developers to build robot AI integrations
- ✅ Deploy MCP servers on serverless (Lambda, Vercel, etc.)

**Implementation Checklist:**
- [ ] Create NAPI bindings for `McpServer` in node crate
- [ ] Expose `registerTool()` to JavaScript
- [ ] Expose `runStdio()` transport
- [ ] Handle async JavaScript callbacks
- [ ] Add TypeScript type definitions
- [ ] Write Node.js MCP examples
- [ ] Test with Claude Desktop
- [ ] Document in README
- [ ] Publish to npm

**Estimated Effort:** 2-3 days

---

### 5. **RT + Embedded Integration** ⭐⭐⭐⭐

**Current State:**
- `agentic-robotics-rt` targets desktop/server (Tokio)
- `agentic-robotics-embedded` targets bare-metal (no-std)
- **No code sharing between them!**

**Opportunity: Unified RT API**

**Vision:**
```rust
// Shared API works on both desktop and embedded

#[cfg(not(feature = "embedded"))]
use agentic_robotics_rt::ROS3Executor;

#[cfg(feature = "embedded")]
use agentic_robotics_embedded::EmbeddedExecutor;

// Common trait
pub trait RTExecutor {
    fn spawn_rt(&self, priority: Priority, deadline: Deadline, task: impl Future);
    fn spawn_high(&self, task: impl Future);
    fn spawn_low(&self, task: impl Future);
}

// Works on desktop
let executor = ROS3Executor::new()?;
executor.spawn_high(control_loop());

// Works on embedded (same API!)
let executor = EmbeddedExecutor::new()?;
executor.spawn_high(control_loop());
```

**Benefits:**
- ✅ Write code once, run on desktop and embedded
- ✅ Test on desktop, deploy to embedded
- ✅ Unified learning curve for developers

**Implementation Checklist:**
- [ ] Define shared `RTExecutor` trait in new `agentic-robotics-rt-api` crate
- [ ] Implement trait for `ROS3Executor` (desktop)
- [ ] Implement trait for `EmbeddedExecutor` (RTIC/Embassy)
- [ ] Add feature flags for runtime selection
- [ ] Write cross-platform examples
- [ ] Test on STM32/ESP32

**Estimated Effort:** 4-5 days

---

## 🎯 Medium-Priority Opportunities

### 6. **Core: Add Node API** ⭐⭐⭐⭐

Currently missing high-level `Node` abstraction like ROS2:

```rust
// MISSING from Core!
pub struct Node {
    name: String,
    publishers: HashMap<String, Box<dyn Any>>,
    subscribers: HashMap<String, Box<dyn Any>>,
}

impl Node {
    pub fn new(name: impl Into<String>) -> Result<Self>;

    pub fn publish<T: Message>(&mut self, topic: impl Into<String>) -> Result<Publisher<T>>;
    pub fn subscribe<T: Message>(&mut self, topic: impl Into<String>) -> Result<Subscriber<T>>;

    pub fn call_service<Req, Res>(&self, service: &str, req: Req) -> Result<Res>;
}
```

**Benefits:**
- ✅ ROS2-like ergonomics
- ✅ Easier migration from ROS2
- ✅ Better resource management

---

### 7. **Core: QoS Profiles** ⭐⭐⭐

Add Quality of Service configuration:

```rust
pub struct QoS {
    pub reliability: Reliability,  // Reliable, BestEffort
    pub durability: Durability,    // Transient, Volatile
    pub history_depth: usize,
}

// Usage
let qos = QoS::reliable().with_history(10);
let pub = node.publish_with_qos::<Cmd>("/commands", qos)?;
```

---

### 8. **MCP: Tool Discovery** ⭐⭐⭐

Auto-discover tools from Core topics:

```rust
// Auto-register all topics as MCP tools
server.auto_discover_from_node(&node)?;

// Claude can now:
// - "publish to /cmd_vel"
// - "subscribe to /sensor/data"
// - "list all topics"
```

---

### 9. **Node: TypeScript Types from Rust** ⭐⭐⭐⭐

Generate TypeScript types from Rust message definitions:

```rust
#[derive(Message, TsType)]  // NEW derive
pub struct RobotState {
    pub pose: Pose,
    pub velocity: Twist,
}
```

Generates:
```typescript
interface RobotState {
    pose: Pose;
    velocity: Twist;
}
```

---

### 10. **RT: Deadline Monitoring** ⭐⭐⭐⭐

Add real-time deadline tracking:

```rust
executor.set_deadline_callback(|task_id, deadline, actual| {
    if actual > deadline {
        eprintln!("⚠️ Task {} missed deadline: {:?} > {:?}", task_id, actual, deadline);
    }
});
```

---

## 🔄 Cross-Cutting Improvements

### 11. **Unified Error Types** ⭐⭐⭐

All crates use different error types:

```rust
// Create shared error crate
use agentic_robotics_error::Error;

pub enum Error {
    Core(CoreError),
    Rt(RtError),
    Mcp(McpError),
    Node(NodeError),
}
```

---

### 12. **Shared Tracing/Telemetry** ⭐⭐⭐⭐

Add unified telemetry across all crates:

```rust
use agentic_robotics_telemetry::{init_telemetry, record_metric};

init_telemetry("robot_controller")?;

// Auto-collected metrics:
// - Pub/sub latencies
// - RT deadline misses
// - MCP tool execution times
// - Memory usage
```

---

### 13. **Inter-Crate Examples** ⭐⭐⭐⭐⭐

Add examples showing multi-crate usage:

```
examples/
├── 01-basic-node.rs              (Core only)
├── 02-rt-control-loop.rs         (Core + RT)
├── 03-mcp-robot-control.rs       (Core + MCP)
├── 04-priority-pub-sub.rs        (Core + RT)
├── 05-ai-robot-typescript.ts     (Node + MCP)
├── 06-embedded-control.rs        (Core + Embedded + RT)
└── 07-full-stack-robot.rs        (All crates!)
```

---

### 14. **Feature Flag Consistency** ⭐⭐⭐

Standardize feature flags across crates:

```toml
[features]
default = []
rt = ["agentic-robotics-rt"]
mcp = ["agentic-robotics-mcp"]
embedded = ["agentic-robotics-embedded"]
full = ["rt", "mcp", "embedded"]
```

---

### 15. **Workspace-Level Integration Tests** ⭐⭐⭐⭐

Add cross-crate integration tests:

```rust
// tests/integration/core_rt.rs
#[tokio::test]
async fn test_priority_pub_sub() {
    let executor = ROS3Executor::new()?;
    let mut node = Node::with_executor("test", executor.clone())?;

    let pub = node.publish_with_priority::<String>("/test", Priority::High)?;
    let sub = node.subscribe::<String>("/test")?;

    executor.spawn_high(async move {
        pub.publish_rt(&"test".to_string()).await?;
    });

    let msg = tokio::time::timeout(Duration::from_millis(10), sub.recv()).await??;
    assert_eq!(msg, "test");
}
```

---

## 📊 Priority Matrix

| Opportunity | Impact | Effort | Priority | Status |
|-------------|--------|--------|----------|--------|
| 1. Core + RT Integration | ⭐⭐⭐⭐⭐ | 2-3 days | **P0** | 🔴 Not Started |
| 2. MCP + RT Integration | ⭐⭐⭐⭐⭐ | 1-2 days | **P0** | 🔴 Not Started |
| 3. Core + Node Integration | ⭐⭐⭐⭐⭐ | 3-4 days | **P0** | 🔴 Not Started |
| 4. MCP + Node Integration | ⭐⭐⭐⭐⭐ | 2-3 days | **P0** | 🔴 Not Started |
| 13. Inter-Crate Examples | ⭐⭐⭐⭐⭐ | 2-3 days | **P0** | 🔴 Not Started |
| 6. Core Node API | ⭐⭐⭐⭐ | 1-2 days | **P1** | 🔴 Not Started |
| 10. Deadline Monitoring | ⭐⭐⭐⭐ | 1 day | **P1** | 🔴 Not Started |
| 12. Shared Telemetry | ⭐⭐⭐⭐ | 2 days | **P1** | 🔴 Not Started |
| 5. RT + Embedded Integration | ⭐⭐⭐⭐ | 4-5 days | **P2** | 🔴 Not Started |
| 7. QoS Profiles | ⭐⭐⭐ | 2 days | **P2** | 🔴 Not Started |
| 8. MCP Tool Discovery | ⭐⭐⭐ | 1 day | **P2** | 🔴 Not Started |
| 9. TypeScript Codegen | ⭐⭐⭐⭐ | 3 days | **P2** | 🔴 Not Started |
| 11. Unified Errors | ⭐⭐⭐ | 1 day | **P3** | 🔴 Not Started |
| 14. Feature Flags | ⭐⭐⭐ | 0.5 days | **P3** | 🔴 Not Started |
| 15. Integration Tests | ⭐⭐⭐⭐ | 2 days | **P1** | 🔴 Not Started |

---

## 🎯 Recommended Roadmap

### Phase 1: Critical Integrations (2 weeks)
**Goal:** Make the crates actually work together

1. **Week 1:**
   - Core + RT Integration (Priority-aware pub/sub)
   - MCP + RT Integration (Priority-aware tools)
   - Inter-crate examples

2. **Week 2:**
   - Core + Node Integration (Real functionality)
   - MCP + Node Integration (Node.js MCP server)
   - Integration tests

### Phase 2: Polish & Ergonomics (1 week)
**Goal:** Make it easy to use

3. **Week 3:**
   - Core Node API
   - Deadline monitoring
   - Shared telemetry
   - QoS profiles

### Phase 3: Advanced Features (2 weeks)
**Goal:** Complete the ecosystem

4. **Week 4-5:**
   - RT + Embedded integration
   - TypeScript codegen
   - MCP tool discovery
   - Unified errors

---

## 🎓 Example: Full-Stack Robot (Future)

**After all integrations, this becomes possible:**

```rust
// main.rs - Full-stack robot controller
use agentic_robotics_core::Node;
use agentic_robotics_rt::{ROS3Executor, Priority, Deadline};
use agentic_robotics_mcp::{McpServer, tool_rt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create RT executor
    let executor = Arc::new(ROS3Executor::new()?);

    // Create robot node with executor
    let mut node = Node::with_executor("robot", executor.clone())?;

    // High-priority control loop (1kHz)
    let cmd_pub = node.publish_with_priority::<JointCmd>(
        "/joint_commands",
        Priority::High
    )?;
    let state_sub = node.subscribe::<JointState>("/joint_states")?;

    executor.spawn_rt(
        Priority(3),
        Deadline::from_hz(1000),
        async move {
            loop {
                if let Some(state) = state_sub.try_recv() {
                    let cmd = compute_control(&state);
                    cmd_pub.publish_rt(&cmd).await?;
                }
                tokio::time::sleep(Duration::from_millis(1)).await;
            }
        }
    )?;

    // MCP server for AI control
    let mut mcp_server = McpServer::with_executor("robot-ai", executor.clone());

    // Emergency stop (< 1ms response)
    mcp_server.register_tool_rt(
        "emergency_stop",
        "Stop robot immediately",
        Priority::High,
        tool(|_| {
            stop_all_motors();
            Ok(text_response("Stopped"))
        })
    );

    // Path planning (can take 100ms)
    mcp_server.register_tool_rt(
        "plan_path",
        "Plan path to target",
        Priority::Low,
        tool(|params| {
            let path = plan_path(params);
            Ok(json_response(path))
        })
    );

    // Auto-discover all topics as tools
    mcp_server.auto_discover_from_node(&node)?;

    // Run MCP server on STDIO (for Claude Desktop)
    let transport = StdioTransport::new(mcp_server);
    tokio::spawn(async move {
        transport.run().await
    });

    // Low-priority telemetry (10Hz)
    let log_pub = node.publish_with_priority::<Telemetry>(
        "/telemetry",
        Priority::Low
    )?;

    executor.spawn_rt(
        Priority(1),
        Deadline::from_hz(10),
        async move {
            loop {
                let telemetry = collect_telemetry();
                log_pub.publish(&telemetry).await?;
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    )?;

    executor.run().await?;
    Ok(())
}
```

**This robot can:**
- ✅ Run 1kHz control loops with deterministic latency
- ✅ Accept AI commands via Claude Desktop (MCP)
- ✅ Handle emergency stops in < 1ms
- ✅ Plan paths without blocking control
- ✅ Stream telemetry at 10Hz
- ✅ All from a single unified API!

---

## 📝 Next Steps

### Immediate Actions (This Week):

1. **Choose P0 opportunity** based on user priority
2. **Create feature branch** for integration work
3. **Start with Core + RT** (highest impact, moderate effort)
4. **Write failing tests** that show desired API
5. **Implement integration** following checklist
6. **Update READMEs** with new examples
7. **Bump versions** and publish

### Questions to Answer:

1. Which integration should we tackle first?
2. Should we create a new `agentic-robotics` meta-crate that re-exports all integrations?
3. Do you want to maintain backward compatibility, or can we break APIs?
4. What's the target release date for v0.2.0 with integrations?

---

## 🔗 References

- Current implementation: `crates/agentic-robotics-*/src/`
- Published crates: https://crates.io/search?q=agentic-robotics
- MCP specification: https://gist.github.com/ruvnet/284f199d0e0836c1b5185e30f819e052
- ROS2 comparisons: `crates/agentic-robotics-core/README.md`

---

**Document Status:** ✅ Complete
**Last Updated:** 2025-11-15
**Next Review:** After first P0 integration is implemented

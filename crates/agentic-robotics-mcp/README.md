# agentic-robotics-mcp

[![Crates.io](https://img.shields.io/crates/v/agentic-robotics-mcp.svg)](https://crates.io/crates/agentic-robotics-mcp)
[![Documentation](https://docs.rs/agentic-robotics-mcp/badge.svg)](https://docs.rs/agentic-robotics-mcp)
[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue.svg)](../../LICENSE)

**Model Context Protocol (MCP) integration for Agentic Robotics**

Part of the [Agentic Robotics](https://github.com/ruvnet/vibecast) framework - high-performance robotics middleware with ROS2 compatibility.

## Features

- 🤖 **MCP Server**: Expose robot functionality via Model Context Protocol
- 🔌 **Easy Integration**: Connect LLMs to robot systems
- 📡 **Real-time Communication**: Low-latency request/response
- 🛠️ **Tool Registration**: Define robot tools for AI agents
- 🌐 **Remote Access**: Control robots via natural language

## Installation

```toml
[dependencies]
agentic-robotics-core = "0.1.0"
agentic-robotics-mcp = "0.1.0"
```

## Quick Start

### Create MCP Server

```rust
use agentic_robotics_mcp::{McpServer, Tool};
use agentic_robotics_core::Node;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create robot node
    let mut node = Node::new("robot_mcp")?;

    // Create MCP server
    let mcp = McpServer::new("tcp://0.0.0.0:9000")?;

    // Register tools
    mcp.register_tool(Tool {
        name: "move_robot".to_string(),
        description: "Move the robot to a position".to_string(),
        parameters: vec![
            Parameter::new("x", "f64", "X coordinate"),
            Parameter::new("y", "f64", "Y coordinate"),
        ],
        handler: Box::new(|params| async move {
            let x: f64 = params.get("x")?;
            let y: f64 = params.get("y")?;
            move_robot(x, y).await?;
            Ok("Robot moved successfully".into())
        }),
    })?;

    // Start server
    mcp.serve().await?;

    Ok(())
}
```

### Register Robot Capabilities

```rust
// Navigation tool
mcp.register_tool(Tool::new("navigate")
    .description("Navigate to a named location")
    .param("location", "string", "Target location name")
    .handler(|params| async move {
        let location = params.get("location")?;
        navigate_to(location).await?;
        Ok(json!({"status": "arrived"}))
    }))?;

// Vision tool
mcp.register_tool(Tool::new("detect_objects")
    .description("Detect objects in camera view")
    .handler(|_| async move {
        let objects = detect_objects().await?;
        Ok(json!({"objects": objects}))
    }))?;

// Manipulation tool
mcp.register_tool(Tool::new("pick_object")
    .description("Pick up an object by name")
    .param("object", "string", "Object name to pick")
    .handler(|params| async move {
        let object = params.get("object")?;
        pick_object(object).await?;
        Ok(json!({"status": "picked"}))
    }))?;
```

## Use Cases

### AI-Assisted Robot Control

Connect an LLM to control your robot via natural language:

```rust
// Register tools
mcp.register_tool(navigate_tool)?;
mcp.register_tool(pickup_tool)?;
mcp.register_tool(place_tool)?;

// LLM can now call: navigate("kitchen") -> pickup("cup") -> navigate("table") -> place("cup")
```

### Multi-Robot Coordination

Expose multiple robots via MCP:

```rust
let mcp1 = McpServer::new("tcp://0.0.0.0:9001")?;
let mcp2 = McpServer::new("tcp://0.0.0.0:9002")?;

// LLM can coordinate multiple robots simultaneously
```

### Remote Debugging

Expose debug commands via MCP:

```rust
mcp.register_tool(Tool::new("get_status")
    .description("Get robot status")
    .handler(|_| async move {
        Ok(json!({
            "battery": get_battery_level(),
            "pose": get_current_pose(),
            "state": get_robot_state(),
        }))
    }))?;
```

## Architecture

```
┌──────────────────────────────────────┐
│         AI Assistant (LLM)           │
│     (Claude, GPT, etc.)              │
└─────────────┬────────────────────────┘
              │ MCP Protocol
              │
┌─────────────▼────────────────────────┐
│    agentic-robotics-mcp (Server)     │
│                                      │
│  ┌──────────────────────────────┐   │
│  │  Tool Registry               │   │
│  │  • navigate                  │   │
│  │  • pickup                    │   │
│  │  • detect                    │   │
│  └──────────────────────────────┘   │
└─────────────┬────────────────────────┘
              │
┌─────────────▼────────────────────────┐
│    agentic-robotics-core (Node)      │
│    • Pub/Sub                         │
│    • Services                        │
│    • Actions                         │
└──────────────────────────────────────┘
```

## Examples

See the [examples directory](../../examples) for complete examples.

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](../../LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT License ([LICENSE-MIT](../../LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

## Links

- **Homepage**: [ruv.io](https://ruv.io)
- **Documentation**: [docs.rs/agentic-robotics-mcp](https://docs.rs/agentic-robotics-mcp)
- **Repository**: [github.com/ruvnet/vibecast](https://github.com/ruvnet/vibecast)
- **MCP Specification**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

**Part of the Agentic Robotics framework** • Built with ❤️ by the Agentic Robotics Team

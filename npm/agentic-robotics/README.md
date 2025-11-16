# Agentic Robotics

High-performance agentic robotics framework with ROS2 compatibility.

## Installation

```bash
npm install -g agentic-robotics
```

This installs:
- **Core bindings** (`@agentic-robotics/core`) - Native Rust bindings via NAPI-RS
- **CLI tools** (`@agentic-robotics/cli`) - Command-line interface
- **MCP Server** (`@agentic-robotics/mcp`) - Model Context Protocol server with AgentDB

## Quick Start

### CLI Usage

```bash
# Test the framework
agentic-robotics test

# Show information
agentic-robotics info
```

### MCP Server

```bash
# Start MCP server
agentic-robotics-mcp
```

### Programmatic Usage

```javascript
const { AgenticNode } = require('agentic-robotics');

const node = new AgenticNode('my-robot');
const publisher = await node.createPublisher('/sensors/data');

await publisher.publish(JSON.stringify({
  temperature: 25.5,
  timestamp: Date.now()
}));
```

## Package Structure

This is a meta-package that includes:

- `@agentic-robotics/core` - Core native bindings
- `@agentic-robotics/cli` - CLI tools
- `@agentic-robotics/mcp` - MCP server with AgentDB/agentic-flow integration
- Platform-specific packages (auto-installed based on your OS):
  - `@agentic-robotics/linux-x64-gnu`
  - `@agentic-robotics/linux-arm64-gnu`
  - `@agentic-robotics/darwin-x64`
  - `@agentic-robotics/darwin-arm64`

## Performance

- 13,000x faster than CLI-based approaches
- 5,725 ops/sec throughput for storage operations
- 100µs vector search with AgentDB integration
- Native Rust performance via NAPI-RS

## Documentation

Visit [https://docs.rs/agentic-robotics](https://docs.rs/agentic-robotics) for full documentation.

## License

MIT OR Apache-2.0

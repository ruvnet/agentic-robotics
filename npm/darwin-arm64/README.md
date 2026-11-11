# @agentic-robotics/darwin-arm64

![agentic-robotics message flow: node, publisher, subscriber, MCP server, AgentDB](https://raw.githubusercontent.com/ruvnet/agentic-robotics/main/docs/assets/agentic-robotics-flow.svg)

Native bindings for **agentic-robotics** on macOS arm64 (Apple silicon).

This package contains the precompiled native binary for the agentic-robotics framework. It is installed automatically as an optional dependency of `@agentic-robotics/core` on a matching platform; you should not need to install it directly.

```bash
npm install @agentic-robotics/core
```

The binary is built by the `release-native` workflow in [ruvnet/agentic-robotics](https://github.com/ruvnet/agentic-robotics) and is not committed to the repository.

## Quick start

```bash
npm install @agentic-robotics/core
node -e "const { AgenticNode } = require('@agentic-robotics/core'); new AgenticNode('demo').createPublisher('/demo').then(async p => { await p.publish(JSON.stringify({ ok: true })); console.log(p.getStats()); })"
# { messages: 1, bytes: 11 }
```

## License

MIT OR Apache-2.0

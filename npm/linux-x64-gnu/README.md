# @agentic-robotics/linux-x64-gnu

[![npm version](https://img.shields.io/npm/v/@agentic-robotics/linux-x64-gnu.svg)](https://www.npmjs.com/package/@agentic-robotics/linux-x64-gnu)
[![License](https://img.shields.io/npm/l/@agentic-robotics/linux-x64-gnu.svg)](https://github.com/ruvnet/agentic-robotics)

![agentic-robotics message flow: node, publisher, subscriber, MCP server, AgentDB](https://raw.githubusercontent.com/ruvnet/agentic-robotics/main/docs/assets/agentic-robotics-flow.svg)

Native bindings for **agentic-robotics** on Linux x64 (GNU libc).

This package contains the precompiled native binary for the agentic-robotics framework. It is automatically installed as an optional dependency when you install `@agentic-robotics/core` on a compatible platform.

## Platform Support

- **OS**: Linux
- **Architecture**: x86_64 (x64)
- **C Library**: GNU libc (glibc) 2.34 or newer

## Installation

This package is typically installed automatically:

```bash
npm install @agentic-robotics/core
```

If you need to install it directly:

```bash
npm install @agentic-robotics/linux-x64-gnu
```

## Technical Details

- **Binary Size**: ~800 KB (optimized)
- **Rust Version**: 1.83+
- **NAPI Version**: 3+
- **Build Type**: Release (optimized)

## Compatibility

Requires glibc 2.34 or newer (the binary links `GLIBC_2.34` symbols), for example:
- Ubuntu 22.04+
- Debian 12+
- RHEL / Rocky / AlmaLinux 9+
- Fedora 35+

Older distributions (Ubuntu 20.04, Debian 11, CentOS 7, RHEL 8) fail to load the binary with a `GLIBC_2.34 not found` error.
musl-based distributions such as Alpine are not supported.

## Homepage

Visit [ruv.io](https://ruv.io) for more information.

## Quick start

```bash
npm install @agentic-robotics/core
node -e "const { AgenticNode } = require('@agentic-robotics/core'); new AgenticNode('demo').createPublisher('/demo').then(async p => { await p.publish(JSON.stringify({ ok: true })); console.log(p.getStats()); })"
# { messages: 1, bytes: 11 }
```

## License

MIT OR Apache-2.0

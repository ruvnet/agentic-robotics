#!/usr/bin/env node

/**
 * ROS3 MCP Server CLI
 */

import { ROS3McpServer } from './server.js';

async function main() {
  const server = new ROS3McpServer({
    name: 'ros3-mcp-server',
    version: '1.0.0',
    dbPath: process.env.AGENTDB_PATH || './ros3-agentdb.db',
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down ROS3 MCP Server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\nShutting down ROS3 MCP Server...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

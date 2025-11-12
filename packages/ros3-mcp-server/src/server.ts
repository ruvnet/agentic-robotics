/**
 * ROS3 MCP Server implementation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ROS3Interface } from './interface.js';
import { AgentDBMemory } from './memory.js';
import { registerMotionTools } from './tools/motion.js';
import { registerPerceptionTools } from './tools/perception.js';
import { registerMemoryTools } from './tools/memory.js';

export interface ROS3McpServerConfig {
  name?: string;
  version?: string;
  dbPath?: string;
}

export class ROS3McpServer {
  private server: McpServer;
  private ros3: ROS3Interface;
  private memory: AgentDBMemory;
  private transport?: StdioServerTransport;

  constructor(config: ROS3McpServerConfig = {}) {
    const {
      name = 'ros3-mcp-server',
      version = '1.0.0',
      dbPath = './ros3-agentdb.db',
    } = config;

    // Initialize ROS3 interface
    this.ros3 = new ROS3Interface();

    // Initialize AgentDB memory
    this.memory = new AgentDBMemory(dbPath);

    // Create MCP server
    this.server = new McpServer({
      name,
      version,
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    });

    // Register all tools
    this.registerTools();
  }

  private registerTools(): void {
    registerMotionTools(this.server, this.ros3, this.memory);
    registerPerceptionTools(this.server, this.ros3, this.memory);
    registerMemoryTools(this.server, this.memory);
  }

  async start(): Promise<void> {
    // Initialize AgentDB
    await this.memory.initialize();

    // Connect transport
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);

    console.error('ROS3 MCP Server started');
  }

  async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
    }
    await this.memory.close();
  }
}

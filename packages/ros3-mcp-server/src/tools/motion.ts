/**
 * Motion control tools for MCP
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ROS3Interface } from '../interface.js';
import type { AgentDBMemory } from '../memory.js';

export function registerMotionTools(
  server: McpServer,
  ros3: ROS3Interface,
  memory: AgentDBMemory
): void {
  // Move robot tool
  server.registerTool(
    'move_robot',
    {
      description: 'Move robot to target pose (meters, radians)',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate in meters' },
          y: { type: 'number', description: 'Y coordinate in meters' },
          z: { type: 'number', description: 'Z coordinate in meters' },
          roll: { type: 'number', description: 'Roll angle in radians' },
          pitch: { type: 'number', description: 'Pitch angle in radians' },
          yaw: { type: 'number', description: 'Yaw angle in radians' },
          speed: { type: 'number', default: 0.5, description: 'Movement speed (0.0-1.0)' },
          frame: {
            type: 'string',
            enum: ['base', 'world'],
            default: 'world',
            description: 'Reference frame'
          },
        },
        required: ['x', 'y', 'z', 'roll', 'pitch', 'yaw'],
      },
    },
    async ({ x, y, z, roll, pitch, yaw, speed = 0.5, frame = 'world' }) => {
      const startTime = Date.now();

      try {
        await ros3.moveToPose(
          { x, y, z, roll, pitch, yaw },
          speed,
          frame as 'base' | 'world'
        );

        const latency = Date.now() - startTime;

        // Store successful execution in AgentDB
        await memory.storeEpisode({
          sessionId: `motion-${Date.now()}`,
          taskName: 'move_robot',
          confidence: 0.9,
          success: true,
          outcome: `Moved to [${x}, ${y}, ${z}] in ${latency}ms`,
          strategy: `speed_${speed}_frame_${frame}`,
          metadata: { x, y, z, roll, pitch, yaw, speed, frame, latency },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Robot moved to [${x}, ${y}, ${z}] (roll=${roll}, pitch=${pitch}, yaw=${yaw}) in ${frame} frame at speed ${speed}. Completed in ${latency}ms.`,
            },
          ],
        };
      } catch (error: any) {
        // Store failure in AgentDB
        await memory.storeEpisode({
          sessionId: `motion-${Date.now()}`,
          taskName: 'move_robot',
          confidence: 0.0,
          success: false,
          outcome: `Failed: ${error.message}`,
          metadata: { x, y, z, roll, pitch, yaw, speed, frame },
        });

        throw error;
      }
    }
  );

  // Get current pose tool
  server.registerTool(
    'get_pose',
    {
      description: 'Get current robot pose',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async () => {
      const pose = await ros3.getCurrentPose();

      return {
        content: [
          {
            type: 'text',
            text: `Current pose: [${pose.x}, ${pose.y}, ${pose.z}] (roll=${pose.roll}, pitch=${pose.pitch}, yaw=${pose.yaw})`,
          },
        ],
      };
    }
  );

  // Get robot status tool
  server.registerTool(
    'get_status',
    {
      description: 'Get robot operational status',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async () => {
      const status = await ros3.getStatus();

      return {
        content: [
          {
            type: 'text',
            text: `Robot status: ${status.status}, Health: ${status.health}`,
          },
        ],
      };
    }
  );
}

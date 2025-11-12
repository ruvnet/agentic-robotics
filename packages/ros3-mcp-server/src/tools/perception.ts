/**
 * Perception tools for MCP
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ROS3Interface } from '../interface.js';
import type { AgentDBMemory } from '../memory.js';

export function registerPerceptionTools(
  server: McpServer,
  ros3: ROS3Interface,
  memory: AgentDBMemory
): void {
  // Read LIDAR tool
  server.registerTool(
    'read_lidar',
    {
      description: 'Get current LIDAR point cloud with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['all', 'obstacles', 'ground'],
            default: 'all',
            description: 'Point cloud filter'
          },
          max_points: {
            type: 'number',
            default: 10000,
            description: 'Maximum number of points to return'
          },
        },
      },
    },
    async ({ filter = 'all', max_points = 10000 }) => {
      const startTime = Date.now();

      const cloud = await ros3.getLidarData(
        filter as 'all' | 'obstacles' | 'ground',
        max_points
      );

      const latency = Date.now() - startTime;

      // Store in memory
      await memory.storeEpisode({
        sessionId: `lidar-${Date.now()}`,
        taskName: 'read_lidar',
        confidence: 1.0,
        success: true,
        outcome: `Retrieved ${cloud.points.length} points in ${latency}ms`,
        metadata: { filter, max_points, num_points: cloud.points.length, latency },
      });

      return {
        content: [
          {
            type: 'text',
            text: `LIDAR data retrieved: ${cloud.points.length} points (filter: ${filter}, latency: ${latency}ms)\n` +
                  `Sample points: ${JSON.stringify(cloud.points.slice(0, 5))}`,
          },
        ],
      };
    }
  );

  // Detect objects tool
  server.registerTool(
    'detect_objects',
    {
      description: 'Run object detection on camera feed',
      inputSchema: {
        type: 'object',
        properties: {
          camera: {
            type: 'string',
            enum: ['front', 'left', 'right', 'rear'],
            description: 'Camera to use'
          },
          confidence_threshold: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 0.5,
            description: 'Minimum confidence threshold'
          },
        },
        required: ['camera'],
      },
    },
    async ({ camera, confidence_threshold = 0.5 }) => {
      const startTime = Date.now();

      const detections = await ros3.detectObjects(
        camera as 'front' | 'left' | 'right' | 'rear',
        confidence_threshold
      );

      const latency = Date.now() - startTime;

      // Store in memory
      await memory.storeEpisode({
        sessionId: `vision-${Date.now()}`,
        taskName: 'detect_objects',
        confidence: 0.9,
        success: true,
        outcome: `Detected ${detections.length} objects in ${latency}ms`,
        metadata: {
          camera,
          confidence_threshold,
          num_detections: detections.length,
          latency,
        },
      });

      const detectionsSummary = detections.map(d => ({
        class: d.class,
        confidence: d.confidence.toFixed(3),
        bbox: d.bbox.map(v => Math.round(v)),
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Detected ${detections.length} objects from ${camera} camera:\n` +
                  JSON.stringify(detectionsSummary, null, 2) +
                  `\n\nCompleted in ${latency}ms`,
          },
        ],
      };
    }
  );
}

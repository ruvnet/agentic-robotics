/**
 * Memory and learning tools for MCP
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AgentDBMemory } from '../memory.js';

export function registerMemoryTools(
  server: McpServer,
  memory: AgentDBMemory
): void {
  // Query memory tool
  server.registerTool(
    'query_memory',
    {
      description: 'Query AgentDB reflexion memory for similar past experiences',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language query for similar experiences'
          },
          k: {
            type: 'number',
            default: 5,
            description: 'Number of memories to retrieve'
          },
          only_successes: {
            type: 'boolean',
            default: false,
            description: 'Only return successful episodes'
          },
          min_confidence: {
            type: 'number',
            default: 0.0,
            minimum: 0,
            maximum: 1,
            description: 'Minimum confidence threshold'
          },
        },
        required: ['query'],
      },
    },
    async ({ query, k = 5, only_successes = false, min_confidence = 0.0 }) => {
      const result = await memory.queryWithContext(query, {
        k,
        minConfidence: min_confidence,
      });

      const filteredMemories = only_successes
        ? result.memories.filter(m => m.success)
        : result.memories;

      const summary = filteredMemories.map((m: any) => ({
        task: m.task || m.taskName,
        success: m.success,
        confidence: m.confidence?.toFixed(3),
        outcome: m.outcome,
        strategy: m.strategy,
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Found ${filteredMemories.length} relevant memories for: "${query}"\n\n` +
                  JSON.stringify(summary, null, 2) +
                  (result.context ? `\n\nContext: ${result.context}` : ''),
          },
        ],
      };
    }
  );

  // Consolidate skills tool
  server.registerTool(
    'consolidate_skills',
    {
      description: 'Consolidate successful episodes into reusable skills',
      inputSchema: {
        type: 'object',
        properties: {
          min_attempts: {
            type: 'number',
            default: 3,
            description: 'Minimum number of successful attempts'
          },
          min_reward: {
            type: 'number',
            default: 0.7,
            description: 'Minimum reward threshold'
          },
          time_window_days: {
            type: 'number',
            default: 7,
            description: 'Time window in days'
          },
        },
      },
    },
    async ({ min_attempts = 3, min_reward = 0.7, time_window_days = 7 }) => {
      await memory.consolidateSkills({
        minAttempts: min_attempts,
        minReward: min_reward,
        timeWindowDays: time_window_days,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Skills consolidated from successful episodes (min_attempts: ${min_attempts}, min_reward: ${min_reward}, window: ${time_window_days} days)`,
          },
        ],
      };
    }
  );

  // Get memory stats tool
  server.registerTool(
    'get_memory_stats',
    {
      description: 'Get AgentDB database statistics',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async () => {
      const stats = await memory.getStats();

      return {
        content: [
          {
            type: 'text',
            text: `AgentDB Statistics:\n${stats.stats}`,
          },
        ],
      };
    }
  );
}

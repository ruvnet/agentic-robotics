/**
 * Agentic Flow Orchestration Integration - SECURE VERSION
 *
 * Integrates agentic-flow's 66 agents and 213 MCP tools for
 * multi-robot coordination and complex task execution
 *
 * SECURITY: All command execution uses secure spawn() with argument arrays
 */

import { spawn } from 'child_process';

export interface AgentTask {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  params: Record<string, any>;
  timeout?: number;
  retries?: number;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  result: any;
  executionTime: number;
  agentsUsed: string[];
  toolsUsed: string[];
  reasoning?: string;
}

export interface SwarmConfig {
  numAgents?: number;
  strategy?: 'parallel' | 'sequential' | 'adaptive' | 'swarm';
  mcpTools?: string[];
  reasoningEnabled?: boolean;
  learningEnabled?: boolean;
}

export interface OrchestrationMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  avgExecutionTime: number;
  agentUtilization: Record<string, number>;
  toolUsage: Record<string, number>;
}

/**
 * Secure helper to spawn commands with proper argument handling
 */
function spawnAsync(
  command: string,
  args: string[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false, // Critical: disable shell interpretation
      timeout: options.timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Validate and sanitize task parameters
 */
function validateTaskParams(params: Record<string, any>): void {
  // Check for command injection attempts
  const paramStr = JSON.stringify(params);
  if (paramStr.includes(';') || paramStr.includes('|') || paramStr.includes('&')) {
    throw new Error('Invalid characters in task parameters');
  }
}

export class FlowOrchestrator {
  private config: SwarmConfig;
  private metrics: OrchestrationMetrics;
  private initialized: boolean = false;

  constructor(config: SwarmConfig = {}) {
    // Validate config
    if (config.numAgents && (config.numAgents < 1 || config.numAgents > 200)) {
      throw new Error('numAgents must be between 1 and 200');
    }

    this.config = {
      numAgents: config.numAgents || 66,
      strategy: config.strategy || 'adaptive',
      mcpTools: config.mcpTools || [],
      reasoningEnabled: config.reasoningEnabled ?? true,
      learningEnabled: config.learningEnabled ?? true,
    };

    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
      agentUtilization: {},
      toolUsage: {},
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();

    try {
      // Secure initialization with spawn
      const args = ['agentic-flow', 'init', '--agents', this.config.numAgents!.toString(), '--strategy', this.config.strategy!];

      if (this.config.reasoningEnabled) args.push('--enable-reasoning');
      if (this.config.learningEnabled) args.push('--enable-learning');

      await spawnAsync('npx', args);

      const initTime = Date.now() - startTime;
      console.error(`🌊 Agentic Flow initialized (${this.config.numAgents} agents, ${initTime}ms)`);
      this.initialized = true;
    } catch (error: any) {
      console.error('⚠️ Flow initialization warning:', error.message);
      this.initialized = true;
    }
  }

  async executeTask(task: AgentTask): Promise<AgentResult> {
    if (!this.initialized) {
      throw new Error('FlowOrchestrator not initialized. Call initialize() first.');
    }

    // Validate input
    validateTaskParams(task.params);

    const startTime = Date.now();
    this.metrics.totalTasks++;

    try {
      const args = [
        'agentic-flow',
        'execute',
        '--task-type',
        task.type,
        '--priority',
        task.priority,
        '--params',
        JSON.stringify(task.params),
        '--format',
        'json',
      ];

      if (task.timeout) args.push('--timeout', task.timeout.toString());
      if (task.retries) args.push('--retries', task.retries.toString());
      if (this.config.reasoningEnabled) args.push('--enable-reasoning');

      const { stdout, code } = await spawnAsync('npx', args, {
        timeout: task.timeout || 30000,
      });

      if (code !== 0) {
        throw new Error(`Agentic-flow execution failed with code ${code}`);
      }

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find((line) => line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);

        const executionTime = Date.now() - startTime;
        this.metrics.successfulTasks++;
        this.updateMetrics(data, executionTime);

        console.error(`✅ Task ${task.id} completed in ${executionTime}ms`);

        return {
          taskId: task.id,
          success: true,
          result: data.result,
          executionTime,
          agentsUsed: data.agents_used || [],
          toolsUsed: data.tools_used || [],
          reasoning: data.reasoning,
        };
      }

      throw new Error('No valid JSON response from agentic-flow');
    } catch (error: any) {
      this.metrics.failedTasks++;
      const executionTime = Date.now() - startTime;

      console.error(`❌ Task ${task.id} failed: ${error.message}`);

      return {
        taskId: task.id,
        success: false,
        result: { error: error.message },
        executionTime,
        agentsUsed: [],
        toolsUsed: [],
      };
    }
  }

  async executeSwarm(tasks: AgentTask[]): Promise<AgentResult[]> {
    if (!this.initialized) {
      throw new Error('FlowOrchestrator not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    console.error(`🐝 Executing swarm with ${tasks.length} tasks`);

    try {
      // Validate all tasks
      tasks.forEach((task) => validateTaskParams(task.params));

      const args = [
        'agentic-flow',
        'swarm',
        '--tasks',
        JSON.stringify(tasks),
        '--strategy',
        this.config.strategy!,
        '--num-agents',
        this.config.numAgents!.toString(),
        '--format',
        'json',
      ];

      if (this.config.reasoningEnabled) args.push('--enable-reasoning');

      const { stdout, code } = await spawnAsync('npx', args, { timeout: 60000 });

      if (code !== 0) {
        throw new Error(`Swarm execution failed with code ${code}`);
      }

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find((line) => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        const results = Array.isArray(data) ? data : [data];

        const swarmTime = Date.now() - startTime;
        console.error(`🎯 Swarm completed ${results.length} tasks in ${swarmTime}ms`);

        return results.map((r, i) => ({
          taskId: tasks[i].id,
          success: r.success ?? true,
          result: r.result,
          executionTime: r.execution_time || swarmTime / results.length,
          agentsUsed: r.agents_used || [],
          toolsUsed: r.tools_used || [],
          reasoning: r.reasoning,
        }));
      }

      throw new Error('No valid JSON response from swarm execution');
    } catch (error: any) {
      console.error(`❌ Swarm execution failed: ${error.message}`);

      return tasks.map((task) => ({
        taskId: task.id,
        success: false,
        result: { error: error.message },
        executionTime: 0,
        agentsUsed: [],
        toolsUsed: [],
      }));
    }
  }

  async coordinateRobots(
    robots: string[],
    mission: {
      type: string;
      objectives: string[];
      constraints?: Record<string, any>;
    }
  ): Promise<{
    success: boolean;
    assignments: Record<string, string[]>;
    executionPlan: any;
    estimatedTime: number;
  }> {
    if (!this.initialized) {
      throw new Error('FlowOrchestrator not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    try {
      const args = [
        'agentic-flow',
        'coordinate',
        '--robots',
        JSON.stringify(robots),
        '--mission-type',
        mission.type,
        '--objectives',
        JSON.stringify(mission.objectives),
        '--format',
        'json',
      ];

      if (mission.constraints) {
        args.push('--constraints', JSON.stringify(mission.constraints));
      }

      const { stdout, code } = await spawnAsync('npx', args, { timeout: 30000 });

      if (code !== 0) {
        throw new Error(`Coordination failed with code ${code}`);
      }

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find((line) => line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);

        const coordTime = Date.now() - startTime;
        console.error(`🤝 Robot coordination completed in ${coordTime}ms`);

        return {
          success: true,
          assignments: data.assignments || {},
          executionPlan: data.execution_plan || {},
          estimatedTime: data.estimated_time || 0,
        };
      }

      throw new Error('No valid JSON response from coordination');
    } catch (error: any) {
      throw new Error(`Robot coordination failed: ${error.message}`);
    }
  }

  async reasonAboutTask(
    context: string,
    options: {
      useMemory?: boolean;
      synthesizeStrategy?: boolean;
      explainReasoning?: boolean;
    } = {}
  ): Promise<{
    decision: string;
    reasoning: string;
    confidence: number;
    alternatives: string[];
  }> {
    if (!this.initialized) {
      throw new Error('FlowOrchestrator not initialized. Call initialize() first.');
    }

    try {
      const args = ['agentic-flow', 'reason', '--context', context, '--format', 'json'];

      if (options.useMemory) args.push('--use-memory');
      if (options.synthesizeStrategy) args.push('--synthesize-strategy');
      if (options.explainReasoning) args.push('--explain-reasoning');

      const { stdout, code } = await spawnAsync('npx', args, { timeout: 15000 });

      if (code !== 0) {
        throw new Error(`Reasoning failed with code ${code}`);
      }

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find((line) => line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);

        return {
          decision: data.decision || '',
          reasoning: data.reasoning || '',
          confidence: data.confidence || 0,
          alternatives: data.alternatives || [],
        };
      }

      throw new Error('No valid JSON response from reasoning');
    } catch (error: any) {
      throw new Error(`Reasoning failed: ${error.message}`);
    }
  }

  async getAvailableTools(): Promise<string[]> {
    try {
      const { stdout, code } = await spawnAsync('npx', [
        'agentic-flow',
        'list-tools',
        '--format',
        'json',
      ]);

      if (code !== 0) {
        throw new Error('Failed to list tools');
      }

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find((line) => line.startsWith('['));

      if (jsonLine) {
        const tools = JSON.parse(jsonLine);
        console.error(`🔧 Found ${tools.length}/213 MCP tools available`);
        return tools;
      }

      return [];
    } catch (error: any) {
      throw new Error(`Failed to list tools: ${error.message}`);
    }
  }

  getMetrics(): OrchestrationMetrics {
    return {
      ...this.metrics,
      avgExecutionTime:
        this.metrics.totalTasks > 0 ? this.metrics.avgExecutionTime / this.metrics.totalTasks : 0,
    };
  }

  private updateMetrics(data: any, executionTime: number): void {
    this.metrics.avgExecutionTime += executionTime;

    if (data.agents_used) {
      for (const agent of data.agents_used) {
        this.metrics.agentUtilization[agent] = (this.metrics.agentUtilization[agent] || 0) + 1;
      }
    }

    if (data.tools_used) {
      for (const tool of data.tools_used) {
        this.metrics.toolUsage[tool] = (this.metrics.toolUsage[tool] || 0) + 1;
      }
    }
  }

  resetMetrics(): void {
    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
      agentUtilization: {},
      toolUsage: {},
    };
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}

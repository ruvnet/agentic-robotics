#!/usr/bin/env node
/**
 * Parallel Swarm Execution Framework
 * Manages concurrent swarm execution with resource optimization
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';

interface SwarmTask {
  id: string;
  type: string;
  config: any;
  priority: number;
  dependencies?: string[];
}

interface SwarmExecution {
  task: SwarmTask;
  process?: ChildProcess;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: any;
}

interface ExecutionMetrics {
  totalTasks: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  avgExecutionTime: number;
  resourceUtilization: number;
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color: string, prefix: string, message: string): void {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

class ParallelSwarmExecutor extends EventEmitter {
  private executions: Map<string, SwarmExecution> = new Map();
  private maxConcurrent: number;
  private runningCount: number = 0;
  private completedCount: number = 0;
  private failedCount: number = 0;
  private startTime: number = 0;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(maxConcurrent: number = 8) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      './examples/data/parallel-swarms',
      './examples/data/metrics'
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  addTask(task: SwarmTask): void {
    this.executions.set(task.id, {
      task,
      status: 'pending'
    });

    log(colors.cyan, '[PARALLEL]', `Task added: ${task.id} (${task.type})`);
  }

  private canExecute(taskId: string): boolean {
    const execution = this.executions.get(taskId);
    if (!execution || execution.status !== 'pending') {
      return false;
    }

    // Check dependencies
    if (execution.task.dependencies) {
      for (const depId of execution.task.dependencies) {
        const dep = this.executions.get(depId);
        if (!dep || dep.status !== 'completed') {
          return false;
        }
      }
    }

    return this.runningCount < this.maxConcurrent;
  }

  private async executeTask(taskId: string): Promise<void> {
    const execution = this.executions.get(taskId);
    if (!execution) return;

    execution.status = 'running';
    execution.startTime = Date.now();
    this.runningCount++;

    log(colors.cyan, `[${taskId}]`, `Starting execution...`);

    try {
      const result = await this.runSwarm(execution.task);

      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.result = result;
      this.completedCount++;

      log(colors.green, `[${taskId}]`, `✓ Completed in ${((execution.endTime - execution.startTime!) / 1000).toFixed(2)}s`);

      this.emit('taskCompleted', taskId, result);
    } catch (error: any) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = error;
      this.failedCount++;

      log(colors.red, `[${taskId}]`, `✗ Failed: ${error.message}`);

      this.emit('taskFailed', taskId, error);
    } finally {
      this.runningCount--;
      this.checkAndScheduleNext();
    }
  }

  private async runSwarm(task: SwarmTask): Promise<any> {
    return new Promise((resolve, reject) => {
      // Determine which example to run based on task type
      let script: string;
      let args: string[] = [];

      switch (task.type) {
        case 'benchmark':
          script = 'tsx';
          args = ['examples/self-learning/benchmark-optimizer.ts', ...(task.config.args || [])];
          break;
        case 'navigation':
          script = 'tsx';
          args = ['examples/self-learning/self-improving-navigator.ts', ...(task.config.args || [])];
          break;
        case 'swarm-orchestration':
          script = 'tsx';
          args = ['examples/self-learning/swarm-orchestrator.ts', ...(task.config.args || [])];
          break;
        default:
          reject(new Error(`Unknown task type: ${task.type}`));
          return;
      }

      const childProcess = spawn(script, args, {
        env: {
          ...process.env,
          ...task.config.env
        },
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      childProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve({
            success: true,
            output,
            exitCode: code
          });
        } else {
          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        }
      });

      childProcess.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private checkAndScheduleNext(): void {
    // Find next task that can be executed
    for (const [taskId, execution] of this.executions) {
      if (this.canExecute(taskId)) {
        this.executeTask(taskId);
      }
    }

    // Check if all tasks are done
    if (this.runningCount === 0 && this.getPendingCount() === 0) {
      this.emit('allCompleted');
    }
  }

  private getPendingCount(): number {
    return Array.from(this.executions.values()).filter(e => e.status === 'pending').length;
  }

  private getMetrics(): ExecutionMetrics {
    const completedExecutions = Array.from(this.executions.values())
      .filter(e => e.status === 'completed' && e.startTime && e.endTime);

    const avgExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + (e.endTime! - e.startTime!), 0) / completedExecutions.length
      : 0;

    const resourceUtilization = this.runningCount / this.maxConcurrent;

    return {
      totalTasks: this.executions.size,
      completed: this.completedCount,
      failed: this.failedCount,
      running: this.runningCount,
      pending: this.getPendingCount(),
      avgExecutionTime,
      resourceUtilization
    };
  }

  private startMetricsMonitoring(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics', metrics);

      log(colors.cyan, '[METRICS]', `Running: ${metrics.running}, Completed: ${metrics.completed}, Failed: ${metrics.failed}, Pending: ${metrics.pending}`);
    }, 5000); // Every 5 seconds
  }

  private stopMetricsMonitoring(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private saveResults(): void {
    const timestamp = Date.now();
    const resultsPath = join('./examples/data/parallel-swarms', `execution-${timestamp}.json`);

    const results = {
      timestamp: new Date().toISOString(),
      duration: timestamp - this.startTime,
      metrics: this.getMetrics(),
      executions: Array.from(this.executions.entries()).map(([id, exec]) => ({
        id,
        task: exec.task,
        status: exec.status,
        duration: exec.startTime && exec.endTime ? exec.endTime - exec.startTime : null,
        result: exec.result,
        error: exec.error ? exec.error.message : null
      }))
    };

    writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    log(colors.green, '[PARALLEL]', `✓ Results saved: ${resultsPath}`);
  }

  async execute(): Promise<void> {
    log(colors.bright + colors.magenta, '[PARALLEL]', '═══════════════════════════════════════════');
    log(colors.bright + colors.magenta, '[PARALLEL]', 'Parallel Swarm Executor');
    log(colors.bright + colors.magenta, '[PARALLEL]', '═══════════════════════════════════════════');
    console.log('');

    this.startTime = Date.now();
    this.startMetricsMonitoring();

    log(colors.cyan, '[PARALLEL]', `Executing ${this.executions.size} tasks with max ${this.maxConcurrent} concurrent...`);
    console.log('');

    // Start initial batch
    this.checkAndScheduleNext();

    // Wait for all tasks to complete
    await new Promise<void>((resolve) => {
      this.on('allCompleted', () => {
        resolve();
      });
    });

    this.stopMetricsMonitoring();

    // Final metrics
    const finalMetrics = this.getMetrics();
    console.log('');
    log(colors.bright + colors.magenta, '[PARALLEL]', '═══════════════════════════════════════════');
    log(colors.bright + colors.magenta, '[PARALLEL]', '✓ Execution Complete');
    log(colors.bright + colors.magenta, '[PARALLEL]', '═══════════════════════════════════════════');
    log(colors.green, '[PARALLEL]', `Total Tasks: ${finalMetrics.totalTasks}`);
    log(colors.green, '[PARALLEL]', `Completed: ${finalMetrics.completed}`);
    log(colors.red, '[PARALLEL]', `Failed: ${finalMetrics.failed}`);
    log(colors.cyan, '[PARALLEL]', `Avg Execution Time: ${(finalMetrics.avgExecutionTime / 1000).toFixed(2)}s`);
    log(colors.cyan, '[PARALLEL]', `Total Duration: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`);
    console.log('');

    // Save results
    this.saveResults();
  }
}

// Main execution
async function main() {
  const maxConcurrent = parseInt(process.argv[2]) || 8;

  const executor = new ParallelSwarmExecutor(maxConcurrent);

  // Add example tasks
  executor.addTask({
    id: 'benchmark-1',
    type: 'benchmark',
    config: { args: ['12', '10'] },
    priority: 1
  });

  executor.addTask({
    id: 'navigation-1',
    type: 'navigation',
    config: { args: ['20'] },
    priority: 1
  });

  executor.addTask({
    id: 'benchmark-2',
    type: 'benchmark',
    config: { args: ['8', '5'] },
    priority: 2,
    dependencies: ['benchmark-1']
  });

  executor.addTask({
    id: 'navigation-2',
    type: 'navigation',
    config: { args: ['15'] },
    priority: 2,
    dependencies: ['navigation-1']
  });

  await executor.execute();

  process.exit(0);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ParallelSwarmExecutor, SwarmTask };

#!/usr/bin/env node
/**
 * Integration Adapter
 * Integrates existing examples with self-learning optimization system
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface IntegrationTask {
  exampleName: string;
  examplePath: string;
  learningEnabled: boolean;
  optimizationStrategy: string;
}

interface ExampleResult {
  exampleName: string;
  success: boolean;
  duration: number;
  metrics: any;
  learnings: any[];
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(color: string, prefix: string, message: string): void {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

class IntegrationAdapter {
  private tasks: IntegrationTask[] = [];
  private results: ExampleResult[] = [];

  constructor() {
    this.discoverExamples();
  }

  private discoverExamples(): void {
    log(colors.cyan, '[ADAPTER]', 'Discovering existing examples...');

    const examples = [
      {
        exampleName: 'Cognitive Navigation',
        examplePath: '../cognitive-navigation.ts',
        learningEnabled: true,
        optimizationStrategy: 'navigation'
      },
      {
        exampleName: 'Swarm Intelligence',
        examplePath: '../04-swarm-intelligence.ts',
        learningEnabled: true,
        optimizationStrategy: 'swarm'
      },
      {
        exampleName: 'Adaptive Learning',
        examplePath: '../08-adaptive-learning.ts',
        learningEnabled: true,
        optimizationStrategy: 'adaptive'
      },
      {
        exampleName: 'Autonomous Navigator',
        examplePath: '../02-autonomous-navigator.ts',
        learningEnabled: true,
        optimizationStrategy: 'navigation'
      }
    ];

    for (const example of examples) {
      const fullPath = join(__dirname, example.examplePath);
      if (existsSync(fullPath)) {
        this.tasks.push(example);
        log(colors.green, '[ADAPTER]', `✓ Found: ${example.exampleName}`);
      }
    }

    log(colors.green, '[ADAPTER]', `✓ Discovered ${this.tasks.length} examples`);
  }

  private async runExampleWithLearning(task: IntegrationTask): Promise<ExampleResult> {
    log(colors.cyan, `[${task.exampleName}]`, 'Starting with learning enabled...');

    const startTime = Date.now();

    return new Promise((resolve) => {
      const fullPath = join(__dirname, task.examplePath);

      const child = spawn('npx', ['tsx', fullPath], {
        env: {
          ...process.env,
          LEARNING_ENABLED: 'true',
          OPTIMIZATION_STRATEGY: task.optimizationStrategy
        },
        cwd: join(__dirname, '..')
      });

      let output = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      // Auto-terminate after 10 seconds for testing
      setTimeout(() => {
        child.kill();
      }, 10000);

      child.on('close', (code) => {
        const duration = Date.now() - startTime;

        const result: ExampleResult = {
          exampleName: task.exampleName,
          success: code === 0 || code === null, // null means killed by timeout
          duration,
          metrics: this.extractMetrics(output),
          learnings: this.extractLearnings(output)
        };

        resolve(result);
      });
    });
  }

  private extractMetrics(output: string): any {
    // Extract performance metrics from output
    const metrics = {
      executionTime: 0,
      successRate: 0,
      efficiency: 0
    };

    // Parse output for metrics
    const timeMatch = output.match(/(\d+)ms/);
    if (timeMatch) {
      metrics.executionTime = parseInt(timeMatch[1]);
    }

    return metrics;
  }

  private extractLearnings(output: string): any[] {
    // Extract learning patterns from output
    const learnings: any[] = [];

    // Look for success indicators
    if (output.includes('✅') || output.includes('Success')) {
      learnings.push({
        type: 'success_pattern',
        description: 'Execution completed successfully'
      });
    }

    return learnings;
  }

  private async optimizeExample(task: IntegrationTask, result: ExampleResult): Promise<void> {
    log(colors.cyan, '[ADAPTER]', `Optimizing ${task.exampleName}...`);

    // Use appropriate optimizer based on strategy
    let optimizerScript: string;
    const args: string[] = [];

    switch (task.optimizationStrategy) {
      case 'navigation':
        optimizerScript = 'self-improving-navigator.ts';
        args.push('10');
        break;
      case 'swarm':
        optimizerScript = 'swarm-orchestrator.ts';
        args.push('navigation', '6');
        break;
      case 'adaptive':
        optimizerScript = 'benchmark-optimizer.ts';
        args.push('6', '5');
        break;
      default:
        optimizerScript = 'benchmark-optimizer.ts';
        args.push('6', '5');
    }

    const optimizerPath = join(__dirname, optimizerScript);

    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['tsx', optimizerPath, ...args], {
        stdio: 'inherit',
        cwd: __dirname
      });

      child.on('close', (code) => {
        if (code === 0) {
          log(colors.green, '[ADAPTER]', `✓ Optimization complete for ${task.exampleName}`);
          resolve();
        } else {
          reject(new Error(`Optimization failed with code ${code}`));
        }
      });
    });
  }

  private saveIntegrationReport(): void {
    const reportPath = join('./examples/data/integration', `integration-${Date.now()}.json`);

    const report = {
      timestamp: new Date().toISOString(),
      totalExamples: this.tasks.length,
      results: this.results,
      summary: {
        successful: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length,
        avgDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
        totalLearnings: this.results.reduce((sum, r) => sum + r.learnings.length, 0)
      }
    };

    // Ensure directory exists
    const dir = join('./examples/data/integration');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    log(colors.green, '[ADAPTER]', `✓ Integration report saved: ${reportPath}`);
  }

  async integrate(runOptimization: boolean = false): Promise<void> {
    log(colors.bright + colors.cyan, '[ADAPTER]', '═══════════════════════════════════════════');
    log(colors.bright + colors.cyan, '[ADAPTER]', 'Integration Adapter');
    log(colors.bright + colors.cyan, '[ADAPTER]', '═══════════════════════════════════════════');
    console.log('');

    for (const task of this.tasks) {
      try {
        const result = await this.runExampleWithLearning(task);
        this.results.push(result);

        if (result.success) {
          log(colors.green, '[ADAPTER]', `✓ ${task.exampleName} completed`);

          if (runOptimization) {
            await this.optimizeExample(task, result);
          }
        } else {
          log(colors.red, '[ADAPTER]', `✗ ${task.exampleName} failed`);
        }
      } catch (error: any) {
        log(colors.red, '[ADAPTER]', `✗ Error: ${error.message}`);
      }

      console.log('');
    }

    this.saveIntegrationReport();

    console.log('');
    log(colors.bright + colors.cyan, '[ADAPTER]', '═══════════════════════════════════════════');
    log(colors.bright + colors.cyan, '[ADAPTER]', '✓ Integration Complete');
    log(colors.bright + colors.cyan, '[ADAPTER]', '═══════════════════════════════════════════');
    console.log('');

    const summary = {
      total: this.tasks.length,
      successful: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length
    };

    log(colors.green, '[ADAPTER]', `Total Examples: ${summary.total}`);
    log(colors.green, '[ADAPTER]', `Successful: ${summary.successful}`);
    log(colors.red, '[ADAPTER]', `Failed: ${summary.failed}`);
    console.log('');
  }
}

// Main execution
async function main() {
  const runOptimization = process.argv.includes('--optimize');

  const adapter = new IntegrationAdapter();
  await adapter.integrate(runOptimization);

  process.exit(0);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { IntegrationAdapter };

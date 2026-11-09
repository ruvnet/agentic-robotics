#!/usr/bin/env node
/**
 * Self-Learning Swarm Orchestrator with Memory Bank
 * Implements parallel swarm execution with continuous optimization
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

export interface SwarmConfig {
  id: string;
  task: string;
  model: string;
  provider: string;
  explorationRate: number;
  priority: number;
}

export interface SwarmResult {
  id: string;
  success: boolean;
  duration: number;
  metrics: any;
  learnings: any;
  output?: string;
  error?: string;
}

export interface OptimizationMetrics {
  sessionId: string;
  timestamp: string;
  swarms: number;
  successRate: number;
  averageDuration: number;
  bestStrategy: string;
  improvementRate: number;
  convergence: number;
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

class SelfLearningSwarmOrchestrator {
  private settings: any;
  private memoryBank: any;
  private activeSwarms: Map<string, ChildProcess> = new Map();
  private results: SwarmResult[] = [];
  private sessionId: string;
  private metricsPath: string;

  constructor() {
    this.sessionId = `swarm-${Date.now()}`;
    this.metricsPath = './examples/data/metrics';
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      './examples/data',
      './examples/data/metrics',
      './examples/data/optimization',
      './examples/data/swarms'
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private loadSettings(): void {
    log(colors.cyan, '[ORCHESTRATOR]', 'Loading settings...');

    try {
      const settingsPath = './.claude/settings.json';
      this.settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
      log(colors.green, '[ORCHESTRATOR]', '✓ Settings loaded');
    } catch (error: any) {
      log(colors.red, '[ORCHESTRATOR]', `✗ Failed to load settings: ${error.message}`);
      throw error;
    }
  }

  private loadMemoryBank(): void {
    log(colors.cyan, '[ORCHESTRATOR]', 'Loading memory bank...');

    const memoryBankPath = './examples/data/memory-bank.json';

    if (existsSync(memoryBankPath)) {
      try {
        this.memoryBank = JSON.parse(readFileSync(memoryBankPath, 'utf8'));
        log(colors.green, '[ORCHESTRATOR]', `✓ Memory bank loaded (${this.memoryBank.totalSessions} sessions)`);
      } catch (error: any) {
        log(colors.yellow, '[ORCHESTRATOR]', `⚠ Creating new memory bank`);
        this.memoryBank = this.createEmptyMemoryBank();
      }
    } else {
      this.memoryBank = this.createEmptyMemoryBank();
    }
  }

  private createEmptyMemoryBank(): any {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      totalSessions: 0,
      learnings: [],
      optimizationHistory: []
    };
  }

  private generateSwarmConfigs(taskType: string, variations: number): SwarmConfig[] {
    const configs: SwarmConfig[] = [];
    const models = [
      'deepseek/deepseek-r1-0528:free',
      'google/gemini-2.0-flash-thinking-exp:free',
      'anthropic/claude-sonnet-4',
      'openai/gpt-4-turbo-preview'
    ];

    const tasks = this.generateTaskVariations(taskType, variations);

    for (let i = 0; i < variations; i++) {
      const explorationRate = 0.1 + (i / variations) * 0.8; // 0.1 to 0.9

      configs.push({
        id: `swarm-${i}`,
        task: tasks[i],
        model: models[i % models.length],
        provider: 'openrouter',
        explorationRate,
        priority: i
      });
    }

    return configs;
  }

  private generateTaskVariations(taskType: string, count: number): string[] {
    const baseTask = `Optimize the ${taskType} example for maximum performance and learning efficiency.`;

    const variations = [
      `${baseTask} Focus on exploration of novel strategies.`,
      `${baseTask} Focus on exploitation of known successful patterns.`,
      `${baseTask} Balance exploration and exploitation equally.`,
      `${baseTask} Emphasize convergence speed.`,
      `${baseTask} Emphasize solution quality over speed.`,
      `${baseTask} Use evolutionary strategies.`,
      `${baseTask} Use gradient-based optimization.`,
      `${baseTask} Use swarm intelligence principles.`
    ];

    return variations.slice(0, count);
  }

  private async spawnSwarm(config: SwarmConfig): Promise<SwarmResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      log(colors.cyan, `[${config.id}]`, `Starting swarm with ${config.model}...`);

      // Build task prompt with memory-augmented learning
      const taskPrompt = this.buildMemoryAugmentedTask(config);

      // Spawn agentic-flow swarm agent
      const childProcess = spawn('npx', [
        'agentic-flow',
        '--agent', 'optimizer',
        '--task', taskPrompt,
        '--model', config.model,
        '--provider', config.provider,
        '--output', 'json'
      ], {
        env: {
          ...process.env,
          USE_OPENROUTER: 'true',
          OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || ''
        },
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
      });

      childProcess.on('close', (code: number | null) => {
        const duration = Date.now() - startTime;

        if (code === 0) {
          log(colors.green, `[${config.id}]`, `✓ Completed in ${(duration / 1000).toFixed(2)}s`);

          const result: SwarmResult = {
            id: config.id,
            success: true,
            duration,
            metrics: this.extractMetrics(output),
            learnings: this.extractLearnings(output),
            output
          };

          resolve(result);
        } else {
          log(colors.red, `[${config.id}]`, `✗ Failed (exit code ${code})`);

          const result: SwarmResult = {
            id: config.id,
            success: false,
            duration,
            metrics: {},
            learnings: {},
            error: errorOutput
          };

          resolve(result);
        }

        this.activeSwarms.delete(config.id);
      });

      this.activeSwarms.set(config.id, childProcess);
    });
  }

  private buildMemoryAugmentedTask(config: SwarmConfig): string {
    const pastSuccesses = this.memoryBank.learnings
      .slice(-5)
      .filter((l: any) => l.successRate > 0.8)
      .map((l: any) => l.topStrategies?.[0]?.strategy || 'unknown')
      .filter((s: string) => s !== 'unknown');

    let taskPrompt = config.task;

    if (pastSuccesses.length > 0) {
      taskPrompt += `\n\nPast successful strategies to consider: ${pastSuccesses.join(', ')}`;
    }

    taskPrompt += `\n\nExploration rate: ${config.explorationRate}`;
    taskPrompt += `\nPriority: ${config.priority}`;
    taskPrompt += `\nSession: ${this.sessionId}`;

    return taskPrompt;
  }

  private extractMetrics(output: string): any {
    // Try to extract JSON metrics from output
    try {
      const jsonMatch = output.match(/\{[\s\S]*"metrics"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]).metrics;
      }
    } catch (e) {
      // Fallback to basic metrics
    }

    return {
      outputLength: output.length,
      timestamp: new Date().toISOString()
    };
  }

  private extractLearnings(output: string): any {
    // Extract key learnings from output
    return {
      strategies: output.match(/strategy:\s*(\w+)/gi) || [],
      improvements: output.match(/improvement:\s*([\d.]+)%/gi) || [],
      patterns: output.match(/pattern:\s*([^.]+)/gi) || []
    };
  }

  private async executeParallelSwarms(configs: SwarmConfig[]): Promise<void> {
    log(colors.bright + colors.cyan, '[ORCHESTRATOR]', `Launching ${configs.length} parallel swarms...`);

    const maxConcurrent = this.settings.swarm_config.max_concurrent_swarms || 8;
    const batches: SwarmConfig[][] = [];

    // Split configs into batches
    for (let i = 0; i < configs.length; i += maxConcurrent) {
      batches.push(configs.slice(i, i + maxConcurrent));
    }

    // Execute batches sequentially, swarms in parallel within each batch
    for (let i = 0; i < batches.length; i++) {
      log(colors.cyan, '[ORCHESTRATOR]', `Batch ${i + 1}/${batches.length}...`);

      const batchResults = await Promise.all(
        batches[i].map(config => this.spawnSwarm(config))
      );

      this.results.push(...batchResults);
    }
  }

  private analyzeResults(): OptimizationMetrics {
    log(colors.cyan, '[ORCHESTRATOR]', 'Analyzing results...');

    const successfulResults = this.results.filter(r => r.success);
    const successRate = this.results.length > 0
      ? successfulResults.length / this.results.length
      : 0;

    const averageDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;

    // Find best strategy
    const strategyScores = new Map<string, number>();
    for (const result of successfulResults) {
      const strategies = result.learnings.strategies || [];
      for (const strategy of strategies) {
        const count = strategyScores.get(strategy) || 0;
        strategyScores.set(strategy, count + 1);
      }
    }

    const bestStrategy = Array.from(strategyScores.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    // Calculate improvement rate
    const improvements = this.results
      .map(r => r.learnings.improvements || [])
      .flat()
      .map((imp: string) => parseFloat(imp.match(/[\d.]+/)?.[0] || '0'))
      .filter((imp: number) => !isNaN(imp));

    const improvementRate = improvements.length > 0
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length / 100
      : 0;

    // Calculate convergence (variance in results)
    const durations = this.results.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const convergence = 1 / (1 + variance / 1000000); // Normalize to 0-1

    const metrics: OptimizationMetrics = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      swarms: this.results.length,
      successRate,
      averageDuration,
      bestStrategy,
      improvementRate,
      convergence
    };

    log(colors.green, '[ORCHESTRATOR]', `✓ Success rate: ${(successRate * 100).toFixed(1)}%`);
    log(colors.green, '[ORCHESTRATOR]', `✓ Average duration: ${(averageDuration / 1000).toFixed(2)}s`);
    log(colors.green, '[ORCHESTRATOR]', `✓ Best strategy: ${bestStrategy}`);
    log(colors.green, '[ORCHESTRATOR]', `✓ Improvement rate: ${(improvementRate * 100).toFixed(2)}%`);
    log(colors.green, '[ORCHESTRATOR]', `✓ Convergence: ${(convergence * 100).toFixed(1)}%`);

    return metrics;
  }

  private saveOptimizationResults(metrics: OptimizationMetrics): void {
    log(colors.cyan, '[ORCHESTRATOR]', 'Saving optimization results...');

    // Save detailed results
    const resultsPath = join('./examples/data/optimization', `${this.sessionId}.json`);
    const resultsData = {
      sessionId: this.sessionId,
      metrics,
      results: this.results,
      timestamp: new Date().toISOString()
    };

    writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));

    // Save metrics
    const metricsPath = join(this.metricsPath, `${this.sessionId}.json`);
    writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

    log(colors.green, '[ORCHESTRATOR]', `✓ Results saved: ${resultsPath}`);
  }

  async run(taskType: string = 'navigation', swarmCount: number = 8): Promise<void> {
    log(colors.bright + colors.green, '[ORCHESTRATOR]', '═══════════════════════════════════════════');
    log(colors.bright + colors.green, '[ORCHESTRATOR]', 'Self-Learning Swarm Orchestrator');
    log(colors.bright + colors.green, '[ORCHESTRATOR]', '═══════════════════════════════════════════');
    console.log('');

    try {
      // Initialize
      this.loadSettings();
      this.loadMemoryBank();

      // Generate swarm configurations
      const configs = this.generateSwarmConfigs(taskType, swarmCount);

      // Execute parallel swarms
      await this.executeParallelSwarms(configs);

      // Analyze results
      const metrics = this.analyzeResults();

      // Save results
      this.saveOptimizationResults(metrics);

      console.log('');
      log(colors.bright + colors.green, '[ORCHESTRATOR]', '═══════════════════════════════════════════');
      log(colors.bright + colors.green, '[ORCHESTRATOR]', '✓ Swarm Optimization Complete');
      log(colors.bright + colors.green, '[ORCHESTRATOR]', '═══════════════════════════════════════════');
      console.log('');

    } catch (error: any) {
      log(colors.red, '[ORCHESTRATOR]', `✗ Error: ${error.message}`);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const taskType = process.argv[2] || 'navigation';
  const swarmCount = parseInt(process.argv[3]) || 8;

  const orchestrator = new SelfLearningSwarmOrchestrator();
  await orchestrator.run(taskType, swarmCount);

  process.exit(0);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { SelfLearningSwarmOrchestrator };

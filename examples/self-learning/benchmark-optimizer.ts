#!/usr/bin/env node
/**
 * Benchmark Optimizer with Swarm Intelligence
 * Automatically finds optimal configurations through parallel swarm exploration
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

interface BenchmarkConfig {
  name: string;
  parameters: Record<string, number>;
  constraints: Record<string, [number, number]>; // [min, max]
}

interface BenchmarkResult {
  configId: string;
  parameters: Record<string, number>;
  metrics: {
    executionTime: number;
    successRate: number;
    efficiency: number;
    accuracy: number;
  };
  score: number;
}

interface SwarmAgent {
  id: string;
  position: Record<string, number>; // Current parameter values
  velocity: Record<string, number>; // Parameter change rates
  bestPosition: Record<string, number>;
  bestScore: number;
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

class BenchmarkOptimizer {
  private config: BenchmarkConfig;
  private swarmSize: number;
  private agents: SwarmAgent[] = [];
  private globalBestPosition: Record<string, number> = {};
  private globalBestScore: number = -Infinity;
  private results: BenchmarkResult[] = [];
  private iterations: number = 0;
  private maxIterations: number;

  constructor(config: BenchmarkConfig, swarmSize: number = 12, maxIterations: number = 10) {
    this.config = config;
    this.swarmSize = swarmSize;
    this.maxIterations = maxIterations;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      './examples/data/benchmarks',
      './examples/data/optimization'
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private initializeSwarm(): void {
    log(colors.cyan, '[BENCHMARK]', `Initializing swarm with ${this.swarmSize} agents...`);

    for (let i = 0; i < this.swarmSize; i++) {
      const position: Record<string, number> = {};
      const velocity: Record<string, number> = {};

      for (const [param, [min, max]] of Object.entries(this.config.constraints)) {
        position[param] = min + Math.random() * (max - min);
        velocity[param] = (Math.random() - 0.5) * (max - min) * 0.1;
      }

      this.agents.push({
        id: `agent-${i}`,
        position: { ...position },
        velocity: { ...velocity },
        bestPosition: { ...position },
        bestScore: -Infinity
      });
    }

    log(colors.green, '[BENCHMARK]', `✓ Swarm initialized with ${this.swarmSize} agents`);
  }

  private async evaluateConfiguration(config: Record<string, number>): Promise<BenchmarkResult> {
    // Simulate benchmark execution
    const startTime = Date.now();

    // In a real implementation, this would run the actual benchmark
    // For now, we'll use a synthetic fitness function
    const metrics = this.syntheticBenchmark(config);

    const executionTime = Date.now() - startTime;

    // Calculate composite score
    const score =
      metrics.successRate * 0.4 +
      metrics.efficiency * 0.3 +
      metrics.accuracy * 0.2 +
      (1 - metrics.executionTime / 10000) * 0.1; // Normalize execution time

    return {
      configId: `config-${Date.now()}-${Math.random()}`,
      parameters: config,
      metrics: {
        ...metrics,
        executionTime
      },
      score
    };
  }

  private syntheticBenchmark(config: Record<string, number>): {
    executionTime: number;
    successRate: number;
    efficiency: number;
    accuracy: number;
  } {
    // Synthetic benchmark function with multiple peaks
    // This simulates a complex optimization landscape

    const values = Object.values(config);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    // Multi-modal fitness function
    const peak1 = Math.exp(-Math.pow(mean - 0.3, 2) / 0.1);
    const peak2 = Math.exp(-Math.pow(mean - 0.7, 2) / 0.1) * 0.8;
    const noise = (Math.random() - 0.5) * 0.1;

    const fitness = Math.max(peak1, peak2) + noise;

    return {
      executionTime: 1000 + Math.random() * 2000,
      successRate: Math.max(0, Math.min(1, fitness + 0.1)),
      efficiency: Math.max(0, Math.min(1, fitness + 0.05)),
      accuracy: Math.max(0, Math.min(1, fitness))
    };
  }

  private async updateSwarm(): Promise<void> {
    const w = 0.7; // Inertia weight
    const c1 = 1.5; // Cognitive parameter
    const c2 = 1.5; // Social parameter

    for (const agent of this.agents) {
      // Update velocity
      for (const param of Object.keys(agent.position)) {
        const r1 = Math.random();
        const r2 = Math.random();

        const cognitive = c1 * r1 * (agent.bestPosition[param] - agent.position[param]);
        const social = c2 * r2 * (this.globalBestPosition[param] - agent.position[param]);

        agent.velocity[param] = w * agent.velocity[param] + cognitive + social;

        // Limit velocity
        const [min, max] = this.config.constraints[param];
        const maxVelocity = (max - min) * 0.2;
        agent.velocity[param] = Math.max(-maxVelocity, Math.min(maxVelocity, agent.velocity[param]));
      }

      // Update position
      for (const param of Object.keys(agent.position)) {
        agent.position[param] += agent.velocity[param];

        // Enforce bounds
        const [min, max] = this.config.constraints[param];
        agent.position[param] = Math.max(min, Math.min(max, agent.position[param]));
      }
    }
  }

  private async evaluateSwarm(): Promise<void> {
    log(colors.cyan, '[BENCHMARK]', `Evaluating iteration ${this.iterations + 1}/${this.maxIterations}...`);

    // Evaluate all agents in parallel
    const evaluations = await Promise.all(
      this.agents.map(agent => this.evaluateConfiguration(agent.position))
    );

    // Update agent bests and global best
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const result = evaluations[i];

      this.results.push(result);

      if (result.score > agent.bestScore) {
        agent.bestScore = result.score;
        agent.bestPosition = { ...agent.position };

        if (result.score > this.globalBestScore) {
          this.globalBestScore = result.score;
          this.globalBestPosition = { ...agent.position };

          log(colors.green, '[BENCHMARK]', `✓ New best score: ${result.score.toFixed(4)}`);
        }
      }
    }

    // Calculate iteration statistics
    const avgScore = evaluations.reduce((sum, r) => sum + r.score, 0) / evaluations.length;
    const bestScore = Math.max(...evaluations.map(r => r.score));

    log(colors.cyan, '[BENCHMARK]', `  Average score: ${avgScore.toFixed(4)}`);
    log(colors.cyan, '[BENCHMARK]', `  Best score: ${bestScore.toFixed(4)}`);
    log(colors.cyan, '[BENCHMARK]', `  Global best: ${this.globalBestScore.toFixed(4)}`);
  }

  private saveBenchmarkResults(): void {
    log(colors.cyan, '[BENCHMARK]', 'Saving benchmark results...');

    const timestamp = Date.now();
    const resultsPath = join('./examples/data/benchmarks', `benchmark-${timestamp}.json`);

    const report = {
      config: this.config,
      swarmSize: this.swarmSize,
      iterations: this.iterations,
      globalBestScore: this.globalBestScore,
      globalBestPosition: this.globalBestPosition,
      results: this.results,
      timestamp: new Date().toISOString(),
      statistics: this.calculateStatistics()
    };

    writeFileSync(resultsPath, JSON.stringify(report, null, 2));

    // Also save a human-readable summary
    const summaryPath = join('./examples/data/benchmarks', `benchmark-${timestamp}.md`);
    const summary = this.generateSummaryReport(report);
    writeFileSync(summaryPath, summary);

    log(colors.green, '[BENCHMARK]', `✓ Results saved: ${resultsPath}`);
    log(colors.green, '[BENCHMARK]', `✓ Summary saved: ${summaryPath}`);
  }

  private calculateStatistics(): any {
    const scores = this.results.map(r => r.score);
    const executionTimes = this.results.map(r => r.metrics.executionTime);
    const successRates = this.results.map(r => r.metrics.successRate);

    return {
      score: {
        mean: scores.reduce((a, b) => a + b, 0) / scores.length,
        min: Math.min(...scores),
        max: Math.max(...scores),
        std: Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - this.globalBestScore, 2), 0) / scores.length)
      },
      executionTime: {
        mean: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
        min: Math.min(...executionTimes),
        max: Math.max(...executionTimes)
      },
      successRate: {
        mean: successRates.reduce((a, b) => a + b, 0) / successRates.length,
        min: Math.min(...successRates),
        max: Math.max(...successRates)
      }
    };
  }

  private generateSummaryReport(report: any): string {
    return `# Benchmark Optimization Report

**Generated**: ${report.timestamp}
**Configuration**: ${report.config.name}
**Swarm Size**: ${report.swarmSize}
**Iterations**: ${report.iterations}

## Best Configuration

**Score**: ${report.globalBestScore.toFixed(4)}

**Parameters**:
${Object.entries(report.globalBestPosition)
  .map(([key, value]) => `- **${key}**: ${(value as number).toFixed(4)}`)
  .join('\n')}

## Statistics

### Score
- Mean: ${report.statistics.score.mean.toFixed(4)}
- Min: ${report.statistics.score.min.toFixed(4)}
- Max: ${report.statistics.score.max.toFixed(4)}
- Std Dev: ${report.statistics.score.std.toFixed(4)}

### Execution Time
- Mean: ${report.statistics.executionTime.mean.toFixed(2)}ms
- Min: ${report.statistics.executionTime.min.toFixed(2)}ms
- Max: ${report.statistics.executionTime.max.toFixed(2)}ms

### Success Rate
- Mean: ${(report.statistics.successRate.mean * 100).toFixed(2)}%
- Min: ${(report.statistics.successRate.min * 100).toFixed(2)}%
- Max: ${(report.statistics.successRate.max * 100).toFixed(2)}%

## Optimization Progress

${this.generateProgressChart()}

---
*Generated by Benchmark Optimizer with Swarm Intelligence*
`;
  }

  private generateProgressChart(): string {
    // Group results by iteration
    const iterationScores: number[][] = [];
    const resultsPerIteration = this.swarmSize;

    for (let i = 0; i < this.results.length; i += resultsPerIteration) {
      const iterationResults = this.results.slice(i, i + resultsPerIteration);
      iterationScores.push(iterationResults.map(r => r.score));
    }

    // Generate ASCII chart
    let chart = 'Iteration | Best Score | Avg Score\n';
    chart += '----------|------------|----------\n';

    iterationScores.forEach((scores, i) => {
      const best = Math.max(...scores).toFixed(4);
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4);
      chart += `${(i + 1).toString().padStart(9)} | ${best.padStart(10)} | ${avg}\n`;
    });

    return chart;
  }

  async optimize(): Promise<void> {
    log(colors.bright + colors.magenta, '[BENCHMARK]', '═══════════════════════════════════════════');
    log(colors.bright + colors.magenta, '[BENCHMARK]', 'Benchmark Optimizer with Swarm Intelligence');
    log(colors.bright + colors.magenta, '[BENCHMARK]', '═══════════════════════════════════════════');
    console.log('');

    try {
      // Initialize swarm
      this.initializeSwarm();

      // Optimization loop
      for (this.iterations = 0; this.iterations < this.maxIterations; this.iterations++) {
        await this.evaluateSwarm();
        await this.updateSwarm();

        // Brief pause between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Save results
      this.saveBenchmarkResults();

      console.log('');
      log(colors.bright + colors.magenta, '[BENCHMARK]', '═══════════════════════════════════════════');
      log(colors.bright + colors.magenta, '[BENCHMARK]', '✓ Benchmark Optimization Complete');
      log(colors.bright + colors.magenta, '[BENCHMARK]', '═══════════════════════════════════════════');
      console.log('');

      // Print best configuration
      log(colors.bright + colors.green, '[BENCHMARK]', 'Best Configuration:');
      for (const [param, value] of Object.entries(this.globalBestPosition)) {
        log(colors.green, '[BENCHMARK]', `  ${param}: ${value.toFixed(4)}`);
      }
      log(colors.green, '[BENCHMARK]', `  Score: ${this.globalBestScore.toFixed(4)}`);
      console.log('');

    } catch (error: any) {
      log(colors.red, '[BENCHMARK]', `✗ Error: ${error.message}`);
      throw error;
    }
  }
}

// Main execution
async function main() {
  // Example benchmark configuration
  const config: BenchmarkConfig = {
    name: 'Navigation Optimization',
    parameters: {
      speed: 0.5,
      lookAhead: 0.5,
      obstacleAvoidance: 0.5,
      explorationRate: 0.3
    },
    constraints: {
      speed: [0.1, 2.0],
      lookAhead: [0.1, 3.0],
      obstacleAvoidance: [0.1, 2.0],
      explorationRate: [0.0, 1.0]
    }
  };

  const swarmSize = parseInt(process.argv[2]) || 12;
  const maxIterations = parseInt(process.argv[3]) || 10;

  const optimizer = new BenchmarkOptimizer(config, swarmSize, maxIterations);
  await optimizer.optimize();

  process.exit(0);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { BenchmarkOptimizer, BenchmarkConfig, BenchmarkResult };

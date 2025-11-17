#!/usr/bin/env node
/**
 * Self-Improving Navigator
 * Uses swarm optimization to continuously improve navigation strategies
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface Point2D {
  x: number;
  y: number;
}

interface NavigationStrategy {
  name: string;
  parameters: {
    speed: number;
    lookAhead: number;
    obstacleWeight: number;
    goalWeight: number;
    smoothness: number;
  };
  performance: {
    successRate: number;
    avgTime: number;
    avgPathLength: number;
    collisions: number;
    attempts: number;
  };
}

interface NavigationTask {
  start: Point2D;
  goal: Point2D;
  obstacles: Point2D[];
  difficulty: number;
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(color: string, prefix: string, message: string): void {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

class SelfImprovingNavigator {
  private strategies: NavigationStrategy[] = [];
  private memoryBank: any = null;
  private sessionId: string;
  private improvements: number = 0;

  constructor() {
    this.sessionId = `navigator-${Date.now()}`;
    this.ensureDirectories();
    this.initializeStrategies();
    this.loadMemoryBank();
  }

  private ensureDirectories(): void {
    const dirs = [
      './examples/data',
      './examples/data/navigation',
      './examples/data/optimization'
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private initializeStrategies(): void {
    // Initialize with baseline strategies
    this.strategies = [
      {
        name: 'aggressive',
        parameters: {
          speed: 1.5,
          lookAhead: 0.5,
          obstacleWeight: 0.3,
          goalWeight: 0.9,
          smoothness: 0.3
        },
        performance: {
          successRate: 0.5,
          avgTime: 10,
          avgPathLength: 20,
          collisions: 0,
          attempts: 0
        }
      },
      {
        name: 'conservative',
        parameters: {
          speed: 0.5,
          lookAhead: 2.0,
          obstacleWeight: 0.9,
          goalWeight: 0.5,
          smoothness: 0.8
        },
        performance: {
          successRate: 0.8,
          avgTime: 20,
          avgPathLength: 30,
          collisions: 0,
          attempts: 0
        }
      },
      {
        name: 'balanced',
        parameters: {
          speed: 1.0,
          lookAhead: 1.0,
          obstacleWeight: 0.6,
          goalWeight: 0.7,
          smoothness: 0.5
        },
        performance: {
          successRate: 0.7,
          avgTime: 15,
          avgPathLength: 25,
          collisions: 0,
          attempts: 0
        }
      }
    ];

    log(colors.green, '[NAVIGATOR]', `✓ Initialized ${this.strategies.length} baseline strategies`);
  }

  private loadMemoryBank(): void {
    const memoryPath = './examples/data/memory-bank.json';

    if (existsSync(memoryPath)) {
      try {
        this.memoryBank = JSON.parse(readFileSync(memoryPath, 'utf8'));

        // Load historical navigation strategies
        const navHistory = this.memoryBank.optimizationHistory?.filter((h: any) =>
          h.type === 'navigation'
        ) || [];

        if (navHistory.length > 0) {
          log(colors.cyan, '[NAVIGATOR]', `Loaded ${navHistory.length} historical navigation runs`);
          this.updateStrategiesFromHistory(navHistory);
        }
      } catch (error: any) {
        log(colors.yellow, '[NAVIGATOR]', `⚠ Failed to load memory bank: ${error.message}`);
      }
    }
  }

  private updateStrategiesFromHistory(history: any[]): void {
    // Update strategy performance based on historical data
    for (const run of history.slice(-10)) {
      if (run.strategy && run.metrics) {
        const strategy = this.strategies.find(s => s.name === run.strategy);
        if (strategy) {
          // Weighted update
          const alpha = 0.3;
          strategy.performance.successRate =
            strategy.performance.successRate * (1 - alpha) + run.metrics.successRate * alpha;
          strategy.performance.avgTime =
            strategy.performance.avgTime * (1 - alpha) + run.metrics.avgTime * alpha;
        }
      }
    }
  }

  private selectStrategy(task: NavigationTask): NavigationStrategy {
    // Multi-criteria selection with epsilon-greedy exploration
    const epsilon = 0.2;

    if (Math.random() < epsilon) {
      // Explore: choose random strategy
      return this.strategies[Math.floor(Math.random() * this.strategies.length)];
    }

    // Exploit: choose best strategy based on multi-objective score
    const scores = this.strategies.map(strategy => {
      const successScore = strategy.performance.successRate * 100;
      const timeScore = 100 / (1 + strategy.performance.avgTime / 10);
      const pathScore = 100 / (1 + strategy.performance.avgPathLength / 20);

      // Weight based on task difficulty
      const difficultyWeight = task.difficulty;
      const successWeight = 0.5 + difficultyWeight * 0.3;
      const efficiencyWeight = 0.5 - difficultyWeight * 0.3;

      return successScore * successWeight + (timeScore + pathScore) / 2 * efficiencyWeight;
    });

    const bestIdx = scores.indexOf(Math.max(...scores));
    return this.strategies[bestIdx];
  }

  private async executeNavigation(task: NavigationTask, strategy: NavigationStrategy): Promise<any> {
    log(colors.cyan, '[NAVIGATOR]', `Executing with ${strategy.name} strategy...`);

    const startTime = Date.now();
    let position = { ...task.start };
    let pathLength = 0;
    let collisions = 0;
    let steps = 0;
    const maxSteps = 100;

    const path: Point2D[] = [position];

    // Simulate navigation
    while (steps < maxSteps) {
      const distToGoal = this.distance(position, task.goal);

      if (distToGoal < 0.5) {
        // Reached goal
        break;
      }

      // Calculate next position based on strategy
      const direction = this.calculateDirection(position, task.goal, task.obstacles, strategy);

      const nextPos = {
        x: position.x + direction.x * strategy.parameters.speed * 0.1,
        y: position.y + direction.y * strategy.parameters.speed * 0.1
      };

      // Check for collisions
      const hasCollision = task.obstacles.some(obs =>
        this.distance(nextPos, obs) < 0.5
      );

      if (hasCollision) {
        collisions++;
        // Avoid obstacle
        direction.x *= -1;
        direction.y *= -1;
      }

      position = nextPos;
      path.push(position);
      pathLength += this.distance(path[path.length - 2], position);
      steps++;

      // Brief simulation delay
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    const duration = Date.now() - startTime;
    const success = this.distance(position, task.goal) < 0.5;

    return {
      success,
      duration,
      pathLength,
      collisions,
      steps,
      path,
      strategy: strategy.name
    };
  }

  private calculateDirection(
    position: Point2D,
    goal: Point2D,
    obstacles: Point2D[],
    strategy: NavigationStrategy
  ): Point2D {
    // Calculate goal attraction
    const goalDir = this.normalize({
      x: goal.x - position.x,
      y: goal.y - position.y
    });

    // Calculate obstacle repulsion
    let obstacleDir = { x: 0, y: 0 };
    for (const obs of obstacles) {
      const dist = this.distance(position, obs);
      if (dist < strategy.parameters.lookAhead) {
        const repulsion = this.normalize({
          x: position.x - obs.x,
          y: position.y - obs.y
        });
        const strength = 1 / (dist + 0.1);
        obstacleDir.x += repulsion.x * strength;
        obstacleDir.y += repulsion.y * strength;
      }
    }

    obstacleDir = this.normalize(obstacleDir);

    // Combine forces
    const combined = {
      x: goalDir.x * strategy.parameters.goalWeight + obstacleDir.x * strategy.parameters.obstacleWeight,
      y: goalDir.y * strategy.parameters.goalWeight + obstacleDir.y * strategy.parameters.obstacleWeight
    };

    return this.normalize(combined);
  }

  private distance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  private normalize(v: Point2D): Point2D {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: v.x / mag, y: v.y / mag };
  }

  private updateStrategyPerformance(strategy: NavigationStrategy, result: any): void {
    const alpha = 0.2; // Learning rate

    strategy.performance.attempts++;

    // Update success rate
    const newSuccess = result.success ? 1 : 0;
    strategy.performance.successRate =
      strategy.performance.successRate * (1 - alpha) + newSuccess * alpha;

    // Update average time
    strategy.performance.avgTime =
      strategy.performance.avgTime * (1 - alpha) + result.duration * alpha;

    // Update average path length
    strategy.performance.avgPathLength =
      strategy.performance.avgPathLength * (1 - alpha) + result.pathLength * alpha;

    // Update collisions
    strategy.performance.collisions += result.collisions;
  }

  private evolveStrategies(): void {
    // Create new strategies through mutation and crossover
    const topStrategies = this.strategies
      .sort((a, b) => b.performance.successRate - a.performance.successRate)
      .slice(0, 2);

    if (topStrategies.length < 2) return;

    // Crossover: create new strategy from top 2
    const newStrategy: NavigationStrategy = {
      name: `evolved-${this.improvements}`,
      parameters: {
        speed: (topStrategies[0].parameters.speed + topStrategies[1].parameters.speed) / 2,
        lookAhead: (topStrategies[0].parameters.lookAhead + topStrategies[1].parameters.lookAhead) / 2,
        obstacleWeight: (topStrategies[0].parameters.obstacleWeight + topStrategies[1].parameters.obstacleWeight) / 2,
        goalWeight: (topStrategies[0].parameters.goalWeight + topStrategies[1].parameters.goalWeight) / 2,
        smoothness: (topStrategies[0].parameters.smoothness + topStrategies[1].parameters.smoothness) / 2
      },
      performance: {
        successRate: (topStrategies[0].performance.successRate + topStrategies[1].performance.successRate) / 2,
        avgTime: (topStrategies[0].performance.avgTime + topStrategies[1].performance.avgTime) / 2,
        avgPathLength: (topStrategies[0].performance.avgPathLength + topStrategies[1].performance.avgPathLength) / 2,
        collisions: 0,
        attempts: 0
      }
    };

    // Mutation: add random variation
    for (const key of Object.keys(newStrategy.parameters)) {
      const mutation = (Math.random() - 0.5) * 0.2;
      (newStrategy.parameters as any)[key] *= (1 + mutation);
      (newStrategy.parameters as any)[key] = Math.max(0, Math.min(2, (newStrategy.parameters as any)[key]));
    }

    // Replace worst strategy if new one is better
    const worstIdx = this.strategies
      .map((s, i) => ({ s, i }))
      .sort((a, b) => a.s.performance.successRate - b.s.performance.successRate)[0].i;

    this.strategies[worstIdx] = newStrategy;
    this.improvements++;

    log(colors.green, '[NAVIGATOR]', `✓ Evolved new strategy: ${newStrategy.name}`);
  }

  private saveResults(results: any[]): void {
    const resultsPath = join('./examples/data/navigation', `${this.sessionId}.json`);

    const report = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      strategies: this.strategies,
      results,
      improvements: this.improvements,
      statistics: this.calculateStatistics(results)
    };

    writeFileSync(resultsPath, JSON.stringify(report, null, 2));

    log(colors.green, '[NAVIGATOR]', `✓ Results saved: ${resultsPath}`);
  }

  private calculateStatistics(results: any[]): any {
    const successfulResults = results.filter(r => r.success);

    return {
      totalAttempts: results.length,
      successfulAttempts: successfulResults.length,
      successRate: successfulResults.length / results.length,
      avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      avgPathLength: results.reduce((sum, r) => sum + r.pathLength, 0) / results.length,
      totalCollisions: results.reduce((sum, r) => sum + r.collisions, 0),
      improvements: this.improvements
    };
  }

  async run(numTasks: number = 20): Promise<void> {
    log(colors.bright + colors.cyan, '[NAVIGATOR]', '═══════════════════════════════════════════');
    log(colors.bright + colors.cyan, '[NAVIGATOR]', 'Self-Improving Navigator');
    log(colors.bright + colors.cyan, '[NAVIGATOR]', '═══════════════════════════════════════════');
    console.log('');

    const results: any[] = [];

    // Generate navigation tasks
    const tasks: NavigationTask[] = [];
    for (let i = 0; i < numTasks; i++) {
      tasks.push({
        start: { x: 0, y: 0 },
        goal: {
          x: (Math.random() - 0.5) * 20,
          y: (Math.random() - 0.5) * 20
        },
        obstacles: Array.from({ length: 5 + Math.floor(Math.random() * 10) }, () => ({
          x: (Math.random() - 0.5) * 20,
          y: (Math.random() - 0.5) * 20
        })),
        difficulty: Math.random()
      });
    }

    // Execute tasks
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      log(colors.cyan, '[NAVIGATOR]', `Task ${i + 1}/${tasks.length}...`);

      const strategy = this.selectStrategy(task);
      const result = await this.executeNavigation(task, strategy);

      this.updateStrategyPerformance(strategy, result);
      results.push(result);

      log(colors.cyan, '[NAVIGATOR]', `  ${result.success ? '✓' : '✗'} ${result.strategy} - ${result.duration}ms, path: ${result.pathLength.toFixed(2)}`);

      // Evolve strategies every 5 tasks
      if ((i + 1) % 5 === 0) {
        this.evolveStrategies();
      }
    }

    // Save results
    this.saveResults(results);

    // Print summary
    const stats = this.calculateStatistics(results);
    console.log('');
    log(colors.bright + colors.green, '[NAVIGATOR]', '═══════════════════════════════════════════');
    log(colors.bright + colors.green, '[NAVIGATOR]', 'Summary');
    log(colors.bright + colors.green, '[NAVIGATOR]', '═══════════════════════════════════════════');
    log(colors.green, '[NAVIGATOR]', `Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
    log(colors.green, '[NAVIGATOR]', `Avg Duration: ${stats.avgDuration.toFixed(2)}ms`);
    log(colors.green, '[NAVIGATOR]', `Avg Path Length: ${stats.avgPathLength.toFixed(2)}`);
    log(colors.green, '[NAVIGATOR]', `Total Collisions: ${stats.totalCollisions}`);
    log(colors.green, '[NAVIGATOR]', `Strategy Improvements: ${stats.improvements}`);
    console.log('');
  }
}

// Main execution
async function main() {
  const numTasks = parseInt(process.argv[2]) || 20;

  const navigator = new SelfImprovingNavigator();
  await navigator.run(numTasks);

  process.exit(0);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { SelfImprovingNavigator };

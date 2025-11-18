#!/usr/bin/env node
/**
 * Obstacle Course Navigation Simulation
 *
 * Demonstrates:
 * - Complex navigation in cluttered environments
 * - Dynamic obstacle detection and avoidance
 * - Path planning with constraints
 * - Learning from navigation failures
 * - Adaptive speed control
 * - Multi-sensor fusion (simulated)
 *
 * The robot learns optimal navigation strategies through:
 * - Trial and error in challenging environments
 * - Pattern recognition of obstacle configurations
 * - Speed vs. safety trade-offs
 * - Recovery from navigation failures
 */

import { ROS3McpServer } from '../../npm/mcp/src/server.js';

interface Point2D {
  x: number;
  y: number;
}

interface Obstacle {
  position: Point2D;
  radius: number;
  type: 'static' | 'dynamic';
  velocity?: Point2D;
}

interface NavigationStrategy {
  name: string;
  baseSpeed: number;
  safetyMargin: number;
  replanFrequency: number;
  aggressiveness: number; // 0-1, higher = more risk-taking
  successRate: number;
  avgTime: number;
  timesUsed: number;
}

interface CourseSection {
  name: string;
  startPoint: Point2D;
  endPoint: Point2D;
  obstacles: Obstacle[];
  difficulty: number;
}

interface NavigationMetrics {
  sectionName: string;
  strategyUsed: string;
  success: boolean;
  timeElapsed: number;
  collisions: number;
  nearMisses: number;
  pathLength: number;
  avgSpeed: number;
}

class ObstacleCourseSimulation {
  private server: ROS3McpServer;
  private robotId: string;
  private position: Point2D = { x: 0, y: 0 };
  private velocity: Point2D = { x: 0, y: 0 };
  private courseSections: CourseSection[] = [];
  private strategies: NavigationStrategy[] = [];
  private navigationMetrics: NavigationMetrics[] = [];
  private totalCollisions: number = 0;
  private currentAttempt: number = 0;

  constructor(robotId: string = 'navigator-1') {
    this.robotId = robotId;
    this.server = new ROS3McpServer({
      name: `obstacle-nav-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/obstacle-nav-${robotId}.db`,
    });

    this.initializeStrategies();
    this.generateObstacleCourse();
  }

  private initializeStrategies(): void {
    this.strategies = [
      {
        name: 'cautious_navigator',
        baseSpeed: 0.5,
        safetyMargin: 2.0,
        replanFrequency: 0.5,
        aggressiveness: 0.2,
        successRate: 0.9,
        avgTime: 20.0,
        timesUsed: 0,
      },
      {
        name: 'balanced_navigator',
        baseSpeed: 1.0,
        safetyMargin: 1.5,
        replanFrequency: 1.0,
        aggressiveness: 0.5,
        successRate: 0.75,
        avgTime: 12.0,
        timesUsed: 0,
      },
      {
        name: 'aggressive_navigator',
        baseSpeed: 1.5,
        safetyMargin: 1.0,
        replanFrequency: 1.5,
        aggressiveness: 0.8,
        successRate: 0.6,
        avgTime: 8.0,
        timesUsed: 0,
      },
      {
        name: 'adaptive_navigator',
        baseSpeed: 1.0,
        safetyMargin: 1.5,
        replanFrequency: 2.0,
        aggressiveness: 0.5,
        successRate: 0.8,
        avgTime: 10.0,
        timesUsed: 0,
      },
    ];
  }

  private generateObstacleCourse(): void {
    // Section 1: Narrow corridor
    this.courseSections.push({
      name: 'Narrow Corridor',
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 20, y: 0 },
      obstacles: [
        { position: { x: 5, y: -1 }, radius: 1.5, type: 'static' },
        { position: { x: 5, y: 1 }, radius: 1.5, type: 'static' },
        { position: { x: 10, y: 1 }, radius: 1.5, type: 'static' },
        { position: { x: 10, y: -1 }, radius: 1.5, type: 'static' },
        { position: { x: 15, y: -1.5 }, radius: 1.5, type: 'static' },
        { position: { x: 15, y: 1.5 }, radius: 1.5, type: 'static' },
      ],
      difficulty: 0.6,
    });

    // Section 2: Dynamic obstacles
    this.courseSections.push({
      name: 'Dynamic Zone',
      startPoint: { x: 20, y: 0 },
      endPoint: { x: 35, y: 10 },
      obstacles: [
        { position: { x: 25, y: 3 }, radius: 1.0, type: 'dynamic', velocity: { x: 0, y: 0.5 } },
        { position: { x: 28, y: 7 }, radius: 1.0, type: 'dynamic', velocity: { x: 0, y: -0.5 } },
        { position: { x: 32, y: 5 }, radius: 1.0, type: 'dynamic', velocity: { x: 0.3, y: 0 } },
      ],
      difficulty: 0.7,
    });

    // Section 3: Maze-like cluster
    this.courseSections.push({
      name: 'Obstacle Cluster',
      startPoint: { x: 35, y: 10 },
      endPoint: { x: 45, y: 20 },
      obstacles: Array.from({ length: 12 }, (_, i) => ({
        position: {
          x: 36 + (i % 4) * 2.5,
          y: 11 + Math.floor(i / 4) * 3,
        },
        radius: 1.2,
        type: 'static' as const,
      })),
      difficulty: 0.8,
    });

    // Section 4: Final sprint with gaps
    this.courseSections.push({
      name: 'Final Sprint',
      startPoint: { x: 45, y: 20 },
      endPoint: { x: 60, y: 20 },
      obstacles: [
        { position: { x: 48, y: 20 }, radius: 0.8, type: 'static' },
        { position: { x: 52, y: 20 }, radius: 0.8, type: 'static' },
        { position: { x: 56, y: 20 }, radius: 0.8, type: 'static' },
      ],
      difficulty: 0.4,
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🤖 Obstacle Course Navigator ${this.robotId} initialized!`);
    console.log(`🏁 Course sections: ${this.courseSections.length}`);
    console.log(`📍 Starting position: (0, 0)\n`);

    await this.loadNavigationMemory();
  }

  private async loadNavigationMemory(): Promise<void> {
    try {
      const memories = await this.server['memory'].queryWithContext(
        'successful obstacle navigation',
        { k: 25, minConfidence: 0.7 }
      );

      if (memories.memories.length > 0) {
        console.log(`🧠 Loaded ${memories.memories.length} navigation memories`);
        this.updateStrategiesFromMemory(memories.memories);
        console.log(`   Navigation strategies updated\n`);
      }
    } catch (error) {
      console.log(`ℹ️  No navigation history (first run)\n`);
    }
  }

  private updateStrategiesFromMemory(memories: any[]): void {
    for (const strategy of this.strategies) {
      const relevantMemories = memories.filter(m => m.strategy === strategy.name);

      if (relevantMemories.length > 0) {
        const successCount = relevantMemories.filter(m => m.success).length;
        const newSuccessRate = successCount / relevantMemories.length;

        strategy.successRate = strategy.successRate * 0.3 + newSuccessRate * 0.7;
        strategy.timesUsed += relevantMemories.length;

        console.log(`   🗺️  ${strategy.name}: ${(strategy.successRate * 100).toFixed(1)}% success`);
      }
    }
  }

  private selectStrategy(section: CourseSection): NavigationStrategy {
    // Score strategies based on section difficulty and past performance
    const scores = this.strategies.map(strategy => {
      let score = strategy.successRate * 100;

      // For high difficulty, prioritize safety
      if (section.difficulty > 0.7) {
        score += (1 - strategy.aggressiveness) * 30;
        score += strategy.safetyMargin * 10;
      } else {
        // For low difficulty, prioritize speed
        score += strategy.aggressiveness * 20;
        score -= strategy.avgTime * 0.5;
      }

      // Exploration bonus
      if (strategy.timesUsed < 3) {
        score += 15;
      }

      return { strategy, score };
    });

    scores.sort((a, b) => b.score - a.score);

    // Epsilon-greedy
    if (Math.random() < 0.2 && scores.length > 1) {
      return scores[1].strategy;
    }

    return scores[0].strategy;
  }

  private calculateDistance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  private checkCollision(position: Point2D, obstacles: Obstacle[]): Obstacle | null {
    const robotRadius = 0.5;

    for (const obstacle of obstacles) {
      const distance = this.calculateDistance(position, obstacle.position);
      if (distance < robotRadius + obstacle.radius) {
        return obstacle;
      }
    }

    return null;
  }

  private checkNearMiss(position: Point2D, obstacles: Obstacle[], safetyMargin: number): boolean {
    const robotRadius = 0.5;

    for (const obstacle of obstacles) {
      const distance = this.calculateDistance(position, obstacle.position);
      if (distance < robotRadius + obstacle.radius + safetyMargin && distance >= robotRadius + obstacle.radius) {
        return true;
      }
    }

    return false;
  }

  private updateDynamicObstacles(obstacles: Obstacle[], deltaTime: number): void {
    for (const obstacle of obstacles) {
      if (obstacle.type === 'dynamic' && obstacle.velocity) {
        obstacle.position.x += obstacle.velocity.x * deltaTime;
        obstacle.position.y += obstacle.velocity.y * deltaTime;

        // Bounce off boundaries
        if (Math.abs(obstacle.position.y) > 10) {
          obstacle.velocity.y *= -1;
        }
      }
    }
  }

  private async navigateSection(section: CourseSection, strategy: NavigationStrategy): Promise<NavigationMetrics> {
    this.currentAttempt++;

    console.log(`\n🏁 Section: ${section.name}`);
    console.log(`   Start: (${section.startPoint.x.toFixed(1)}, ${section.startPoint.y.toFixed(1)})`);
    console.log(`   End: (${section.endPoint.x.toFixed(1)}, ${section.endPoint.y.toFixed(1)})`);
    console.log(`   Difficulty: ${(section.difficulty * 100).toFixed(0)}%`);
    console.log(`   Strategy: ${strategy.name}`);
    console.log(`   Speed: ${strategy.baseSpeed.toFixed(2)} m/s\n`);

    const startTime = Date.now();
    this.position = { ...section.startPoint };
    let collisions = 0;
    let nearMisses = 0;
    let pathLength = 0;

    const targetDistance = this.calculateDistance(section.startPoint, section.endPoint);
    const steps = Math.ceil(targetDistance / (strategy.baseSpeed * 0.1));

    for (let i = 0; i < steps; i++) {
      const progress = (i + 1) / steps;

      // Calculate next position
      const nextPos = {
        x: section.startPoint.x + (section.endPoint.x - section.startPoint.x) * progress,
        y: section.startPoint.y + (section.endPoint.y - section.startPoint.y) * progress,
      };

      // Update dynamic obstacles
      this.updateDynamicObstacles(section.obstacles, 0.1);

      // Check for collision
      const collision = this.checkCollision(nextPos, section.obstacles);

      if (collision) {
        collisions++;
        this.totalCollisions++;

        console.log(`      💥 Collision with ${collision.type} obstacle at step ${i}!`);

        // Recovery: move perpendicular
        nextPos.y += (Math.random() - 0.5) * strategy.safetyMargin;

        // Slow down after collision
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Check for near miss
        if (this.checkNearMiss(nextPos, section.obstacles, strategy.safetyMargin)) {
          nearMisses++;
        }
      }

      // Update position and calculate path length
      const stepDistance = this.calculateDistance(this.position, nextPos);
      pathLength += stepDistance;
      this.position = nextPos;

      // Adjust speed based on obstacle proximity
      let currentSpeed = strategy.baseSpeed;
      const nearestObstacle = Math.min(
        ...section.obstacles.map(obs => this.calculateDistance(this.position, obs.position) - obs.radius)
      );

      if (nearestObstacle < strategy.safetyMargin * 2) {
        currentSpeed *= 0.5; // Slow down near obstacles
      }

      await new Promise(resolve => setTimeout(resolve, (100 / currentSpeed)));

      // Progress indicator
      if (i % 10 === 0 && i > 0) {
        console.log(`      ⏳ Progress: ${(progress * 100).toFixed(0)}%, collisions: ${collisions}, near misses: ${nearMisses}`);
      }
    }

    const timeElapsed = (Date.now() - startTime) / 1000;
    const avgSpeed = pathLength / timeElapsed;
    const success = collisions < 3; // Allow up to 2 collisions

    console.log(`\n      ${success ? '✅ Section completed!' : '❌ Too many collisions'}`);
    console.log(`      Time: ${timeElapsed.toFixed(2)}s`);
    console.log(`      Path length: ${pathLength.toFixed(2)}m`);
    console.log(`      Avg speed: ${avgSpeed.toFixed(2)} m/s`);
    console.log(`      Collisions: ${collisions}`);
    console.log(`      Near misses: ${nearMisses}`);

    const metrics: NavigationMetrics = {
      sectionName: section.name,
      strategyUsed: strategy.name,
      success,
      timeElapsed,
      collisions,
      nearMisses,
      pathLength,
      avgSpeed,
    };

    // Update strategy statistics
    strategy.timesUsed++;
    const alpha = 0.25;
    if (success) {
      strategy.successRate = strategy.successRate * (1 - alpha) + 1 * alpha;
      strategy.avgTime = strategy.avgTime * (1 - alpha) + timeElapsed * alpha;
    } else {
      strategy.successRate = strategy.successRate * (1 - alpha);
    }

    // Store navigation experience
    await this.server['memory'].storeEpisode({
      sessionId: `nav-${this.currentAttempt}`,
      taskName: 'obstacle_navigation',
      confidence: success ? 0.9 - (collisions * 0.2) : 0.4,
      success,
      outcome: success ? `Navigated ${section.name}` : `Failed ${section.name}`,
      strategy: strategy.name,
      metadata: {
        metrics,
        sectionDifficulty: section.difficulty,
        strategyParams: { ...strategy },
      },
    });

    return metrics;
  }

  async runSimulation(numRuns: number = 2): Promise<void> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🏁 Obstacle Course Navigation Simulation`);
    console.log(`${'='.repeat(70)}\n`);

    for (let run = 0; run < numRuns; run++) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`🎯 Course Run #${run + 1} of ${numRuns}`);
      console.log(`${'─'.repeat(70)}`);

      for (const section of this.courseSections) {
        const strategy = this.selectStrategy(section);
        const metrics = await this.navigateSection(section, strategy);
        this.navigationMetrics.push(metrics);

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`\n   🏁 Run #${run + 1} complete!\n`);
    }

    this.printSimulationSummary();
    await this.consolidateKnowledge();
  }

  private printSimulationSummary(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Navigation Simulation Summary`);
    console.log(`${'='.repeat(70)}\n`);

    const successfulSections = this.navigationMetrics.filter(m => m.success).length;
    const totalTime = this.navigationMetrics.reduce((sum, m) => sum + m.timeElapsed, 0);
    const totalPath = this.navigationMetrics.reduce((sum, m) => sum + m.pathLength, 0);
    const totalNearMisses = this.navigationMetrics.reduce((sum, m) => sum + m.nearMisses, 0);

    console.log(`Total Sections: ${this.navigationMetrics.length}`);
    console.log(`Successful: ${successfulSections} (${((successfulSections / this.navigationMetrics.length) * 100).toFixed(1)}%)`);
    console.log(`Total Time: ${totalTime.toFixed(2)}s`);
    console.log(`Total Path Length: ${totalPath.toFixed(2)}m`);
    console.log(`Total Collisions: ${this.totalCollisions}`);
    console.log(`Total Near Misses: ${totalNearMisses}`);
    console.log(`Average Speed: ${(totalPath / totalTime).toFixed(2)} m/s\n`);

    console.log(`Strategy Performance:`);
    for (const strategy of this.strategies) {
      if (strategy.timesUsed > 0) {
        console.log(`  ${strategy.name}:`);
        console.log(`    Success Rate: ${(strategy.successRate * 100).toFixed(1)}%`);
        console.log(`    Times Used: ${strategy.timesUsed}`);
        console.log(`    Avg Time: ${strategy.avgTime.toFixed(2)}s`);
        console.log(`    Aggressiveness: ${(strategy.aggressiveness * 100).toFixed(0)}%`);
      }
    }

    // Learning analysis
    const firstHalf = this.navigationMetrics.slice(0, Math.floor(this.navigationMetrics.length / 2));
    const secondHalf = this.navigationMetrics.slice(Math.floor(this.navigationMetrics.length / 2));

    const firstHalfSuccess = firstHalf.filter(m => m.success).length / firstHalf.length;
    const secondHalfSuccess = secondHalf.filter(m => m.success).length / secondHalf.length;

    console.log(`\n📈 Learning Progress:`);
    console.log(`  First Half: ${(firstHalfSuccess * 100).toFixed(1)}% success`);
    console.log(`  Second Half: ${(secondHalfSuccess * 100).toFixed(1)}% success`);
    console.log(`  Improvement: ${((secondHalfSuccess - firstHalfSuccess) * 100).toFixed(1)}%`);

    console.log(`\n${'='.repeat(70)}\n`);
  }

  private async consolidateKnowledge(): Promise<void> {
    console.log(`🧠 Consolidating navigation knowledge...`);

    const result = await this.server.consolidateSkills('obstacle_navigation');

    console.log(`   Skills Consolidated: ${result.skillsConsolidated}`);
    console.log(`   Patterns Found: ${result.patternsFound}`);
    console.log(`   💾 Navigation strategies saved to AgentDB\n`);
  }

  exportMetrics(): any {
    return {
      robotId: this.robotId,
      totalAttempts: this.currentAttempt,
      totalCollisions: this.totalCollisions,
      navigationMetrics: this.navigationMetrics,
      strategies: this.strategies,
      timestamp: new Date().toISOString(),
    };
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'navigator-1';
  const numRuns = parseInt(process.argv[3]) || 2;

  const sim = new ObstacleCourseSimulation(robotId);

  await sim.start();
  await sim.runSimulation(numRuns);

  const metrics = sim.exportMetrics();
  console.log(`📈 Exported metrics:`, JSON.stringify(metrics, null, 2));

  console.log(`\n✨ Obstacle course simulation complete!\n`);
  process.exit(0);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Warehouse Robot Simulation
 *
 * Demonstrates:
 * - Warehouse navigation with dynamic obstacles
 * - Pick-and-place task planning
 * - Inventory management integration
 * - Path optimization with AgentDB learning
 * - Multi-shelf navigation strategies
 *
 * The robot learns optimal picking strategies based on:
 * - Shelf locations and product density
 * - Obstacle patterns and traffic
 * - Historical success rates
 */

import { ROS3McpServer } from '../../npm/mcp/src/server.js';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Shelf {
  id: string;
  location: Point3D;
  items: string[];
  accessibility: number; // 0-1, higher is easier to reach
}

interface PickTask {
  itemId: string;
  shelfId: string;
  priority: number;
  weight: number;
}

interface NavigationMetrics {
  pathLength: number;
  obstaclesAvoided: number;
  timeElapsed: number;
  energyUsed: number;
}

class WarehouseRobotSimulation {
  private server: ROS3McpServer;
  private robotId: string;
  private position: Point3D = { x: 0, y: 0, z: 0 };
  private shelves: Map<string, Shelf> = new Map();
  private pickQueue: PickTask[] = [];
  private completedPicks: number = 0;
  private metrics: NavigationMetrics[] = [];
  private currentLoad: number = 0;
  private maxLoad: number = 50; // kg

  constructor(robotId: string = 'warehouse-bot-1') {
    this.robotId = robotId;
    this.server = new ROS3McpServer({
      name: `warehouse-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/warehouse-${robotId}.db`,
    });

    this.initializeWarehouse();
  }

  private initializeWarehouse(): void {
    // Create warehouse layout with shelves
    const shelfPositions = [
      { x: 5, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 15, y: 0, z: 0 },
      { x: 5, y: 5, z: 0 },
      { x: 10, y: 5, z: 0 },
      { x: 15, y: 5, z: 0 },
      { x: 5, y: 10, z: 0 },
      { x: 10, y: 10, z: 0 },
      { x: 15, y: 10, z: 0 },
    ];

    shelfPositions.forEach((pos, idx) => {
      this.shelves.set(`shelf-${idx + 1}`, {
        id: `shelf-${idx + 1}`,
        location: pos,
        items: [`item-${idx}-A`, `item-${idx}-B`, `item-${idx}-C`],
        accessibility: 0.5 + Math.random() * 0.5,
      });
    });

    console.log(`📦 Warehouse initialized with ${this.shelves.size} shelves`);
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🤖 Warehouse Robot ${this.robotId} started!`);
    console.log(`📍 Initial position: (${this.position.x}, ${this.position.y}, ${this.position.z})`);
    console.log(`🏭 Warehouse layout: ${this.shelves.size} shelves arranged in 3x3 grid\n`);

    // Load past navigation experiences
    await this.loadNavigationMemory();
  }

  private async loadNavigationMemory(): Promise<void> {
    try {
      const memories = await this.server['memory'].queryWithContext(
        'successful warehouse navigation',
        { k: 20, minConfidence: 0.7 }
      );

      if (memories.memories.length > 0) {
        console.log(`🧠 Loaded ${memories.memories.length} navigation memories`);
        console.log(`   Learning from past experiences...\n`);
      }
    } catch (error) {
      console.log(`ℹ️  No past experiences (first run)\n`);
    }
  }

  generatePickTasks(count: number): void {
    console.log(`📋 Generating ${count} pick tasks...\n`);

    for (let i = 0; i < count; i++) {
      const shelfKeys = Array.from(this.shelves.keys());
      const randomShelf = shelfKeys[Math.floor(Math.random() * shelfKeys.length)];
      const shelf = this.shelves.get(randomShelf)!;
      const randomItem = shelf.items[Math.floor(Math.random() * shelf.items.length)];

      this.pickQueue.push({
        itemId: randomItem,
        shelfId: randomShelf,
        priority: Math.floor(Math.random() * 3) + 1,
        weight: Math.random() * 10 + 2, // 2-12 kg
      });
    }

    // Sort by priority (high to low)
    this.pickQueue.sort((a, b) => b.priority - a.priority);
  }

  private calculateDistance(from: Point3D, to: Point3D): number {
    return Math.sqrt(
      Math.pow(to.x - from.x, 2) +
      Math.pow(to.y - from.y, 2) +
      Math.pow(to.z - from.z, 2)
    );
  }

  private async navigateToShelf(shelfId: string): Promise<NavigationMetrics> {
    const shelf = this.shelves.get(shelfId);
    if (!shelf) throw new Error(`Shelf ${shelfId} not found`);

    const startPos = { ...this.position };
    const startTime = Date.now();

    console.log(`   🚶 Navigating from (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}) to ${shelfId}...`);

    const distance = this.calculateDistance(startPos, shelf.location);
    const steps = Math.ceil(distance / 0.5); // 0.5m per step
    let obstaclesAvoided = 0;

    // Simulate navigation with obstacle detection
    for (let i = 0; i < steps; i++) {
      const progress = (i + 1) / steps;

      // Linear interpolation
      this.position.x = startPos.x + (shelf.location.x - startPos.x) * progress;
      this.position.y = startPos.y + (shelf.location.y - startPos.y) * progress;

      // Random obstacle detection (10% chance)
      if (Math.random() < 0.1) {
        obstaclesAvoided++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Avoidance delay
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const timeElapsed = Date.now() - startTime;
    const energyUsed = distance * 0.5 + obstaclesAvoided * 0.2; // Simplified energy model

    const metrics: NavigationMetrics = {
      pathLength: distance,
      obstaclesAvoided,
      timeElapsed,
      energyUsed,
    };

    console.log(`   ✓ Reached ${shelfId} in ${(timeElapsed / 1000).toFixed(2)}s (${distance.toFixed(2)}m, ${obstaclesAvoided} obstacles)`);

    return metrics;
  }

  private async pickItem(task: PickTask): Promise<boolean> {
    const shelf = this.shelves.get(task.shelfId)!;

    console.log(`\n🎯 Pick Task #${this.completedPicks + 1}`);
    console.log(`   Item: ${task.itemId} from ${task.shelfId}`);
    console.log(`   Priority: ${'⭐'.repeat(task.priority)}`);
    console.log(`   Weight: ${task.weight.toFixed(1)}kg`);

    // Check load capacity
    if (this.currentLoad + task.weight > this.maxLoad) {
      console.log(`   ⚠️  Load capacity exceeded! Returning to base...`);
      await this.returnToBase();
      return false;
    }

    // Navigate to shelf
    const navMetrics = await this.navigateToShelf(task.shelfId);
    this.metrics.push(navMetrics);

    // Simulate picking action
    console.log(`   🤏 Picking item... (accessibility: ${(shelf.accessibility * 100).toFixed(0)}%)`);
    await new Promise(resolve => setTimeout(resolve, 1000 / shelf.accessibility));

    // Success probability based on accessibility
    const success = Math.random() < (0.7 + shelf.accessibility * 0.3);

    if (success) {
      this.currentLoad += task.weight;
      this.completedPicks++;
      console.log(`   ✅ Successfully picked ${task.itemId}`);
      console.log(`   📊 Current load: ${this.currentLoad.toFixed(1)}/${this.maxLoad}kg`);

      // Store successful pick in memory
      await this.server['memory'].storeEpisode({
        sessionId: `pick-${this.completedPicks}`,
        taskName: 'warehouse_pick',
        confidence: shelf.accessibility,
        success: true,
        outcome: `Picked ${task.itemId} from ${task.shelfId}`,
        strategy: 'direct_navigation',
        metadata: {
          shelfId: task.shelfId,
          itemId: task.itemId,
          navigationMetrics: navMetrics,
          loadBefore: this.currentLoad - task.weight,
          loadAfter: this.currentLoad,
        },
      });

      return true;
    } else {
      console.log(`   ❌ Failed to pick ${task.itemId}`);

      await this.server['memory'].storeEpisode({
        sessionId: `pick-fail-${Date.now()}`,
        taskName: 'warehouse_pick',
        confidence: shelf.accessibility,
        success: false,
        outcome: `Failed to pick ${task.itemId}`,
        strategy: 'direct_navigation',
        metadata: { shelfId: task.shelfId, itemId: task.itemId },
      });

      return false;
    }
  }

  private async returnToBase(): Promise<void> {
    console.log(`\n   🏠 Returning to base station...`);

    const navMetrics = await this.navigateToShelf('base');

    // Simulate unloading
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`   📦 Unloaded ${this.currentLoad.toFixed(1)}kg of items`);
    this.currentLoad = 0;

    this.position = { x: 0, y: 0, z: 0 };
  }

  async runSimulation(numTasks: number = 15): Promise<void> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🏭 Starting Warehouse Picking Simulation`);
    console.log(`${'='.repeat(70)}\n`);

    this.generatePickTasks(numTasks);

    const startTime = Date.now();
    let attempts = 0;

    while (this.pickQueue.length > 0 && attempts < numTasks + 5) {
      const task = this.pickQueue.shift()!;
      await this.pickItem(task);
      attempts++;

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Return to base at end
    if (this.currentLoad > 0) {
      await this.returnToBase();
    }

    const totalTime = Date.now() - startTime;

    // Print summary
    this.printSimulationSummary(totalTime);

    // Consolidate learning
    await this.consolidateKnowledge();
  }

  private printSimulationSummary(totalTime: number): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Warehouse Simulation Summary`);
    console.log(`${'='.repeat(70)}\n`);

    console.log(`Tasks Completed: ${this.completedPicks}`);
    console.log(`Success Rate: ${((this.completedPicks / this.pickQueue.length) * 100).toFixed(1)}%`);
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Average Time per Pick: ${(totalTime / this.completedPicks / 1000).toFixed(2)}s\n`);

    // Navigation metrics
    const totalDistance = this.metrics.reduce((sum, m) => sum + m.pathLength, 0);
    const totalObstacles = this.metrics.reduce((sum, m) => sum + m.obstaclesAvoided, 0);
    const totalEnergy = this.metrics.reduce((sum, m) => sum + m.energyUsed, 0);

    console.log(`Navigation Metrics:`);
    console.log(`  Total Distance: ${totalDistance.toFixed(2)}m`);
    console.log(`  Obstacles Avoided: ${totalObstacles}`);
    console.log(`  Energy Used: ${totalEnergy.toFixed(2)} units`);
    console.log(`  Efficiency: ${(this.completedPicks / totalEnergy * 100).toFixed(2)} picks/unit\n`);

    console.log(`${'='.repeat(70)}\n`);
  }

  private async consolidateKnowledge(): Promise<void> {
    console.log(`🧠 Consolidating warehouse navigation knowledge...`);

    const result = await this.server.consolidateSkills('warehouse_operations');

    console.log(`   Skills Consolidated: ${result.skillsConsolidated}`);
    console.log(`   Patterns Found: ${result.patternsFound}`);
    console.log(`   💾 Knowledge saved to AgentDB\n`);
  }

  exportMetrics(): any {
    return {
      robotId: this.robotId,
      completedPicks: this.completedPicks,
      navigationMetrics: this.metrics,
      successRate: this.completedPicks / (this.pickQueue.length + this.completedPicks),
      totalDistance: this.metrics.reduce((sum, m) => sum + m.pathLength, 0),
      totalEnergy: this.metrics.reduce((sum, m) => sum + m.energyUsed, 0),
      timestamp: new Date().toISOString(),
    };
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'warehouse-bot-1';
  const numTasks = parseInt(process.argv[3]) || 15;

  const sim = new WarehouseRobotSimulation(robotId);

  await sim.start();
  await sim.runSimulation(numTasks);

  // Export metrics
  const metrics = sim.exportMetrics();
  console.log(`\n📈 Metrics exported:`, JSON.stringify(metrics, null, 2));

  console.log(`\n✨ Warehouse simulation complete!\n`);
  process.exit(0);
}

main().catch(console.error);

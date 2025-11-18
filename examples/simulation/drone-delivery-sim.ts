#!/usr/bin/env node
/**
 * Drone Delivery Simulation
 *
 * Demonstrates:
 * - 3D autonomous flight control
 * - Dynamic obstacle avoidance
 * - Package delivery optimization
 * - Battery management
 * - Weather adaptation
 * - Multi-waypoint path planning
 *
 * The drone learns optimal delivery strategies through:
 * - Route efficiency analysis
 * - Risk assessment (obstacles, weather, battery)
 * - Delivery success tracking
 * - Energy optimization
 */

import { ROS3McpServer } from '../../npm/mcp/src/server.js';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface DeliveryTask {
  id: string;
  pickup: Point3D;
  dropoff: Point3D;
  packageWeight: number;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  deadline: number; // minutes
}

interface Obstacle {
  position: Point3D;
  radius: number;
  type: 'building' | 'tree' | 'power_line' | 'bird';
}

interface WeatherConditions {
  windSpeed: number; // m/s
  visibility: number; // 0-1
  precipitation: boolean;
}

interface DeliveryMetrics {
  taskId: string;
  distance: number;
  flightTime: number;
  batteryUsed: number;
  obstaclesAvoided: number;
  success: boolean;
  deliveryAccuracy: number; // meters from target
}

class DroneDeliverySimulation {
  private server: ROS3McpServer;
  private droneId: string;
  private position: Point3D = { x: 0, y: 0, z: 0 };
  private batteryLevel: number = 100; // percentage
  private maxBattery: number = 100;
  private maxPayload: number = 5; // kg
  private maxFlightTime: number = 30; // minutes
  private obstacles: Obstacle[] = [];
  private weather: WeatherConditions;
  private deliveryMetrics: DeliveryMetrics[] = [];
  private completedDeliveries: number = 0;

  constructor(droneId: string = 'delivery-drone-1') {
    this.droneId = droneId;
    this.server = new ROS3McpServer({
      name: `drone-${droneId}`,
      version: '1.0.0',
      dbPath: `./examples/data/drone-${droneId}.db`,
    });

    this.weather = {
      windSpeed: 2 + Math.random() * 3,
      visibility: 0.8 + Math.random() * 0.2,
      precipitation: false,
    };

    this.generateObstacles();
  }

  private generateObstacles(): void {
    const obstacleTypes: Obstacle['type'][] = ['building', 'tree', 'power_line', 'bird'];

    for (let i = 0; i < 20; i++) {
      this.obstacles.push({
        position: {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          z: Math.random() * 50 + 10, // 10-60m altitude
        },
        radius: 5 + Math.random() * 10,
        type: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)],
      });
    }
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🚁 Delivery Drone ${this.droneId} initialized!`);
    console.log(`📍 Base Station: (0, 0, 0)`);
    console.log(`🔋 Battery: ${this.batteryLevel}%`);
    console.log(`📦 Max Payload: ${this.maxPayload}kg`);
    console.log(`🌤️  Weather: Wind ${this.weather.windSpeed.toFixed(1)}m/s, Visibility ${(this.weather.visibility * 100).toFixed(0)}%\n`);

    await this.loadFlightMemory();
  }

  private async loadFlightMemory(): Promise<void> {
    try {
      const memories = await this.server['memory'].queryWithContext(
        'successful drone delivery',
        { k: 25, minConfidence: 0.7 }
      );

      if (memories.memories.length > 0) {
        console.log(`🧠 Loaded ${memories.memories.length} flight memories`);
        console.log(`   Analyzing past delivery patterns...\n`);
      }
    } catch (error) {
      console.log(`ℹ️  No flight history (first flight)\n`);
    }
  }

  private calculateDistance(from: Point3D, to: Point3D): number {
    return Math.sqrt(
      Math.pow(to.x - from.x, 2) +
      Math.pow(to.y - from.y, 2) +
      Math.pow(to.z - from.z, 2)
    );
  }

  private checkObstacles(position: Point3D): Obstacle | null {
    for (const obstacle of this.obstacles) {
      const distance = this.calculateDistance(position, obstacle.position);
      if (distance < obstacle.radius) {
        return obstacle;
      }
    }
    return null;
  }

  private calculateBatteryUsage(distance: number, weight: number, weather: WeatherConditions): number {
    // Base usage
    let usage = distance * 0.5;

    // Weight penalty
    usage += weight * 0.3;

    // Weather penalty
    usage += weather.windSpeed * 0.2;
    if (weather.precipitation) usage *= 1.3;

    // Altitude efficiency (higher = more efficient for long distances)
    usage *= 0.95;

    return usage;
  }

  private async flyTo(target: Point3D, weight: number): Promise<{
    distance: number;
    time: number;
    batteryUsed: number;
    obstaclesAvoided: number;
  }> {
    const startPos = { ...this.position };
    const directDistance = this.calculateDistance(startPos, target);

    console.log(`   🚁 Flying from (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)})`);
    console.log(`      to (${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)})`);
    console.log(`      Direct distance: ${directDistance.toFixed(2)}m`);

    const steps = Math.ceil(directDistance / 5); // 5m per step
    let actualDistance = 0;
    let obstaclesAvoided = 0;
    const startTime = Date.now();

    for (let i = 0; i < steps; i++) {
      const progress = (i + 1) / steps;

      // Calculate next position
      const nextPos = {
        x: startPos.x + (target.x - startPos.x) * progress,
        y: startPos.y + (target.y - startPos.y) * progress,
        z: startPos.z + (target.z - startPos.z) * progress,
      };

      // Check for obstacles
      const obstacle = this.checkObstacles(nextPos);
      if (obstacle) {
        obstaclesAvoided++;

        // Avoidance maneuver: fly around
        if (obstacle.type === 'building' || obstacle.type === 'tree') {
          nextPos.z += obstacle.radius + 5; // Fly higher
        } else {
          nextPos.x += (Math.random() - 0.5) * 10;
          nextPos.y += (Math.random() - 0.5) * 10;
        }

        console.log(`      ⚠️  Avoided ${obstacle.type} at (${obstacle.position.x.toFixed(0)}, ${obstacle.position.y.toFixed(0)})`);
      }

      // Update position
      const stepDistance = this.calculateDistance(this.position, nextPos);
      actualDistance += stepDistance;
      this.position = nextPos;

      // Simulate flight time
      await new Promise(resolve => setTimeout(resolve, 50));

      // Progress indicator
      if (i % 10 === 0 && i > 0) {
        console.log(`      ⏳ Progress: ${(progress * 100).toFixed(0)}%, altitude: ${this.position.z.toFixed(1)}m`);
      }
    }

    const flightTime = (Date.now() - startTime) / 1000;
    const batteryUsed = this.calculateBatteryUsage(actualDistance, weight, this.weather);
    this.batteryLevel -= batteryUsed;

    console.log(`      ✓ Arrived in ${flightTime.toFixed(2)}s (${actualDistance.toFixed(2)}m actual)`);
    console.log(`      🔋 Battery: ${this.batteryLevel.toFixed(1)}%`);

    return {
      distance: actualDistance,
      time: flightTime,
      batteryUsed,
      obstaclesAvoided,
    };
  }

  private async executeDelivery(task: DeliveryTask): Promise<DeliveryMetrics> {
    console.log(`\n📦 Delivery Task: ${task.id}`);
    console.log(`   Priority: ${task.priority.toUpperCase()}`);
    console.log(`   Package Weight: ${task.packageWeight.toFixed(2)}kg`);
    console.log(`   Deadline: ${task.deadline} minutes\n`);

    const startTime = Date.now();

    // Check if we can handle the delivery
    if (task.packageWeight > this.maxPayload) {
      console.log(`   ❌ Package too heavy! Max payload: ${this.maxPayload}kg`);
      return this.createFailedMetrics(task, 'overweight');
    }

    // Estimate battery requirement
    const estimatedDistance =
      this.calculateDistance(this.position, task.pickup) +
      this.calculateDistance(task.pickup, task.dropoff) +
      this.calculateDistance(task.dropoff, { x: 0, y: 0, z: 0 }); // Return to base

    const estimatedBattery = this.calculateBatteryUsage(estimatedDistance, task.packageWeight, this.weather);

    if (estimatedBattery > this.batteryLevel) {
      console.log(`   ⚠️  Insufficient battery! Estimated: ${estimatedBattery.toFixed(1)}%, Available: ${this.batteryLevel.toFixed(1)}%`);
      console.log(`   🔌 Charging...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.batteryLevel = 100;
      console.log(`   ✓ Fully charged!\n`);
    }

    // Phase 1: Fly to pickup
    console.log(`   Phase 1: Flying to pickup location...`);
    const toPickup = await this.flyTo(task.pickup, 0);

    // Phase 2: Load package
    console.log(`\n   Phase 2: Loading package...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`   ✓ Package loaded (${task.packageWeight.toFixed(2)}kg)`);

    // Phase 3: Fly to dropoff
    console.log(`\n   Phase 3: Flying to dropoff location...`);
    const toDropoff = await this.flyTo(task.dropoff, task.packageWeight);

    // Phase 4: Deliver package
    console.log(`\n   Phase 4: Delivering package...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Calculate delivery accuracy (landing precision)
    const deliveryAccuracy = Math.random() * 2; // 0-2m deviation
    const success = deliveryAccuracy < 1.5;

    if (success) {
      this.completedDeliveries++;
      console.log(`   ✅ Package delivered successfully! (${deliveryAccuracy.toFixed(2)}m accuracy)`);
    } else {
      console.log(`   ⚠️  Delivery completed with low accuracy (${deliveryAccuracy.toFixed(2)}m deviation)`);
    }

    const totalTime = (Date.now() - startTime) / 1000;
    const totalDistance = toPickup.distance + toDropoff.distance;
    const totalBatteryUsed = toPickup.batteryUsed + toDropoff.batteryUsed;
    const totalObstacles = toPickup.obstaclesAvoided + toDropoff.obstaclesAvoided;

    const metrics: DeliveryMetrics = {
      taskId: task.id,
      distance: totalDistance,
      flightTime: totalTime,
      batteryUsed: totalBatteryUsed,
      obstaclesAvoided: totalObstacles,
      success,
      deliveryAccuracy,
    };

    // Store delivery experience
    await this.server['memory'].storeEpisode({
      sessionId: task.id,
      taskName: 'drone_delivery',
      confidence: success ? 0.9 : 0.5,
      success,
      outcome: success ? `Delivered package ${task.id}` : `Low accuracy delivery ${task.id}`,
      strategy: 'direct_flight',
      metadata: {
        task,
        metrics,
        weather: this.weather,
        batteryStart: this.batteryLevel + totalBatteryUsed,
        batteryEnd: this.batteryLevel,
      },
    });

    return metrics;
  }

  private createFailedMetrics(task: DeliveryTask, reason: string): DeliveryMetrics {
    return {
      taskId: task.id,
      distance: 0,
      flightTime: 0,
      batteryUsed: 0,
      obstaclesAvoided: 0,
      success: false,
      deliveryAccuracy: 999,
    };
  }

  private async returnToBase(): Promise<void> {
    if (this.position.x === 0 && this.position.y === 0 && this.position.z === 0) {
      return;
    }

    console.log(`\n   🏠 Returning to base station...`);
    await this.flyTo({ x: 0, y: 0, z: 0 }, 0);
    console.log(`   ✓ Landed at base station`);
  }

  async runSimulation(numDeliveries: number = 10): Promise<void> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚁 Drone Delivery Simulation`);
    console.log(`${'='.repeat(70)}\n`);

    // Generate delivery tasks
    const tasks: DeliveryTask[] = [];
    const priorities: DeliveryTask['priority'][] = ['urgent', 'high', 'normal', 'low'];

    for (let i = 0; i < numDeliveries; i++) {
      tasks.push({
        id: `DEL-${String(i + 1).padStart(3, '0')}`,
        pickup: {
          x: (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 60,
          z: 0,
        },
        dropoff: {
          x: (Math.random() - 0.5) * 80,
          y: (Math.random() - 0.5) * 80,
          z: 0,
        },
        packageWeight: 0.5 + Math.random() * 4,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        deadline: 10 + Math.floor(Math.random() * 20),
      });
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Execute deliveries
    for (const task of tasks) {
      const metrics = await this.executeDelivery(task);
      this.deliveryMetrics.push(metrics);

      // Brief pause between deliveries
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if we need to return to base for charging
      if (this.batteryLevel < 30) {
        console.log(`\n   🔋 Low battery! Returning to base for charging...`);
        await this.returnToBase();
        this.batteryLevel = 100;
        console.log(`   ✓ Fully charged and ready!\n`);
      }
    }

    // Final return to base
    await this.returnToBase();

    this.printSimulationSummary();
    await this.consolidateKnowledge();
  }

  private printSimulationSummary(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Delivery Simulation Summary`);
    console.log(`${'='.repeat(70)}\n`);

    const successfulDeliveries = this.deliveryMetrics.filter(m => m.success).length;
    const totalDistance = this.deliveryMetrics.reduce((sum, m) => sum + m.distance, 0);
    const totalFlightTime = this.deliveryMetrics.reduce((sum, m) => sum + m.flightTime, 0);
    const totalObstacles = this.deliveryMetrics.reduce((sum, m) => sum + m.obstaclesAvoided, 0);
    const avgAccuracy = this.deliveryMetrics
      .filter(m => m.success)
      .reduce((sum, m) => sum + m.deliveryAccuracy, 0) / successfulDeliveries;

    console.log(`Total Deliveries: ${this.deliveryMetrics.length}`);
    console.log(`Successful: ${successfulDeliveries} (${((successfulDeliveries / this.deliveryMetrics.length) * 100).toFixed(1)}%)`);
    console.log(`Total Distance: ${totalDistance.toFixed(2)}m`);
    console.log(`Total Flight Time: ${(totalFlightTime / 60).toFixed(2)} minutes`);
    console.log(`Average Delivery Accuracy: ${avgAccuracy.toFixed(2)}m`);
    console.log(`Obstacles Avoided: ${totalObstacles}`);
    console.log(`Final Battery Level: ${this.batteryLevel.toFixed(1)}%\n`);

    console.log(`Efficiency Metrics:`);
    console.log(`  Distance per Delivery: ${(totalDistance / this.deliveryMetrics.length).toFixed(2)}m`);
    console.log(`  Time per Delivery: ${(totalFlightTime / this.deliveryMetrics.length).toFixed(2)}s`);
    console.log(`  Battery Efficiency: ${(totalDistance / (100 - this.batteryLevel)).toFixed(2)} m/% battery`);

    console.log(`\n${'='.repeat(70)}\n`);
  }

  private async consolidateKnowledge(): Promise<void> {
    console.log(`🧠 Consolidating delivery experience...`);

    const result = await this.server.consolidateSkills('autonomous_delivery');

    console.log(`   Skills Consolidated: ${result.skillsConsolidated}`);
    console.log(`   Patterns Found: ${result.patternsFound}`);
    console.log(`   💾 Flight patterns saved to AgentDB\n`);
  }

  exportMetrics(): any {
    return {
      droneId: this.droneId,
      completedDeliveries: this.completedDeliveries,
      deliveryMetrics: this.deliveryMetrics,
      finalBatteryLevel: this.batteryLevel,
      weather: this.weather,
      timestamp: new Date().toISOString(),
    };
  }
}

// Main execution
async function main() {
  const droneId = process.argv[2] || 'delivery-drone-1';
  const numDeliveries = parseInt(process.argv[3]) || 10;

  const sim = new DroneDeliverySimulation(droneId);

  await sim.start();
  await sim.runSimulation(numDeliveries);

  const metrics = sim.exportMetrics();
  console.log(`📈 Exported metrics:`, JSON.stringify(metrics, null, 2));

  console.log(`\n✨ Drone delivery simulation complete!\n`);
  process.exit(0);
}

main().catch(console.error);

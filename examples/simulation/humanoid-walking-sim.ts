#!/usr/bin/env node
/**
 * Humanoid Walking Simulation
 *
 * Demonstrates:
 * - Bipedal locomotion with balance control
 * - Gait pattern learning and optimization
 * - Dynamic stability maintenance
 * - Terrain adaptation
 * - Fall detection and recovery
 *
 * The robot learns optimal walking gaits through:
 * - Reinforcement learning from success/failure
 * - Balance feedback and correction
 * - Energy efficiency optimization
 * - Terrain-specific gait adaptation
 */

import { ROS3McpServer } from '../../npm/mcp/src/server.js';

interface JointState {
  hip: number;
  knee: number;
  ankle: number;
}

interface LegState {
  left: JointState;
  right: JointState;
}

interface GaitPattern {
  name: string;
  strideLength: number;
  strideFrequency: number;
  hipSwing: number;
  kneeFlexion: number;
  stability: number;
  energyEfficiency: number;
  successRate: number;
  timesUsed: number;
}

interface WalkingMetrics {
  distance: number;
  steps: number;
  falls: number;
  energyUsed: number;
  averageSpeed: number;
  stabilityScore: number;
}

class HumanoidWalkingSimulation {
  private server: ROS3McpServer;
  private robotId: string;
  private position: number = 0; // 1D for simplicity
  private legState: LegState;
  private centerOfMass: { x: number; y: number } = { x: 0, y: 1.0 }; // Height 1m
  private isBalanced: boolean = true;
  private gaits: GaitPattern[] = [];
  private walkingMetrics: WalkingMetrics[] = [];
  private totalSteps: number = 0;
  private totalFalls: number = 0;

  constructor(robotId: string = 'humanoid-1') {
    this.robotId = robotId;
    this.server = new ROS3McpServer({
      name: `humanoid-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/humanoid-${robotId}.db`,
    });

    this.legState = {
      left: { hip: 0, knee: 0, ankle: 0 },
      right: { hip: 0, knee: 0, ankle: 0 },
    };

    this.initializeGaits();
  }

  private initializeGaits(): void {
    this.gaits = [
      {
        name: 'cautious_walk',
        strideLength: 0.3,
        strideFrequency: 1.0,
        hipSwing: 0.2,
        kneeFlexion: 0.3,
        stability: 0.9,
        energyEfficiency: 0.5,
        successRate: 0.85,
        timesUsed: 0,
      },
      {
        name: 'normal_walk',
        strideLength: 0.5,
        strideFrequency: 1.5,
        hipSwing: 0.35,
        kneeFlexion: 0.5,
        stability: 0.75,
        energyEfficiency: 0.8,
        successRate: 0.7,
        timesUsed: 0,
      },
      {
        name: 'fast_walk',
        strideLength: 0.7,
        strideFrequency: 2.0,
        hipSwing: 0.5,
        kneeFlexion: 0.7,
        stability: 0.6,
        energyEfficiency: 0.7,
        successRate: 0.5,
        timesUsed: 0,
      },
      {
        name: 'dynamic_balance',
        strideLength: 0.4,
        strideFrequency: 1.2,
        hipSwing: 0.3,
        kneeFlexion: 0.4,
        stability: 0.85,
        energyEfficiency: 0.75,
        successRate: 0.75,
        timesUsed: 0,
      },
    ];
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🤖 Humanoid Robot ${this.robotId} initialized!`);
    console.log(`🦿 Bipedal locomotion system online`);
    console.log(`⚖️  Balance control active\n`);

    await this.loadWalkingMemory();
  }

  private async loadWalkingMemory(): Promise<void> {
    try {
      const memories = await this.server['memory'].queryWithContext(
        'successful walking patterns',
        { k: 30, minConfidence: 0.6 }
      );

      if (memories.memories.length > 0) {
        console.log(`🧠 Loaded ${memories.memories.length} walking memories`);
        this.updateGaitsFromMemory(memories.memories);
        console.log(`   Gait patterns updated from experience\n`);
      }
    } catch (error) {
      console.log(`ℹ️  No walking history (first activation)\n`);
    }
  }

  private updateGaitsFromMemory(memories: any[]): void {
    for (const gait of this.gaits) {
      const relevantMemories = memories.filter(m => m.strategy === gait.name);

      if (relevantMemories.length > 0) {
        const successCount = relevantMemories.filter(m => m.success).length;
        const newSuccessRate = successCount / relevantMemories.length;

        // Update with learning rate
        gait.successRate = gait.successRate * 0.3 + newSuccessRate * 0.7;
        gait.timesUsed += relevantMemories.length;

        console.log(`   🦿 ${gait.name}: ${(gait.successRate * 100).toFixed(1)}% success`);
      }
    }
  }

  private selectGait(terrainDifficulty: number): GaitPattern {
    // Score gaits based on terrain and performance
    const scores = this.gaits.map(gait => {
      let score = gait.successRate * 100;

      // Prioritize stability on difficult terrain
      if (terrainDifficulty > 0.5) {
        score += gait.stability * 30;
      } else {
        score += gait.energyEfficiency * 20;
      }

      // Exploration bonus
      if (gait.timesUsed < 5) {
        score += 10;
      }

      return { gait, score };
    });

    scores.sort((a, b) => b.score - a.score);

    // Epsilon-greedy exploration
    if (Math.random() < 0.15 && scores.length > 1) {
      return scores[1].gait;
    }

    return scores[0].gait;
  }

  private checkBalance(gait: GaitPattern): boolean {
    // Simplified balance model
    const comStability = Math.random();
    const threshold = gait.stability;

    return comStability > (1 - threshold);
  }

  private async executeStep(gait: GaitPattern, stepNumber: number): Promise<boolean> {
    // Update leg states for this step
    const phase = stepNumber % 2; // 0 = left stance, 1 = right stance

    if (phase === 0) {
      this.legState.left = {
        hip: 0,
        knee: gait.kneeFlexion * 30,
        ankle: 10,
      };
      this.legState.right = {
        hip: gait.hipSwing * 45,
        knee: gait.kneeFlexion * 60,
        ankle: -10,
      };
    } else {
      this.legState.right = {
        hip: 0,
        knee: gait.kneeFlexion * 30,
        ankle: 10,
      };
      this.legState.left = {
        hip: gait.hipSwing * 45,
        knee: gait.kneeFlexion * 60,
        ankle: -10,
      };
    }

    // Check balance
    this.isBalanced = this.checkBalance(gait);

    if (!this.isBalanced) {
      console.log(`      ⚠️  Balance lost at step ${stepNumber}!`);
      return false;
    }

    // Update position
    this.position += gait.strideLength;
    this.totalSteps++;

    // Simulate step time
    await new Promise(resolve => setTimeout(resolve, 1000 / gait.strideFrequency));

    return true;
  }

  private async recoverFromFall(): Promise<void> {
    console.log(`      🤕 Fall detected! Initiating recovery sequence...`);
    this.totalFalls++;

    // Recovery takes time
    await new Promise(resolve => setTimeout(resolve, 2000));

    this.isBalanced = true;
    this.centerOfMass = { x: 0, y: 1.0 };
    console.log(`      ✓ Recovery complete. Standing upright.`);
  }

  private async walkDistance(distance: number, terrainDifficulty: number): Promise<WalkingMetrics> {
    const gait = this.selectGait(terrainDifficulty);

    console.log(`\n🚶 Walking Session`);
    console.log(`   Target Distance: ${distance.toFixed(1)}m`);
    console.log(`   Terrain Difficulty: ${(terrainDifficulty * 100).toFixed(0)}%`);
    console.log(`   Selected Gait: ${gait.name}`);
    console.log(`   Expected Success: ${(gait.successRate * 100).toFixed(1)}%\n`);

    const startPos = this.position;
    const startTime = Date.now();
    const startSteps = this.totalSteps;
    const startFalls = this.totalFalls;

    let currentDistance = 0;
    let stepCount = 0;
    let falls = 0;
    let energyUsed = 0;

    while (currentDistance < distance) {
      stepCount++;

      // Visualize progress
      if (stepCount % 5 === 0) {
        const progress = (currentDistance / distance) * 100;
        console.log(`   🦿 Step ${stepCount}: ${currentDistance.toFixed(2)}m / ${distance.toFixed(1)}m (${progress.toFixed(0)}%)`);
      }

      const success = await this.executeStep(gait, stepCount);

      if (!success) {
        falls++;
        await this.recoverFromFall();

        // Learn from fall
        await this.server['memory'].storeEpisode({
          sessionId: `fall-${Date.now()}`,
          taskName: 'walking',
          confidence: gait.stability,
          success: false,
          outcome: `Fall during ${gait.name}`,
          strategy: gait.name,
          metadata: {
            terrainDifficulty,
            stepNumber: stepCount,
            distanceCovered: currentDistance,
          },
        });

        // Adapt: switch to more stable gait after fall
        if (falls > 2) {
          console.log(`\n   ⚡ Adaptive response: Switching to more stable gait`);
          const stableGait = this.gaits.find(g => g.name === 'cautious_walk')!;
          Object.assign(gait, stableGait);
        }
      }

      currentDistance = this.position - startPos;
      energyUsed += gait.strideLength * (2 - gait.energyEfficiency);

      // Random terrain variation
      if (Math.random() < 0.1) {
        terrainDifficulty = Math.min(1.0, terrainDifficulty + (Math.random() - 0.5) * 0.2);
      }
    }

    const timeElapsed = Date.now() - startTime;
    const averageSpeed = distance / (timeElapsed / 1000);
    const stabilityScore = 1 - (falls / stepCount);

    const metrics: WalkingMetrics = {
      distance,
      steps: stepCount,
      falls,
      energyUsed,
      averageSpeed,
      stabilityScore,
    };

    console.log(`\n   ✅ Walking session complete!`);
    console.log(`      Distance: ${distance.toFixed(2)}m in ${stepCount} steps`);
    console.log(`      Falls: ${falls}`);
    console.log(`      Stability: ${(stabilityScore * 100).toFixed(1)}%`);
    console.log(`      Energy: ${energyUsed.toFixed(2)} units`);
    console.log(`      Speed: ${averageSpeed.toFixed(2)} m/s`);

    // Store successful walking experience
    gait.timesUsed++;
    const wasSuccessful = falls < 3;

    if (wasSuccessful) {
      const alpha = 0.2;
      gait.successRate = gait.successRate * (1 - alpha) + (stabilityScore) * alpha;
    }

    await this.server['memory'].storeEpisode({
      sessionId: `walk-${Date.now()}`,
      taskName: 'walking',
      confidence: stabilityScore,
      success: wasSuccessful,
      outcome: `Walked ${distance.toFixed(2)}m with ${gait.name}`,
      strategy: gait.name,
      metadata: {
        metrics,
        gaitParameters: { ...gait },
        terrainDifficulty,
      },
    });

    return metrics;
  }

  async runSimulation(numSessions: number = 8): Promise<void> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🦿 Humanoid Walking Simulation - Learning Bipedal Locomotion`);
    console.log(`${'='.repeat(70)}\n`);

    const distances = [5, 10, 8, 15, 12, 20, 18, 25];
    const terrainDifficulties = [0.2, 0.3, 0.5, 0.4, 0.6, 0.5, 0.7, 0.6];

    for (let i = 0; i < Math.min(numSessions, distances.length); i++) {
      const metrics = await this.walkDistance(distances[i], terrainDifficulties[i]);
      this.walkingMetrics.push(metrics);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.printSimulationSummary();
    await this.consolidateKnowledge();
  }

  private printSimulationSummary(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Walking Simulation Summary`);
    console.log(`${'='.repeat(70)}\n`);

    const totalDistance = this.walkingMetrics.reduce((sum, m) => sum + m.distance, 0);
    const totalEnergy = this.walkingMetrics.reduce((sum, m) => sum + m.energyUsed, 0);
    const avgStability = this.walkingMetrics.reduce((sum, m) => sum + m.stabilityScore, 0) / this.walkingMetrics.length;

    console.log(`Total Distance Walked: ${totalDistance.toFixed(2)}m`);
    console.log(`Total Steps: ${this.totalSteps}`);
    console.log(`Total Falls: ${this.totalFalls}`);
    console.log(`Average Stability: ${(avgStability * 100).toFixed(1)}%`);
    console.log(`Energy Efficiency: ${(totalDistance / totalEnergy).toFixed(2)} m/unit\n`);

    console.log(`Gait Performance:`);
    for (const gait of this.gaits) {
      if (gait.timesUsed > 0) {
        console.log(`  ${gait.name}:`);
        console.log(`    Success Rate: ${(gait.successRate * 100).toFixed(1)}%`);
        console.log(`    Times Used: ${gait.timesUsed}`);
        console.log(`    Stability: ${(gait.stability * 100).toFixed(0)}%`);
      }
    }

    // Learning curve
    const firstHalf = this.walkingMetrics.slice(0, Math.floor(this.walkingMetrics.length / 2));
    const secondHalf = this.walkingMetrics.slice(Math.floor(this.walkingMetrics.length / 2));

    const firstHalfStability = firstHalf.reduce((sum, m) => sum + m.stabilityScore, 0) / firstHalf.length;
    const secondHalfStability = secondHalf.reduce((sum, m) => sum + m.stabilityScore, 0) / secondHalf.length;

    console.log(`\n📈 Learning Progress:`);
    console.log(`  Early Sessions: ${(firstHalfStability * 100).toFixed(1)}% stability`);
    console.log(`  Later Sessions: ${(secondHalfStability * 100).toFixed(1)}% stability`);
    console.log(`  Improvement: ${((secondHalfStability - firstHalfStability) * 100).toFixed(1)}%`);

    console.log(`\n${'='.repeat(70)}\n`);
  }

  private async consolidateKnowledge(): Promise<void> {
    console.log(`🧠 Consolidating walking patterns...`);

    const result = await this.server.consolidateSkills('bipedal_locomotion');

    console.log(`   Skills Consolidated: ${result.skillsConsolidated}`);
    console.log(`   Patterns Found: ${result.patternsFound}`);
    console.log(`   💾 Gait knowledge saved to AgentDB\n`);
  }

  exportMetrics(): any {
    return {
      robotId: this.robotId,
      totalDistance: this.walkingMetrics.reduce((sum, m) => sum + m.distance, 0),
      totalSteps: this.totalSteps,
      totalFalls: this.totalFalls,
      sessions: this.walkingMetrics,
      gaits: this.gaits,
      timestamp: new Date().toISOString(),
    };
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'humanoid-1';
  const numSessions = parseInt(process.argv[3]) || 8;

  const sim = new HumanoidWalkingSimulation(robotId);

  await sim.start();
  await sim.runSimulation(numSessions);

  const metrics = sim.exportMetrics();
  console.log(`📈 Exported metrics:`, JSON.stringify(metrics, null, 2));

  console.log(`\n✨ Humanoid walking simulation complete!\n`);
  process.exit(0);
}

main().catch(console.error);

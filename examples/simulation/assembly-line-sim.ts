#!/usr/bin/env node
/**
 * Assembly Line Robotic Arm Simulation
 *
 * Demonstrates:
 * - Precision robotic arm control
 * - Pick-and-place assembly operations
 * - Quality control and inspection
 * - Task sequencing and timing
 * - Learning from assembly failures
 *
 * The robot learns optimal assembly strategies through:
 * - Motion planning and optimization
 * - Grip force calibration
 * - Part recognition and positioning
 * - Error recovery procedures
 */

import { ROS3McpServer } from '../../npm/mcp/src/server.js';

interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  gripper: number;
}

interface Part {
  id: string;
  type: 'bolt' | 'nut' | 'panel' | 'circuit_board' | 'connector';
  position: { x: number; y: number; z: number };
  weight: number;
  size: number;
  fragility: number; // 0-1, higher = more fragile
}

interface AssemblyStep {
  stepNumber: number;
  action: 'pick' | 'place' | 'screw' | 'inspect' | 'test';
  partId: string;
  targetPosition: { x: number; y: number; z: number };
  precision: number; // required precision in mm
  force: number; // required force in N
}

interface AssemblyMetrics {
  stepNumber: number;
  duration: number;
  success: boolean;
  accuracy: number; // mm deviation
  damageOccurred: boolean;
  retries: number;
}

class AssemblyLineSimulation {
  private server: ROS3McpServer;
  private robotId: string;
  private armPosition: JointAngles = {
    base: 0,
    shoulder: 90,
    elbow: 90,
    wrist: 0,
    gripper: 0,
  };
  private parts: Map<string, Part> = new Map();
  private assemblyMetrics: AssemblyMetrics[] = [];
  private successfulAssemblies: number = 0;
  private totalAssemblies: number = 0;
  private gripCalibration: Map<string, number> = new Map(); // Part type -> optimal grip force

  constructor(robotId: string = 'assembly-arm-1') {
    this.robotId = robotId;
    this.server = new ROS3McpServer({
      name: `assembly-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/assembly-${robotId}.db`,
    });

    this.initializeParts();
    this.initializeGripCalibration();
  }

  private initializeParts(): void {
    const partTypes: Part['type'][] = ['bolt', 'nut', 'panel', 'circuit_board', 'connector'];
    const partConfigs = [
      { type: 'bolt', weight: 0.01, size: 0.005, fragility: 0.1 },
      { type: 'nut', weight: 0.008, size: 0.005, fragility: 0.1 },
      { type: 'panel', weight: 0.5, size: 0.2, fragility: 0.3 },
      { type: 'circuit_board', weight: 0.2, size: 0.1, fragility: 0.9 },
      { type: 'connector', weight: 0.05, size: 0.02, fragility: 0.5 },
    ];

    partConfigs.forEach((config, idx) => {
      for (let i = 0; i < 5; i++) {
        const partId = `${config.type}-${i + 1}`;
        this.parts.set(partId, {
          id: partId,
          type: config.type,
          position: {
            x: -0.3 + idx * 0.15,
            y: 0.4,
            z: 0.05,
          },
          weight: config.weight,
          size: config.size,
          fragility: config.fragility,
        });
      }
    });
  }

  private initializeGripCalibration(): void {
    // Initial grip force estimates (will be refined through learning)
    this.gripCalibration.set('bolt', 2.0);
    this.gripCalibration.set('nut', 2.0);
    this.gripCalibration.set('panel', 5.0);
    this.gripCalibration.set('circuit_board', 1.5);
    this.gripCalibration.set('connector', 2.5);
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🦾 Assembly Robotic Arm ${this.robotId} initialized!`);
    console.log(`📍 Base position: (0, 0, 0)`);
    console.log(`🔧 Parts loaded: ${this.parts.size}`);
    console.log(`🎯 Precision mode: Active\n`);

    await this.loadAssemblyMemory();
  }

  private async loadAssemblyMemory(): Promise<void> {
    try {
      const memories = await this.server['memory'].queryWithContext(
        'successful assembly operations',
        { k: 30, minConfidence: 0.7 }
      );

      if (memories.memories.length > 0) {
        console.log(`🧠 Loaded ${memories.memories.length} assembly memories`);
        this.updateGripCalibrationFromMemory(memories.memories);
        console.log(`   Grip calibration updated from experience\n`);
      }
    } catch (error) {
      console.log(`ℹ️  No assembly history (first operation)\n`);
    }
  }

  private updateGripCalibrationFromMemory(memories: any[]): void {
    const gripData = new Map<string, { total: number; count: number }>();

    for (const memory of memories) {
      if (memory.metadata?.partType && memory.metadata?.gripForce && memory.success) {
        const partType = memory.metadata.partType;
        const gripForce = memory.metadata.gripForce;

        if (!gripData.has(partType)) {
          gripData.set(partType, { total: 0, count: 0 });
        }

        const data = gripData.get(partType)!;
        data.total += gripForce;
        data.count++;
      }
    }

    for (const [partType, data] of gripData) {
      const avgGrip = data.total / data.count;
      const currentGrip = this.gripCalibration.get(partType) || 2.0;
      // Weighted average
      const newGrip = currentGrip * 0.3 + avgGrip * 0.7;
      this.gripCalibration.set(partType, newGrip);

      console.log(`   🔧 ${partType}: ${newGrip.toFixed(2)}N grip force`);
    }
  }

  private async moveArmTo(target: { x: number; y: number; z: number }): Promise<number> {
    console.log(`      🦾 Moving arm to (${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)})`);

    // Simplified inverse kinematics simulation
    const startTime = Date.now();

    // Calculate required joint movements
    const distance = Math.sqrt(target.x ** 2 + target.y ** 2 + target.z ** 2);
    const steps = Math.ceil(distance * 100); // Precision movement

    for (let i = 0; i < steps; i++) {
      // Simulate smooth motion
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const duration = Date.now() - startTime;
    console.log(`      ✓ Reached target in ${duration}ms`);

    return duration;
  }

  private calculateGripForce(part: Part): number {
    const baseForce = this.gripCalibration.get(part.type) || 2.0;

    // Adjust for weight
    const weightFactor = part.weight * 20; // N per kg

    // Adjust for fragility (lower force for fragile parts)
    const fragilityFactor = 1 - part.fragility * 0.5;

    return (baseForce + weightFactor) * fragilityFactor;
  }

  private async pickPart(partId: string): Promise<{ success: boolean; duration: number; damaged: boolean }> {
    const part = this.parts.get(partId);
    if (!part) throw new Error(`Part ${partId} not found`);

    console.log(`   📦 Picking ${part.type} (${part.id})`);
    console.log(`      Weight: ${(part.weight * 1000).toFixed(1)}g, Fragility: ${(part.fragility * 100).toFixed(0)}%`);

    // Move to part position
    const moveDuration = await this.moveArmTo(part.position);

    // Calculate grip force
    const gripForce = this.calculateGripForce(part);
    console.log(`      🤏 Applying ${gripForce.toFixed(2)}N grip force`);

    // Simulate gripping
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check for damage (too much force on fragile parts)
    const damaged = gripForce > (10 * (1 - part.fragility)) && Math.random() < part.fragility;

    // Check for successful grip (too little force might fail)
    const minForce = part.weight * 15; // Minimum force to hold
    const success = !damaged && gripForce >= minForce;

    if (damaged) {
      console.log(`      ❌ Part damaged! Grip force too high`);
    } else if (!success) {
      console.log(`      ❌ Failed to grip! Force too low`);
    } else {
      console.log(`      ✅ Part secured`);
    }

    return { success, duration: moveDuration, damaged };
  }

  private async placePart(
    partId: string,
    target: { x: number; y: number; z: number },
    precision: number
  ): Promise<{ success: boolean; accuracy: number; duration: number }> {
    const part = this.parts.get(partId);
    if (!part) throw new Error(`Part ${partId} not found`);

    console.log(`   📍 Placing ${part.type} at target`);
    console.log(`      Required precision: ${precision.toFixed(3)}mm`);

    // Move to target position
    const moveDuration = await this.moveArmTo(target);

    // Simulate placement
    await new Promise(resolve => setTimeout(resolve, 300));

    // Calculate placement accuracy (learning improves this)
    const baseAccuracy = 0.5; // mm
    const experienceFactor = Math.min(this.totalAssemblies / 50, 1.0); // Improves with experience
    const accuracy = baseAccuracy * (1 - experienceFactor * 0.7) + Math.random() * 0.3;

    const success = accuracy <= precision;

    console.log(`      📏 Placement accuracy: ${accuracy.toFixed(3)}mm`);

    if (success) {
      console.log(`      ✅ Part placed successfully`);
    } else {
      console.log(`      ⚠️  Placement outside tolerance (${precision.toFixed(3)}mm required)`);
    }

    // Release gripper
    this.armPosition.gripper = 0;

    return { success, accuracy, duration: moveDuration };
  }

  private async executeAssemblyStep(step: AssemblyStep): Promise<AssemblyMetrics> {
    console.log(`\n🔧 Assembly Step ${step.stepNumber}: ${step.action.toUpperCase()}`);
    console.log(`   Part: ${step.partId}`);

    const startTime = Date.now();
    let retries = 0;
    let success = false;
    let accuracy = 0;
    let damageOccurred = false;

    while (retries < 3 && !success) {
      if (retries > 0) {
        console.log(`\n   🔄 Retry attempt ${retries}...`);
      }

      if (step.action === 'pick' || step.action === 'place') {
        // Pick phase
        const pickResult = await this.pickPart(step.partId);
        damageOccurred = pickResult.damaged;

        if (!pickResult.success) {
          retries++;

          if (!damageOccurred) {
            // Adjust grip force for next attempt
            const part = this.parts.get(step.partId)!;
            const currentGrip = this.gripCalibration.get(part.type) || 2.0;
            this.gripCalibration.set(part.type, currentGrip * 1.1);
            console.log(`      ⚙️  Adjusted grip force to ${(currentGrip * 1.1).toFixed(2)}N`);
          } else {
            break; // Can't retry with damaged part
          }

          continue;
        }

        // Place phase
        if (step.action === 'place') {
          const placeResult = await this.placePart(step.partId, step.targetPosition, step.precision);
          accuracy = placeResult.accuracy;
          success = placeResult.success;

          if (!success) {
            retries++;
          }
        } else {
          success = true;
        }
      } else if (step.action === 'screw') {
        console.log(`   🔩 Applying torque...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        success = Math.random() > 0.1; // 90% success rate
        accuracy = Math.random() * 0.2;
      } else if (step.action === 'inspect') {
        console.log(`   🔍 Visual inspection...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        success = true;
        accuracy = 0;
      }
    }

    const duration = Date.now() - startTime;

    const metrics: AssemblyMetrics = {
      stepNumber: step.stepNumber,
      duration,
      success,
      accuracy,
      damageOccurred,
      retries,
    };

    // Store experience in memory
    const part = this.parts.get(step.partId);
    if (part) {
      await this.server['memory'].storeEpisode({
        sessionId: `step-${step.stepNumber}-${Date.now()}`,
        taskName: 'assembly_operation',
        confidence: success ? 0.9 : 0.4,
        success,
        outcome: success ? `Completed ${step.action} operation` : `Failed ${step.action} operation`,
        strategy: step.action,
        metadata: {
          stepNumber: step.stepNumber,
          action: step.action,
          partType: part.type,
          partId: step.partId,
          gripForce: this.calculateGripForce(part),
          accuracy,
          retries,
          damageOccurred,
        },
      });
    }

    return metrics;
  }

  private generateAssemblySequence(): AssemblyStep[] {
    const steps: AssemblyStep[] = [];

    // Simple product assembly: circuit board + connectors + panel
    steps.push({
      stepNumber: 1,
      action: 'pick',
      partId: 'circuit_board-1',
      targetPosition: { x: 0, y: 0, z: 0 },
      precision: 0.5,
      force: 1.5,
    });

    steps.push({
      stepNumber: 2,
      action: 'place',
      partId: 'circuit_board-1',
      targetPosition: { x: 0, y: 0, z: 0.01 },
      precision: 0.5,
      force: 0,
    });

    steps.push({
      stepNumber: 3,
      action: 'pick',
      partId: 'connector-1',
      targetPosition: { x: 0, y: 0, z: 0 },
      precision: 0.2,
      force: 2.0,
    });

    steps.push({
      stepNumber: 4,
      action: 'place',
      partId: 'connector-1',
      targetPosition: { x: 0.05, y: 0.05, z: 0.02 },
      precision: 0.2,
      force: 0,
    });

    steps.push({
      stepNumber: 5,
      action: 'pick',
      partId: 'bolt-1',
      targetPosition: { x: 0, y: 0, z: 0 },
      precision: 0.1,
      force: 2.0,
    });

    steps.push({
      stepNumber: 6,
      action: 'place',
      partId: 'bolt-1',
      targetPosition: { x: 0.1, y: 0.1, z: 0.02 },
      precision: 0.1,
      force: 0,
    });

    steps.push({
      stepNumber: 7,
      action: 'screw',
      partId: 'bolt-1',
      targetPosition: { x: 0.1, y: 0.1, z: 0.02 },
      precision: 0.1,
      force: 3.0,
    });

    steps.push({
      stepNumber: 8,
      action: 'inspect',
      partId: 'circuit_board-1',
      targetPosition: { x: 0, y: 0, z: 0.1 },
      precision: 1.0,
      force: 0,
    });

    return steps;
  }

  async runSimulation(numAssemblies: number = 5): Promise<void> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🏭 Assembly Line Robotic Arm Simulation`);
    console.log(`${'='.repeat(70)}\n`);

    for (let i = 0; i < numAssemblies; i++) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`🏭 Assembly #${i + 1} of ${numAssemblies}`);
      console.log(`${'─'.repeat(70)}`);

      this.totalAssemblies++;

      const steps = this.generateAssemblySequence();
      let assemblySuccess = true;

      for (const step of steps) {
        const metrics = await this.executeAssemblyStep(step);
        this.assemblyMetrics.push(metrics);

        if (!metrics.success) {
          assemblySuccess = false;
          console.log(`\n   ❌ Assembly failed at step ${step.stepNumber}`);
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (assemblySuccess) {
        this.successfulAssemblies++;
        console.log(`\n   ✅ Assembly #${i + 1} completed successfully!`);
      }

      // Brief pause between assemblies
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.printSimulationSummary();
    await this.consolidateKnowledge();
  }

  private printSimulationSummary(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Assembly Simulation Summary`);
    console.log(`${'='.repeat(70)}\n`);

    const successRate = (this.successfulAssemblies / this.totalAssemblies) * 100;
    const totalDuration = this.assemblyMetrics.reduce((sum, m) => sum + m.duration, 0);
    const totalRetries = this.assemblyMetrics.reduce((sum, m) => sum + m.retries, 0);
    const damageCount = this.assemblyMetrics.filter(m => m.damageOccurred).length;
    const avgAccuracy = this.assemblyMetrics
      .filter(m => m.success && m.accuracy > 0)
      .reduce((sum, m) => sum + m.accuracy, 0) / this.assemblyMetrics.length;

    console.log(`Total Assemblies: ${this.totalAssemblies}`);
    console.log(`Successful: ${this.successfulAssemblies} (${successRate.toFixed(1)}%)`);
    console.log(`Total Steps: ${this.assemblyMetrics.length}`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Average Step Duration: ${(totalDuration / this.assemblyMetrics.length / 1000).toFixed(2)}s`);
    console.log(`Total Retries: ${totalRetries}`);
    console.log(`Parts Damaged: ${damageCount}`);
    console.log(`Average Placement Accuracy: ${avgAccuracy.toFixed(3)}mm\n`);

    console.log(`Grip Calibration (learned values):`);
    for (const [partType, gripForce] of this.gripCalibration) {
      console.log(`  ${partType}: ${gripForce.toFixed(2)}N`);
    }

    console.log(`\n${'='.repeat(70)}\n`);
  }

  private async consolidateKnowledge(): Promise<void> {
    console.log(`🧠 Consolidating assembly knowledge...`);

    const result = await this.server.consolidateSkills('assembly_operations');

    console.log(`   Skills Consolidated: ${result.skillsConsolidated}`);
    console.log(`   Patterns Found: ${result.patternsFound}`);
    console.log(`   💾 Assembly patterns saved to AgentDB\n`);
  }

  exportMetrics(): any {
    return {
      robotId: this.robotId,
      totalAssemblies: this.totalAssemblies,
      successfulAssemblies: this.successfulAssemblies,
      successRate: (this.successfulAssemblies / this.totalAssemblies) * 100,
      assemblyMetrics: this.assemblyMetrics,
      gripCalibration: Object.fromEntries(this.gripCalibration),
      timestamp: new Date().toISOString(),
    };
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'assembly-arm-1';
  const numAssemblies = parseInt(process.argv[3]) || 5;

  const sim = new AssemblyLineSimulation(robotId);

  await sim.start();
  await sim.runSimulation(numAssemblies);

  const metrics = sim.exportMetrics();
  console.log(`📈 Exported metrics:`, JSON.stringify(metrics, null, 2));

  console.log(`\n✨ Assembly line simulation complete!\n`);
  process.exit(0);
}

main().catch(console.error);

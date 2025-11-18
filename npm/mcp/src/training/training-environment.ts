/**
 * Training Environments for Robot Learning
 *
 * Provides diverse training scenarios:
 * - Navigation tasks (maze, obstacles)
 * - Manipulation tasks (grasping, placing)
 * - Multi-robot coordination tasks
 * - Custom reward functions
 */

import { State, Action, Experience } from './reinforcement-learning';

export interface EnvironmentConfig {
  type: 'navigation' | 'manipulation' | 'coordination' | 'custom';
  dimensions: number[];
  obstacles?: Obstacle[];
  targets?: Target[];
  robots?: number;
  timeLimit?: number;
  rewardShaping?: RewardShaping;
}

export interface Obstacle {
  position: number[];
  shape: 'sphere' | 'box' | 'cylinder';
  size: number[];
}

export interface Target {
  position: number[];
  tolerance: number;
  reward: number;
}

export interface RewardShaping {
  reachTarget: number;
  collision: number;
  timeStep: number;
  distanceToGoal: number;
  velocityPenalty: number;
  smoothness: number;
}

export interface EnvironmentStep {
  state: State;
  reward: number;
  done: boolean;
  info: {
    success: boolean;
    collision: boolean;
    distance: number;
    timeElapsed: number;
  };
}

/**
 * Base Environment Class
 */
export abstract class RobotEnvironment {
  protected config: EnvironmentConfig;
  protected currentState: State;
  protected stepCount: number = 0;
  protected episodeReward: number = 0;

  constructor(config: EnvironmentConfig) {
    this.config = config;
    this.currentState = this.reset();
  }

  abstract reset(): State;
  abstract step(action: Action): EnvironmentStep;
  abstract render(): void;

  getState(): State {
    return { ...this.currentState };
  }

  getEpisodeReward(): number {
    return this.episodeReward;
  }

  getStepCount(): number {
    return this.stepCount;
  }

  protected calculateReward(
    state: State,
    action: Action,
    nextState: State,
    info: any
  ): number {
    const shaping = this.config.rewardShaping || this.getDefaultRewardShaping();
    let reward = shaping.timeStep; // Small negative reward per step

    // Success reward
    if (info.success) {
      reward += shaping.reachTarget;
    }

    // Collision penalty
    if (info.collision) {
      reward += shaping.collision;
    }

    // Distance-based shaping
    if (info.distance !== undefined) {
      reward += shaping.distanceToGoal * (1 / (info.distance + 1));
    }

    // Velocity penalty (encourage smooth motion)
    const velocity = this.calculateVelocity(nextState.velocity);
    if (velocity > 1.0) {
      reward += shaping.velocityPenalty * (velocity - 1.0);
    }

    return reward;
  }

  protected getDefaultRewardShaping(): RewardShaping {
    return {
      reachTarget: 100,
      collision: -50,
      timeStep: -0.1,
      distanceToGoal: 5,
      velocityPenalty: -0.5,
      smoothness: 0.1,
    };
  }

  protected calculateVelocity(velocity: number[]): number {
    return Math.sqrt(velocity.reduce((sum, v) => sum + v * v, 0));
  }

  protected calculateDistance(pos1: number[], pos2: number[]): number {
    return Math.sqrt(
      pos1.reduce((sum, p, i) => sum + Math.pow(p - pos2[i], 2), 0)
    );
  }
}

/**
 * Navigation Environment
 * Robot must navigate from start to goal avoiding obstacles
 */
export class NavigationEnvironment extends RobotEnvironment {
  private startPosition: number[];
  private goalPosition: number[];
  private maxSteps: number;

  constructor(config: Partial<EnvironmentConfig> = {}) {
    const fullConfig: EnvironmentConfig = {
      type: 'navigation',
      dimensions: [10, 10],
      obstacles: [],
      timeLimit: 1000,
      ...config,
    };

    super(fullConfig);

    this.startPosition = [0, 0];
    this.goalPosition = this.config.dimensions.map(d => d - 1);
    this.maxSteps = this.config.timeLimit || 1000;
  }

  reset(): State {
    this.stepCount = 0;
    this.episodeReward = 0;

    this.currentState = {
      position: [...this.startPosition],
      velocity: [0, 0],
      orientation: [0, 0, 0],
      sensorReadings: this.getSensorReadings([...this.startPosition]),
      timestamp: Date.now(),
    };

    return { ...this.currentState };
  }

  step(action: Action): EnvironmentStep {
    this.stepCount++;

    // Apply action
    const nextPosition = this.applyAction(this.currentState.position, action);
    const nextVelocity = this.calculateNextVelocity(
      this.currentState.position,
      nextPosition
    );

    // Check collisions
    const collision = this.checkCollision(nextPosition);
    if (collision) {
      // Stay in place on collision
      nextPosition[0] = this.currentState.position[0];
      nextPosition[1] = this.currentState.position[1];
    }

    // Check goal reached
    const distanceToGoal = this.calculateDistance(nextPosition, this.goalPosition);
    const success = distanceToGoal < 0.5;

    // Update state
    const nextState: State = {
      position: nextPosition,
      velocity: nextVelocity,
      orientation: this.currentState.orientation,
      sensorReadings: this.getSensorReadings(nextPosition),
      timestamp: Date.now(),
    };

    // Calculate reward
    const info = {
      success,
      collision,
      distance: distanceToGoal,
      timeElapsed: this.stepCount,
    };
    const reward = this.calculateReward(this.currentState, action, nextState, info);
    this.episodeReward += reward;

    // Check done
    const done = success || collision || this.stepCount >= this.maxSteps;

    this.currentState = nextState;

    return { state: nextState, reward, done, info };
  }

  render(): void {
    const grid = Array(Math.ceil(this.config.dimensions[1]))
      .fill(0)
      .map(() => Array(Math.ceil(this.config.dimensions[0])).fill('.'));

    // Place obstacles
    for (const obstacle of this.config.obstacles || []) {
      const [x, y] = obstacle.position.map(Math.floor);
      if (x >= 0 && x < grid[0].length && y >= 0 && y < grid.length) {
        grid[y][x] = '#';
      }
    }

    // Place goal
    const [gx, gy] = this.goalPosition.map(Math.floor);
    grid[gy][gx] = 'G';

    // Place robot
    const [rx, ry] = this.currentState.position.map(Math.floor);
    grid[ry][rx] = 'R';

    console.log('\n' + grid.map(row => row.join(' ')).join('\n'));
    console.log(`Step: ${this.stepCount}, Reward: ${this.episodeReward.toFixed(2)}`);
  }

  private applyAction(position: number[], action: Action): number[] {
    const newPosition = [...position];

    switch (action.type) {
      case 'move':
        newPosition[0] += action.parameters[0] || 0;
        newPosition[1] += action.parameters[1] || 0;
        break;
      case 'rotate':
        // Rotation doesn't change position
        break;
    }

    // Clamp to environment boundaries
    for (let i = 0; i < newPosition.length; i++) {
      newPosition[i] = Math.max(0, Math.min(this.config.dimensions[i] - 1, newPosition[i]));
    }

    return newPosition;
  }

  private calculateNextVelocity(oldPos: number[], newPos: number[]): number[] {
    return newPos.map((p, i) => p - oldPos[i]);
  }

  private checkCollision(position: number[]): boolean {
    for (const obstacle of this.config.obstacles || []) {
      const distance = this.calculateDistance(position, obstacle.position);
      const collisionRadius = obstacle.size[0] / 2;
      if (distance < collisionRadius) {
        return true;
      }
    }
    return false;
  }

  private getSensorReadings(position: number[]): number[] {
    // Simulate 8 distance sensors around robot
    const numSensors = 8;
    const sensorRange = 2.0;
    const readings: number[] = [];

    for (let i = 0; i < numSensors; i++) {
      const angle = (i * 2 * Math.PI) / numSensors;
      const sensorDir = [Math.cos(angle), Math.sin(angle)];

      let minDist = sensorRange;

      // Check obstacles
      for (const obstacle of this.config.obstacles || []) {
        const obstacleDir = [
          obstacle.position[0] - position[0],
          obstacle.position[1] - position[1],
        ];
        const distance = Math.sqrt(obstacleDir[0] ** 2 + obstacleDir[1] ** 2);

        // Simplified ray-obstacle intersection
        const dot =
          (sensorDir[0] * obstacleDir[0] + sensorDir[1] * obstacleDir[1]) / distance;
        if (dot > 0.9 && distance < minDist) {
          minDist = distance;
        }
      }

      readings.push(minDist);
    }

    return readings;
  }

  getPossibleActions(): Action[] {
    const moveSpeed = 0.5;
    return [
      { type: 'move', parameters: [moveSpeed, 0] }, // Right
      { type: 'move', parameters: [-moveSpeed, 0] }, // Left
      { type: 'move', parameters: [0, moveSpeed] }, // Up
      { type: 'move', parameters: [0, -moveSpeed] }, // Down
      { type: 'move', parameters: [moveSpeed, moveSpeed] }, // Diagonal
      { type: 'move', parameters: [-moveSpeed, moveSpeed] },
      { type: 'move', parameters: [moveSpeed, -moveSpeed] },
      { type: 'move', parameters: [-moveSpeed, -moveSpeed] },
      { type: 'wait', parameters: [] }, // Stay
    ];
  }
}

/**
 * Manipulation Environment
 * Robot must grasp and place objects
 */
export class ManipulationEnvironment extends RobotEnvironment {
  private objects: Array<{ position: number[]; grasped: boolean }> = [];
  private targetZones: Target[] = [];
  private gripperOpen: boolean = true;

  constructor(config: Partial<EnvironmentConfig> = {}) {
    const fullConfig: EnvironmentConfig = {
      type: 'manipulation',
      dimensions: [5, 5, 3], // 3D space
      targets: [{ position: [4, 4, 0], tolerance: 0.5, reward: 100 }],
      timeLimit: 500,
      ...config,
    };

    super(fullConfig);

    this.targetZones = fullConfig.targets || [];
    this.objects = [{ position: [1, 1, 0], grasped: false }];
  }

  reset(): State {
    this.stepCount = 0;
    this.episodeReward = 0;
    this.gripperOpen = true;
    this.objects = [{ position: [1, 1, 0], grasped: false }];

    this.currentState = {
      position: [0, 0, 1], // Start above table
      velocity: [0, 0, 0],
      orientation: [0, 0, 0],
      sensorReadings: this.getManipulationSensors(),
      timestamp: Date.now(),
    };

    return { ...this.currentState };
  }

  step(action: Action): EnvironmentStep {
    this.stepCount++;

    let success = false;
    let collision = false;

    switch (action.type) {
      case 'move':
        this.currentState.position = this.applyMovement(action);
        break;
      case 'grasp':
        if (this.gripperOpen) {
          success = this.attemptGrasp();
          this.gripperOpen = false;
        }
        break;
      case 'release':
        if (!this.gripperOpen) {
          success = this.attemptRelease();
          this.gripperOpen = true;
        }
        break;
    }

    const distance = this.getDistanceToNearestTarget();
    const info = {
      success,
      collision,
      distance,
      timeElapsed: this.stepCount,
    };

    const nextState = { ...this.currentState, sensorReadings: this.getManipulationSensors() };
    const reward = this.calculateReward(this.currentState, action, nextState, info);
    this.episodeReward += reward;

    const done =
      success ||
      this.stepCount >= (this.config.timeLimit || 500) ||
      this.objects.every(obj => this.isInTargetZone(obj.position));

    this.currentState = nextState;

    return { state: nextState, reward, done, info };
  }

  render(): void {
    console.log(`\n=== Manipulation Task ===`);
    console.log(`Robot: [${this.currentState.position.map(p => p.toFixed(2)).join(', ')}]`);
    console.log(`Gripper: ${this.gripperOpen ? 'Open' : 'Closed'}`);
    console.log(`Objects:`);
    this.objects.forEach((obj, i) => {
      console.log(
        `  ${i}: [${obj.position.map(p => p.toFixed(2)).join(', ')}] ${obj.grasped ? '(grasped)' : ''}`
      );
    });
    console.log(`Step: ${this.stepCount}, Reward: ${this.episodeReward.toFixed(2)}`);
  }

  private applyMovement(action: Action): number[] {
    const newPos = [...this.currentState.position];
    for (let i = 0; i < 3; i++) {
      newPos[i] += action.parameters[i] || 0;
      newPos[i] = Math.max(0, Math.min(this.config.dimensions[i] - 1, newPos[i]));
    }
    return newPos;
  }

  private attemptGrasp(): boolean {
    const graspRadius = 0.3;
    for (const obj of this.objects) {
      if (!obj.grasped) {
        const distance = this.calculateDistance(this.currentState.position, obj.position);
        if (distance < graspRadius) {
          obj.grasped = true;
          return true;
        }
      }
    }
    return false;
  }

  private attemptRelease(): boolean {
    for (const obj of this.objects) {
      if (obj.grasped) {
        obj.position = [...this.currentState.position];
        obj.grasped = false;
        return this.isInTargetZone(obj.position);
      }
    }
    return false;
  }

  private isInTargetZone(position: number[]): boolean {
    for (const target of this.targetZones) {
      const distance = this.calculateDistance(position, target.position);
      if (distance < target.tolerance) {
        return true;
      }
    }
    return false;
  }

  private getDistanceToNearestTarget(): number {
    let minDist = Infinity;
    for (const obj of this.objects) {
      for (const target of this.targetZones) {
        const dist = this.calculateDistance(obj.position, target.position);
        minDist = Math.min(minDist, dist);
      }
    }
    return minDist;
  }

  private getManipulationSensors(): number[] {
    // Return distances to objects and gripper state
    const sensors: number[] = [];
    for (const obj of this.objects) {
      sensors.push(this.calculateDistance(this.currentState.position, obj.position));
    }
    sensors.push(this.gripperOpen ? 1 : 0);
    return sensors;
  }

  getPossibleActions(): Action[] {
    const step = 0.2;
    return [
      { type: 'move', parameters: [step, 0, 0] },
      { type: 'move', parameters: [-step, 0, 0] },
      { type: 'move', parameters: [0, step, 0] },
      { type: 'move', parameters: [0, -step, 0] },
      { type: 'move', parameters: [0, 0, step] },
      { type: 'move', parameters: [0, 0, -step] },
      { type: 'grasp', parameters: [] },
      { type: 'release', parameters: [] },
    ];
  }
}

/**
 * Multi-Robot Coordination Environment
 */
export class CoordinationEnvironment extends RobotEnvironment {
  private robots: State[] = [];
  private sharedTargets: Target[] = [];

  constructor(config: Partial<EnvironmentConfig> = {}) {
    const fullConfig: EnvironmentConfig = {
      type: 'coordination',
      dimensions: [10, 10],
      robots: 3,
      targets: [
        { position: [2, 2], tolerance: 0.5, reward: 50 },
        { position: [8, 8], tolerance: 0.5, reward: 50 },
        { position: [5, 5], tolerance: 0.5, reward: 100 },
      ],
      timeLimit: 1000,
      ...config,
    };

    super(fullConfig);
    this.sharedTargets = fullConfig.targets || [];
  }

  reset(): State {
    this.stepCount = 0;
    this.episodeReward = 0;

    const numRobots = this.config.robots || 3;
    this.robots = [];

    for (let i = 0; i < numRobots; i++) {
      this.robots.push({
        position: [Math.random() * this.config.dimensions[0], Math.random() * this.config.dimensions[1]],
        velocity: [0, 0],
        orientation: [0, 0, 0],
        sensorReadings: [],
        timestamp: Date.now(),
        robotId: `robot-${i}`,
      });
    }

    this.currentState = this.robots[0];
    return { ...this.currentState };
  }

  step(action: Action): EnvironmentStep {
    // Multi-agent step would coordinate all robots
    // For simplicity, handle single robot action
    this.stepCount++;

    // This is a simplified version - full implementation would
    // handle multiple robot actions simultaneously
    const reward = -0.1; // Time penalty
    const done = this.stepCount >= (this.config.timeLimit || 1000);

    const info = {
      success: false,
      collision: false,
      distance: 0,
      timeElapsed: this.stepCount,
    };

    return {
      state: this.currentState,
      reward,
      done,
      info,
    };
  }

  render(): void {
    console.log(`\n=== Multi-Robot Coordination ===`);
    this.robots.forEach((robot, i) => {
      console.log(`Robot ${i}: [${robot.position.map(p => p.toFixed(2)).join(', ')}]`);
    });
    console.log(`Targets: ${this.sharedTargets.length}`);
    console.log(`Step: ${this.stepCount}, Team Reward: ${this.episodeReward.toFixed(2)}`);
  }

  getPossibleActions(): Action[] {
    return [
      { type: 'move', parameters: [0.5, 0] },
      { type: 'move', parameters: [-0.5, 0] },
      { type: 'move', parameters: [0, 0.5] },
      { type: 'move', parameters: [0, -0.5] },
      { type: 'wait', parameters: [] },
    ];
  }
}

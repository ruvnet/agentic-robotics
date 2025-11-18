/**
 * Base Simulator - Core simulation class with time management, coordinate systems, and event system
 */

import { PhysicsEngine, PhysicsConfig, RigidBody, Vector3D, Pose } from './physics-engine';
import { Environment, EnvironmentConfig } from './environment';
import { SensorSimulator, SensorConfig } from './sensor-simulator';
import { EventEmitter } from 'events';

export type CoordinateFrame = 'world' | 'robot' | 'sensor';

export interface Transform {
  from: CoordinateFrame;
  to: CoordinateFrame;
  pose: Pose;
  timestamp: number;
}

export class CoordinateFrameManager {
  private transforms: Map<string, Transform>;

  constructor() {
    this.transforms = new Map();
  }

  public setTransform(transform: Transform): void {
    const key = `${transform.from}->${transform.to}`;
    this.transforms.set(key, transform);
  }

  public getTransform(from: CoordinateFrame, to: CoordinateFrame): Transform | undefined {
    const key = `${from}->${to}`;
    return this.transforms.get(key);
  }

  public transformPose(pose: Pose, from: CoordinateFrame, to: CoordinateFrame): Pose {
    if (from === to) {
      return { ...pose };
    }

    const transform = this.getTransform(from, to);
    if (!transform) {
      throw new Error(`No transform available from ${from} to ${to}`);
    }

    // Apply transformation
    // This is a simplified implementation
    // In a full implementation, use proper quaternion and vector transformations
    return {
      position: {
        x: pose.position.x + transform.pose.position.x,
        y: pose.position.y + transform.pose.position.y,
        z: pose.position.z + transform.pose.position.z
      },
      orientation: pose.orientation // Simplified
    };
  }
}

export type TimeMode = 'realtime' | 'accelerated' | 'step';

export interface TimeConfig {
  mode: TimeMode;
  timeScale?: number; // For accelerated mode (1.0 = realtime, 2.0 = 2x speed)
  fixedStep?: number; // For step mode (step size in seconds)
}

export class TimeManager {
  private config: TimeConfig;
  private simulationTime: number; // Simulation time in milliseconds
  private realStartTime: number; // Wall clock start time
  private lastUpdateTime: number; // Last real time update
  private isPaused: boolean;
  private stepRequested: boolean;

  constructor(config: TimeConfig) {
    this.config = config;
    this.simulationTime = 0;
    this.realStartTime = Date.now();
    this.lastUpdateTime = this.realStartTime;
    this.isPaused = false;
    this.stepRequested = false;
  }

  public update(): number {
    if (this.isPaused && !this.stepRequested) {
      return 0;
    }

    const currentRealTime = Date.now();
    const realDeltaTime = currentRealTime - this.lastUpdateTime;
    this.lastUpdateTime = currentRealTime;

    let deltaTime: number;

    switch (this.config.mode) {
      case 'realtime':
        deltaTime = realDeltaTime;
        break;

      case 'accelerated':
        deltaTime = realDeltaTime * (this.config.timeScale || 1.0);
        break;

      case 'step':
        if (this.stepRequested) {
          deltaTime = (this.config.fixedStep || 0.01) * 1000; // Convert to ms
          this.stepRequested = false;
        } else {
          deltaTime = 0;
        }
        break;

      default:
        deltaTime = realDeltaTime;
    }

    this.simulationTime += deltaTime;
    return deltaTime / 1000; // Return in seconds
  }

  public getSimulationTime(): number {
    return this.simulationTime / 1000; // Return in seconds
  }

  public getSimulationTimeMs(): number {
    return this.simulationTime;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.lastUpdateTime = Date.now();
  }

  public isPausedState(): boolean {
    return this.isPaused;
  }

  public step(): void {
    if (this.config.mode === 'step') {
      this.stepRequested = true;
    }
  }

  public reset(): void {
    this.simulationTime = 0;
    this.realStartTime = Date.now();
    this.lastUpdateTime = this.realStartTime;
    this.isPaused = false;
    this.stepRequested = false;
  }

  public setTimeScale(scale: number): void {
    this.config.timeScale = Math.max(0.1, Math.min(scale, 10.0));
  }

  public getTimeScale(): number {
    return this.config.timeScale || 1.0;
  }
}

export interface SimulationConfig {
  updateRate: number; // Target simulation update rate in Hz
  physics?: PhysicsConfig;
  environment: EnvironmentConfig;
  time?: TimeConfig;
  enableROS?: boolean; // Enable ROS3McpServer integration
}

export interface SimulationState {
  running: boolean;
  paused: boolean;
  simulationTime: number;
  realTime: number;
  updateRate: number;
  frameCount: number;
}

export interface SimulationEvents {
  'start': void;
  'stop': void;
  'pause': void;
  'resume': void;
  'reset': void;
  'step': number; // Delta time
  'collision': { bodyA: string; bodyB: string; timestamp: number };
  'robotAdded': { robotId: string };
  'robotRemoved': { robotId: string };
  'error': Error;
}

export class BaseSimulator extends EventEmitter {
  protected config: SimulationConfig;
  protected physics: PhysicsEngine;
  protected environment: Environment;
  protected sensors: SensorSimulator;
  protected timeManager: TimeManager;
  protected coordinateFrames: CoordinateFrameManager;
  protected robots: Map<string, RigidBody>;
  protected state: SimulationState;
  protected updateInterval: NodeJS.Timeout | null;

  constructor(config: SimulationConfig) {
    super();

    this.config = config;

    // Initialize physics engine
    this.physics = new PhysicsEngine(config.physics);

    // Initialize environment
    this.environment = new Environment(config.environment);

    // Add environment obstacles to physics
    for (const obstacle of this.environment.getAllObstacles()) {
      if (obstacle.rigidBody) {
        this.physics.addBody(obstacle.rigidBody);
      }
    }

    // Initialize sensors
    this.sensors = new SensorSimulator();

    // Initialize time manager
    this.timeManager = new TimeManager(config.time || { mode: 'realtime' });

    // Initialize coordinate frames
    this.coordinateFrames = new CoordinateFrameManager();

    // Initialize robots map
    this.robots = new Map();

    // Initialize state
    this.state = {
      running: false,
      paused: false,
      simulationTime: 0,
      realTime: Date.now(),
      updateRate: config.updateRate,
      frameCount: 0
    };

    this.updateInterval = null;
  }

  public start(): void {
    if (this.state.running) {
      console.warn('Simulator is already running');
      return;
    }

    this.state.running = true;
    this.state.paused = false;
    this.emit('start');

    // Start simulation loop
    const updatePeriod = 1000 / this.config.updateRate; // ms
    this.updateInterval = setInterval(() => {
      this.update();
    }, updatePeriod);
  }

  public stop(): void {
    if (!this.state.running) {
      return;
    }

    this.state.running = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.emit('stop');
  }

  public pause(): void {
    if (!this.state.running || this.state.paused) {
      return;
    }

    this.state.paused = true;
    this.timeManager.pause();
    this.emit('pause');
  }

  public resume(): void {
    if (!this.state.running || !this.state.paused) {
      return;
    }

    this.state.paused = false;
    this.timeManager.resume();
    this.emit('resume');
  }

  public step(): void {
    this.timeManager.step();
    this.update();
  }

  public reset(): void {
    this.stop();

    // Reset time
    this.timeManager.reset();

    // Reset environment
    this.environment.reset();

    // Reset robots
    for (const robot of this.robots.values()) {
      robot.velocity.linear = { x: 0, y: 0, z: 0 };
      robot.velocity.angular = { x: 0, y: 0, z: 0 };
      robot.clearForces();
    }

    // Reset state
    this.state.frameCount = 0;
    this.state.simulationTime = 0;

    this.emit('reset');
  }

  protected update(): void {
    if (this.state.paused) {
      return;
    }

    try {
      // Update time
      const deltaTime = this.timeManager.update();

      if (deltaTime === 0) {
        return; // No time elapsed (e.g., in step mode without step request)
      }

      // Update physics
      this.physics.update(deltaTime);

      // Update state
      this.state.simulationTime = this.timeManager.getSimulationTime();
      this.state.realTime = Date.now();
      this.state.frameCount++;

      // Emit step event
      this.emit('step', deltaTime);
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  public addRobot(id: string, robotBody: RigidBody): void {
    this.robots.set(id, robotBody);
    this.physics.addBody(robotBody);
    this.emit('robotAdded', { robotId: id });
  }

  public removeRobot(id: string): void {
    const robot = this.robots.get(id);
    if (robot) {
      this.physics.removeBody(robot.id);
      this.robots.delete(id);
      this.emit('robotRemoved', { robotId: id });
    }
  }

  public getRobot(id: string): RigidBody | undefined {
    return this.robots.get(id);
  }

  public addSensor(config: SensorConfig): void {
    this.sensors.addSensor(config);
  }

  public removeSensor(id: string): void {
    this.sensors.removeSensor(id);
  }

  public getEnvironment(): Environment {
    return this.environment;
  }

  public getPhysics(): PhysicsEngine {
    return this.physics;
  }

  public getSensors(): SensorSimulator {
    return this.sensors;
  }

  public getTimeManager(): TimeManager {
    return this.timeManager;
  }

  public getCoordinateFrames(): CoordinateFrameManager {
    return this.coordinateFrames;
  }

  public getState(): SimulationState {
    return { ...this.state };
  }

  public setGravity(gravity: Vector3D): void {
    this.physics.setGravity(gravity);
  }

  public setTimeScale(scale: number): void {
    this.timeManager.setTimeScale(scale);
  }

  // ROS Integration placeholder
  public async connectROS(rosConfig?: any): Promise<void> {
    if (!this.config.enableROS) {
      throw new Error('ROS integration is not enabled in simulation config');
    }

    // TODO: Implement ROS3McpServer integration
    // This will be implemented when ROS3McpServer is available
    console.log('ROS integration placeholder - to be implemented with ROS3McpServer');
  }

  public disconnectROS(): void {
    // TODO: Implement ROS disconnection
    console.log('ROS disconnection placeholder');
  }

  // Utility methods
  public worldToRobotFrame(worldPose: Pose, robotId: string): Pose {
    const robot = this.robots.get(robotId);
    if (!robot) {
      throw new Error(`Robot ${robotId} not found`);
    }

    // Store transform
    this.coordinateFrames.setTransform({
      from: 'world',
      to: 'robot',
      pose: robot.pose,
      timestamp: this.state.simulationTime
    });

    return this.coordinateFrames.transformPose(worldPose, 'world', 'robot');
  }

  public robotToWorldFrame(robotPose: Pose, robotId: string): Pose {
    const robot = this.robots.get(robotId);
    if (!robot) {
      throw new Error(`Robot ${robotId} not found`);
    }

    this.coordinateFrames.setTransform({
      from: 'robot',
      to: 'world',
      pose: robot.pose,
      timestamp: this.state.simulationTime
    });

    return this.coordinateFrames.transformPose(robotPose, 'robot', 'world');
  }
}

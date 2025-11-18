/**
 * Base Robot Class - Abstract foundation for all robot types
 *
 * Provides common functionality:
 * - State management
 * - Control interface
 * - Sensor integration
 * - AgentDB memory for learning
 * - ROS3 integration
 */

import { ROS3McpServer, ROS3McpServerConfig } from '../../npm/mcp/src/server.js';
import { Pose } from '../../npm/mcp/src/interface.js';

export interface RobotState {
  pose: Pose;
  velocity: Vector3;
  acceleration: Vector3;
  timestamp: number;
  status: 'idle' | 'moving' | 'error' | 'charging';
  batteryLevel: number;
  health: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface SensorData {
  timestamp: number;
  type: string;
  data: any;
}

export abstract class RobotBase extends ROS3McpServer {
  protected state: RobotState;
  protected sensorData: Map<string, SensorData> = new Map();
  protected controlLoopInterval?: NodeJS.Timeout;
  protected updateRate: number = 50; // Hz

  constructor(config: ROS3McpServerConfig) {
    super(config);

    this.state = {
      pose: { x: 0, y: 0, z: 0, roll: 0, pitch: 0, yaw: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      timestamp: Date.now(),
      status: 'idle',
      batteryLevel: 100.0,
      health: 100.0,
    };
  }

  /**
   * Start the robot control loop
   */
  async start(): Promise<void> {
    await super.start();
    await this.initializeRobot();
    this.startControlLoop();
    console.error(`${this.getInfo().name} initialized and control loop started`);
  }

  /**
   * Stop the robot control loop
   */
  async stop(): Promise<void> {
    this.stopControlLoop();
    await this.shutdownRobot();
    await super.stop();
  }

  /**
   * Initialize robot-specific components
   */
  protected abstract initializeRobot(): Promise<void>;

  /**
   * Shutdown robot-specific components
   */
  protected abstract shutdownRobot(): Promise<void>;

  /**
   * Update robot state (called each control loop iteration)
   */
  protected abstract updateState(dt: number): void;

  /**
   * Process control commands
   */
  public abstract processControl(command: any): Promise<void>;

  /**
   * Get current robot state
   */
  getState(): RobotState {
    return { ...this.state };
  }

  /**
   * Update pose with physics simulation
   */
  protected updatePose(dt: number): void {
    // Update position based on velocity
    this.state.pose.x += this.state.velocity.x * dt;
    this.state.pose.y += this.state.velocity.y * dt;
    this.state.pose.z += this.state.velocity.z * dt;

    // Update velocity based on acceleration
    this.state.velocity.x += this.state.acceleration.x * dt;
    this.state.velocity.y += this.state.acceleration.y * dt;
    this.state.velocity.z += this.state.acceleration.z * dt;

    this.state.timestamp = Date.now();
  }

  /**
   * Start control loop
   */
  protected startControlLoop(): void {
    const dt = 1.0 / this.updateRate;
    let lastTime = Date.now();

    this.controlLoopInterval = setInterval(() => {
      const currentTime = Date.now();
      const actualDt = (currentTime - lastTime) / 1000.0;
      lastTime = currentTime;

      this.updateState(actualDt);
      this.updateBattery(actualDt);
    }, dt * 1000);
  }

  /**
   * Stop control loop
   */
  protected stopControlLoop(): void {
    if (this.controlLoopInterval) {
      clearInterval(this.controlLoopInterval);
      this.controlLoopInterval = undefined;
    }
  }

  /**
   * Update battery level based on activity
   */
  protected updateBattery(dt: number): void {
    const drainRate = this.calculateBatteryDrain();
    this.state.batteryLevel = Math.max(0, this.state.batteryLevel - drainRate * dt);

    if (this.state.batteryLevel <= 0) {
      this.state.status = 'error';
      console.error(`${this.getInfo().name}: Battery depleted!`);
    }
  }

  /**
   * Calculate battery drain rate based on robot activity
   */
  protected calculateBatteryDrain(): number {
    const baseRate = 0.1; // %/s
    const velocityMagnitude = Math.sqrt(
      this.state.velocity.x ** 2 +
      this.state.velocity.y ** 2 +
      this.state.velocity.z ** 2
    );
    return baseRate + velocityMagnitude * 0.05;
  }

  /**
   * Store sensor data
   */
  protected storeSensorData(sensorType: string, data: any): void {
    this.sensorData.set(sensorType, {
      timestamp: Date.now(),
      type: sensorType,
      data,
    });
  }

  /**
   * Get sensor data
   */
  getSensorData(sensorType: string): SensorData | undefined {
    return this.sensorData.get(sensorType);
  }

  /**
   * Store robot experience in AgentDB
   */
  protected async storeExperience(
    taskName: string,
    success: boolean,
    outcome: string,
    metadata?: any
  ): Promise<void> {
    await this['memory'].storeEpisode({
      sessionId: `${this.getInfo().name}-${Date.now()}`,
      taskName,
      confidence: success ? 0.9 : 0.1,
      success,
      outcome,
      strategy: this.state.status,
      metadata: {
        ...metadata,
        state: this.getState(),
      },
    });
  }

  /**
   * Query past experiences for learning
   */
  protected async queryExperiences(
    query: string,
    k: number = 5
  ): Promise<any[]> {
    const result = await this['memory'].queryWithContext(query, {
      k,
      minConfidence: 0.5,
    });
    return result.memories;
  }

  /**
   * Utility: Convert quaternion to Euler angles
   */
  protected quaternionToEuler(q: Quaternion): { roll: number; pitch: number; yaw: number } {
    const { x, y, z, w } = q;

    const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const pitch = Math.asin(2 * (w * y - z * x));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));

    return { roll, pitch, yaw };
  }

  /**
   * Utility: Convert Euler angles to quaternion
   */
  protected eulerToQuaternion(roll: number, pitch: number, yaw: number): Quaternion {
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    return {
      w: cr * cp * cy + sr * sp * sy,
      x: sr * cp * cy - cr * sp * sy,
      y: cr * sp * cy + sr * cp * sy,
      z: cr * cp * sy - sr * sp * cy,
    };
  }

  /**
   * Utility: Clamp value between min and max
   */
  protected clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

/**
 * Wheeled Robot - Mobile rover with differential drive
 *
 * Features:
 * - Differential drive kinematics
 * - Wheel dynamics and friction
 * - Odometry sensors
 * - Collision detection
 * - Skid steering
 */

import { RobotBase, RobotState, Vector3 } from './base-robot.js';
import { ROS3McpServerConfig } from '../../npm/mcp/src/server.js';

export interface WheelState {
  angularVelocity: number; // rad/s
  torque: number;
  slipRatio: number;
}

export interface WheeledRobotConfig extends ROS3McpServerConfig {
  wheelRadius?: number;
  wheelBase?: number;
  maxWheelSpeed?: number;
  frictionCoeff?: number;
  mass?: number;
}

export interface DifferentialDriveCommand {
  linearVelocity: number; // m/s
  angularVelocity: number; // rad/s
}

export class WheeledRobot extends RobotBase {
  private wheelRadius: number;
  private wheelBase: number;
  private maxWheelSpeed: number;
  private frictionCoeff: number;
  private mass: number;

  private leftWheel: WheelState;
  private rightWheel: WheelState;
  private odometry: { x: number; y: number; theta: number };

  constructor(config: WheeledRobotConfig = {}) {
    super({
      name: config.name || 'wheeled-robot',
      version: config.version || '1.0.0',
      dbPath: config.dbPath || './wheeled-robot.db',
    });

    this.wheelRadius = config.wheelRadius || 0.1; // 10cm wheels
    this.wheelBase = config.wheelBase || 0.5; // 50cm between wheels
    this.maxWheelSpeed = config.maxWheelSpeed || 10.0; // rad/s
    this.frictionCoeff = config.frictionCoeff || 0.8;
    this.mass = config.mass || 50.0; // kg

    this.leftWheel = { angularVelocity: 0, torque: 0, slipRatio: 0 };
    this.rightWheel = { angularVelocity: 0, torque: 0, slipRatio: 0 };
    this.odometry = { x: 0, y: 0, theta: 0 };
  }

  protected async initializeRobot(): Promise<void> {
    console.error('Wheeled robot initialized');
    console.error(`  Wheel radius: ${this.wheelRadius}m`);
    console.error(`  Wheel base: ${this.wheelBase}m`);
    console.error(`  Max wheel speed: ${this.maxWheelSpeed} rad/s`);
    console.error(`  Mass: ${this.mass}kg`);

    await this.storeExperience(
      'initialization',
      true,
      'Wheeled robot initialized successfully',
      { wheelRadius: this.wheelRadius, wheelBase: this.wheelBase }
    );
  }

  protected async shutdownRobot(): Promise<void> {
    this.leftWheel.angularVelocity = 0;
    this.rightWheel.angularVelocity = 0;
    console.error('Wheeled robot shutdown complete');
  }

  protected updateState(dt: number): void {
    // Update wheel dynamics
    this.updateWheelDynamics(dt);

    // Calculate robot velocity from wheel speeds (differential drive kinematics)
    const vLeft = this.leftWheel.angularVelocity * this.wheelRadius;
    const vRight = this.rightWheel.angularVelocity * this.wheelRadius;

    const linearVel = (vLeft + vRight) / 2.0;
    const angularVel = (vRight - vLeft) / this.wheelBase;

    // Update robot velocity
    this.state.velocity.x = linearVel * Math.cos(this.state.pose.yaw);
    this.state.velocity.y = linearVel * Math.sin(this.state.pose.yaw);
    this.state.velocity.z = 0; // Wheeled robots don't move in z

    // Update pose
    this.updatePose(dt);
    this.state.pose.yaw += angularVel * dt;

    // Update odometry
    this.updateOdometry(dt, linearVel, angularVel);

    // Store odometry sensor data
    this.storeSensorData('odometry', this.odometry);

    // Check collision
    this.checkCollision();
  }

  private updateWheelDynamics(dt: number): void {
    // Simple wheel dynamics with friction
    const frictionTorque = -this.frictionCoeff * Math.sign(this.leftWheel.angularVelocity);
    this.leftWheel.angularVelocity += (this.leftWheel.torque + frictionTorque) * dt / (this.mass * this.wheelRadius);

    const frictionTorqueR = -this.frictionCoeff * Math.sign(this.rightWheel.angularVelocity);
    this.rightWheel.angularVelocity += (this.rightWheel.torque + frictionTorqueR) * dt / (this.mass * this.wheelRadius);

    // Clamp to max wheel speed
    this.leftWheel.angularVelocity = this.clamp(
      this.leftWheel.angularVelocity,
      -this.maxWheelSpeed,
      this.maxWheelSpeed
    );
    this.rightWheel.angularVelocity = this.clamp(
      this.rightWheel.angularVelocity,
      -this.maxWheelSpeed,
      this.maxWheelSpeed
    );

    // Calculate slip ratio (simplified)
    this.leftWheel.slipRatio = Math.abs(this.leftWheel.angularVelocity) > 0.1
      ? Math.random() * 0.05
      : 0;
    this.rightWheel.slipRatio = Math.abs(this.rightWheel.angularVelocity) > 0.1
      ? Math.random() * 0.05
      : 0;
  }

  private updateOdometry(dt: number, linearVel: number, angularVel: number): void {
    // Dead reckoning odometry with noise
    const noise = 0.01; // 1% noise
    this.odometry.x += linearVel * Math.cos(this.odometry.theta) * dt * (1 + (Math.random() - 0.5) * noise);
    this.odometry.y += linearVel * Math.sin(this.odometry.theta) * dt * (1 + (Math.random() - 0.5) * noise);
    this.odometry.theta += angularVel * dt * (1 + (Math.random() - 0.5) * noise);

    // Normalize theta
    this.odometry.theta = ((this.odometry.theta + Math.PI) % (2 * Math.PI)) - Math.PI;
  }

  private checkCollision(): void {
    // Simple boundary collision detection
    const boundary = 10.0; // 10m boundary

    if (Math.abs(this.state.pose.x) > boundary || Math.abs(this.state.pose.y) > boundary) {
      this.state.status = 'error';
      this.leftWheel.angularVelocity = 0;
      this.rightWheel.angularVelocity = 0;
      console.error('Collision detected! Robot stopped.');

      this.storeExperience(
        'collision',
        false,
        'Boundary collision detected',
        { position: { x: this.state.pose.x, y: this.state.pose.y } }
      );
    }
  }

  public async processControl(command: DifferentialDriveCommand): Promise<void> {
    const { linearVelocity, angularVelocity } = command;

    // Convert to wheel velocities
    const vLeft = linearVelocity - (angularVelocity * this.wheelBase / 2.0);
    const vRight = linearVelocity + (angularVelocity * this.wheelBase / 2.0);

    // Convert to wheel angular velocities
    const omegaLeft = vLeft / this.wheelRadius;
    const omegaRight = vRight / this.wheelRadius;

    // Set wheel torques (proportional control)
    const kp = 5.0;
    this.leftWheel.torque = kp * (omegaLeft - this.leftWheel.angularVelocity);
    this.rightWheel.torque = kp * (omegaRight - this.rightWheel.angularVelocity);

    this.state.status = 'moving';

    await this.storeExperience(
      'drive_command',
      true,
      `Driving at linear: ${linearVelocity.toFixed(2)}m/s, angular: ${angularVelocity.toFixed(2)}rad/s`,
      { linearVelocity, angularVelocity, omegaLeft, omegaRight }
    );
  }

  /**
   * Drive to a target position using simple proportional control
   */
  public async driveToTarget(targetX: number, targetY: number): Promise<void> {
    const dx = targetX - this.state.pose.x;
    const dy = targetY - this.state.pose.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const targetAngle = Math.atan2(dy, dx);

    const angleDiff = targetAngle - this.state.pose.yaw;
    const normalizedAngle = ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;

    const kpLinear = 0.5;
    const kpAngular = 2.0;

    const linearVel = Math.min(kpLinear * distance, 1.0);
    const angularVel = kpAngular * normalizedAngle;

    await this.processControl({ linearVelocity: linearVel, angularVelocity: angularVel });

    console.error(
      `Driving to target (${targetX}, ${targetY}), ` +
      `distance: ${distance.toFixed(2)}m, ` +
      `angle error: ${(normalizedAngle * 180 / Math.PI).toFixed(1)}°`
    );
  }

  /**
   * Get odometry data
   */
  getOdometry() {
    return { ...this.odometry };
  }

  /**
   * Get wheel states
   */
  getWheelStates() {
    return {
      left: { ...this.leftWheel },
      right: { ...this.rightWheel },
    };
  }

  /**
   * Reset odometry
   */
  resetOdometry(): void {
    this.odometry = { x: 0, y: 0, theta: 0 };
    console.error('Odometry reset');
  }
}

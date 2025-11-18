/**
 * Drone Robot - Quadcopter with flight dynamics
 *
 * Features:
 * - 6-DOF flight (position + orientation)
 * - Thrust and torque control for 4 rotors
 * - Wind effects simulation
 * - Battery simulation with flight time
 * - IMU sensor simulation
 * - Altitude hold and position control
 */

import { RobotBase, Vector3, Quaternion } from './base-robot.js';
import { ROS3McpServerConfig } from '../../npm/mcp/src/server.js';

export interface RotorState {
  rpm: number;
  thrust: number; // Newtons
  torque: number;
}

export interface IMUData {
  acceleration: Vector3;
  angularVelocity: Vector3;
  orientation: Quaternion;
  timestamp: number;
}

export interface DroneConfig extends ROS3McpServerConfig {
  mass?: number;
  armLength?: number;
  maxThrust?: number;
  dragCoeff?: number;
}

export interface FlightCommand {
  thrust: number; // Total thrust 0-1
  roll: number; // rad/s
  pitch: number; // rad/s
  yaw: number; // rad/s
}

export class DroneRobot extends RobotBase {
  private mass: number;
  private armLength: number;
  private maxThrust: number;
  private dragCoeff: number;
  private gravity: number = 9.81; // m/s^2

  private rotors: RotorState[] = [];
  private angularVelocity: Vector3 = { x: 0, y: 0, z: 0 };
  private wind: Vector3 = { x: 0, y: 0, z: 0 };
  private imu: IMUData;

  constructor(config: DroneConfig = {}) {
    super({
      name: config.name || 'drone-robot',
      version: config.version || '1.0.0',
      dbPath: config.dbPath || './drone-robot.db',
    });

    this.mass = config.mass || 1.5; // kg
    this.armLength = config.armLength || 0.25; // m
    this.maxThrust = config.maxThrust || 20.0; // N
    this.dragCoeff = config.dragCoeff || 0.1;

    // Initialize 4 rotors
    for (let i = 0; i < 4; i++) {
      this.rotors.push({ rpm: 0, thrust: 0, torque: 0 });
    }

    this.imu = {
      acceleration: { x: 0, y: 0, z: -this.gravity },
      angularVelocity: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      timestamp: Date.now(),
    };

    this.updateRate = 100; // 100 Hz for drone control
  }

  protected async initializeRobot(): Promise<void> {
    console.error('Drone robot initialized');
    console.error(`  Mass: ${this.mass}kg`);
    console.error(`  Arm length: ${this.armLength}m`);
    console.error(`  Max thrust: ${this.maxThrust}N`);
    console.error(`  4 rotors configured`);

    await this.storeExperience(
      'initialization',
      true,
      'Drone initialized and ready for flight',
      { mass: this.mass, maxThrust: this.maxThrust }
    );
  }

  protected async shutdownRobot(): Promise<void> {
    // Stop all rotors
    this.rotors.forEach(rotor => {
      rotor.rpm = 0;
      rotor.thrust = 0;
      rotor.torque = 0;
    });
    console.error('Drone robot shutdown complete');
  }

  protected updateState(dt: number): void {
    // Update rotor dynamics
    this.updateRotorDynamics(dt);

    // Calculate forces and torques
    const { totalThrust, torques } = this.calculateForcesAndTorques();

    // Apply aerodynamic drag
    const drag = this.calculateDrag();

    // Update acceleration (F = ma)
    this.state.acceleration.x = (totalThrust * Math.sin(this.state.pose.pitch) + this.wind.x - drag.x) / this.mass;
    this.state.acceleration.y = (totalThrust * Math.sin(this.state.pose.roll) + this.wind.y - drag.y) / this.mass;
    this.state.acceleration.z = (totalThrust * Math.cos(this.state.pose.pitch) * Math.cos(this.state.pose.roll) - this.mass * this.gravity + this.wind.z - drag.z) / this.mass;

    // Update angular acceleration
    const I = this.calculateMomentOfInertia();
    const angularAcceleration = {
      x: torques.x / I.x,
      y: torques.y / I.y,
      z: torques.z / I.z,
    };

    // Update angular velocity
    this.angularVelocity.x += angularAcceleration.x * dt;
    this.angularVelocity.y += angularAcceleration.y * dt;
    this.angularVelocity.z += angularAcceleration.z * dt;

    // Update orientation
    this.state.pose.roll += this.angularVelocity.x * dt;
    this.state.pose.pitch += this.angularVelocity.y * dt;
    this.state.pose.yaw += this.angularVelocity.z * dt;

    // Update pose
    this.updatePose(dt);

    // Update IMU
    this.updateIMU();

    // Check ground collision
    if (this.state.pose.z <= 0) {
      this.state.pose.z = 0;
      this.state.velocity.z = 0;
      this.state.acceleration.z = 0;
      if (this.state.status === 'moving') {
        console.error('Drone landed');
        this.state.status = 'idle';
      }
    }

    // Store sensor data
    this.storeSensorData('imu', this.imu);
    this.storeSensorData('rotors', this.rotors);
    this.storeSensorData('wind', this.wind);
  }

  private updateRotorDynamics(dt: number): void {
    this.rotors.forEach(rotor => {
      // Simple rotor dynamics: thrust proportional to RPM^2
      const kThrust = 0.00001;
      rotor.thrust = kThrust * rotor.rpm * rotor.rpm;

      // Torque proportional to thrust
      const kTorque = 0.001;
      rotor.torque = kTorque * rotor.thrust;

      // Rotor response (first-order dynamics)
      const tau = 0.1; // time constant
      // rotor.rpm would approach commanded RPM with time constant tau
    });
  }

  private calculateForcesAndTorques(): { totalThrust: number; torques: Vector3 } {
    // Sum thrust from all rotors
    const totalThrust = this.rotors.reduce((sum, rotor) => sum + rotor.thrust, 0);

    // Calculate torques (simplified quadcopter configuration)
    // Rotors: 0=FL, 1=FR, 2=RL, 3=RR
    // CW: 0, 2; CCW: 1, 3
    const rollTorque = this.armLength * (this.rotors[1].thrust + this.rotors[3].thrust - this.rotors[0].thrust - this.rotors[2].thrust);
    const pitchTorque = this.armLength * (this.rotors[0].thrust + this.rotors[1].thrust - this.rotors[2].thrust - this.rotors[3].thrust);
    const yawTorque = this.rotors[0].torque + this.rotors[2].torque - this.rotors[1].torque - this.rotors[3].torque;

    return {
      totalThrust,
      torques: { x: rollTorque, y: pitchTorque, z: yawTorque },
    };
  }

  private calculateDrag(): Vector3 {
    const speed = Math.sqrt(
      this.state.velocity.x ** 2 +
      this.state.velocity.y ** 2 +
      this.state.velocity.z ** 2
    );

    const dragForce = 0.5 * this.dragCoeff * speed * speed;

    return {
      x: dragForce * Math.sign(this.state.velocity.x),
      y: dragForce * Math.sign(this.state.velocity.y),
      z: dragForce * Math.sign(this.state.velocity.z),
    };
  }

  private calculateMomentOfInertia(): Vector3 {
    // Simplified: assume point masses at rotor positions
    const I = this.mass * this.armLength * this.armLength;
    return { x: I, y: I, z: 2 * I };
  }

  private updateIMU(): void {
    this.imu.acceleration = { ...this.state.acceleration };
    this.imu.angularVelocity = { ...this.angularVelocity };
    this.imu.orientation = this.eulerToQuaternion(
      this.state.pose.roll,
      this.state.pose.pitch,
      this.state.pose.yaw
    );
    this.imu.timestamp = Date.now();
  }

  public async processControl(command: FlightCommand): Promise<void> {
    const { thrust, roll, pitch, yaw } = command;

    // Convert control inputs to rotor RPMs
    const baseRPM = Math.sqrt(thrust * this.maxThrust / (4 * 0.00001));

    // Mixing matrix for quadcopter
    const rollCorrection = roll * 1000;
    const pitchCorrection = pitch * 1000;
    const yawCorrection = yaw * 500;

    this.rotors[0].rpm = baseRPM - rollCorrection + pitchCorrection + yawCorrection; // FL
    this.rotors[1].rpm = baseRPM + rollCorrection + pitchCorrection - yawCorrection; // FR
    this.rotors[2].rpm = baseRPM - rollCorrection - pitchCorrection + yawCorrection; // RL
    this.rotors[3].rpm = baseRPM + rollCorrection - pitchCorrection - yawCorrection; // RR

    // Clamp RPMs
    this.rotors.forEach(rotor => {
      rotor.rpm = this.clamp(rotor.rpm, 0, 10000);
    });

    this.state.status = 'moving';

    await this.storeExperience(
      'flight_command',
      true,
      `Flying with thrust: ${thrust.toFixed(2)}, roll: ${roll.toFixed(2)}, pitch: ${pitch.toFixed(2)}, yaw: ${yaw.toFixed(2)}`,
      { thrust, roll, pitch, yaw, altitude: this.state.pose.z }
    );
  }

  /**
   * Takeoff to target altitude
   */
  public async takeoff(targetAltitude: number = 2.0): Promise<void> {
    const currentAlt = this.state.pose.z;
    const altError = targetAltitude - currentAlt;

    const thrustCommand = 0.5 + altError * 0.1; // Simple proportional control

    await this.processControl({
      thrust: this.clamp(thrustCommand, 0, 1),
      roll: 0,
      pitch: 0,
      yaw: 0,
    });

    console.error(`Taking off to ${targetAltitude}m (current: ${currentAlt.toFixed(2)}m)`);
  }

  /**
   * Land drone
   */
  public async land(): Promise<void> {
    const currentAlt = this.state.pose.z;

    if (currentAlt > 0.1) {
      const thrustCommand = 0.45; // Slow descent

      await this.processControl({
        thrust: thrustCommand,
        roll: 0,
        pitch: 0,
        yaw: 0,
      });

      console.error(`Landing (current altitude: ${currentAlt.toFixed(2)}m)`);
    } else {
      // Stop all rotors
      this.rotors.forEach(rotor => rotor.rpm = 0);
      this.state.status = 'idle';
      console.error('Landed');
    }
  }

  /**
   * Hover at current altitude
   */
  public async hover(): Promise<void> {
    const hoverThrust = (this.mass * this.gravity) / this.maxThrust;

    await this.processControl({
      thrust: hoverThrust,
      roll: -this.angularVelocity.x * 0.1,
      pitch: -this.angularVelocity.y * 0.1,
      yaw: -this.angularVelocity.z * 0.1,
    });
  }

  /**
   * Set wind conditions
   */
  public setWind(x: number, y: number, z: number): void {
    this.wind = { x, y, z };
    console.error(`Wind set to [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}] m/s`);
  }

  /**
   * Get IMU data
   */
  public getIMU(): IMUData {
    return { ...this.imu };
  }

  /**
   * Get rotor states
   */
  public getRotorStates(): RotorState[] {
    return this.rotors.map(r => ({ ...r }));
  }

  /**
   * Calculate remaining flight time based on battery
   */
  protected calculateBatteryDrain(): number {
    const baseRate = 0.5; // %/s
    const totalThrust = this.rotors.reduce((sum, r) => sum + r.thrust, 0);
    const thrustRatio = totalThrust / this.maxThrust;
    return baseRate * (1 + thrustRatio * 2);
  }
}

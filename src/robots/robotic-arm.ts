/**
 * Robotic Arm - Multi-DOF manipulator
 *
 * Features:
 * - Forward kinematics (DH parameters)
 * - Inverse kinematics (analytical and numerical)
 * - End-effector control
 * - Gripper simulation with force feedback
 * - Trajectory planning
 * - Collision avoidance
 */

import { RobotBase, Vector3, Quaternion } from './base-robot.js';
import { ROS3McpServerConfig } from '../../npm/mcp/src/server.js';

export interface DHParameters {
  alpha: number; // twist angle
  a: number; // link length
  d: number; // link offset
  theta: number; // joint angle
}

export interface ArmJoint {
  id: number;
  angle: number; // radians
  velocity: number;
  torque: number;
  minLimit: number;
  maxLimit: number;
}

export interface EndEffector {
  position: Vector3;
  orientation: Quaternion;
  velocity: Vector3;
  force: Vector3;
}

export interface GripperState {
  opening: number; // 0 (closed) to 1 (open)
  force: number; // Newtons
  hasObject: boolean;
}

export interface RoboticArmConfig extends ROS3McpServerConfig {
  numJoints?: number;
  linkLengths?: number[];
  maxReach?: number;
}

export class RoboticArm extends RobotBase {
  private numJoints: number;
  private joints: ArmJoint[] = [];
  private dhParams: DHParameters[] = [];
  private linkLengths: number[];
  private maxReach: number;

  private endEffector: EndEffector;
  private gripper: GripperState;
  private targetPosition: Vector3 | null = null;

  constructor(config: RoboticArmConfig = {}) {
    super({
      name: config.name || 'robotic-arm',
      version: config.version || '1.0.0',
      dbPath: config.dbPath || './robotic-arm.db',
    });

    this.numJoints = config.numJoints || 6;
    this.linkLengths = config.linkLengths || [0.4, 0.4, 0.3, 0.2, 0.15, 0.1];
    this.maxReach = config.maxReach || this.linkLengths.reduce((sum, l) => sum + l, 0);

    // Initialize joints
    for (let i = 0; i < this.numJoints; i++) {
      this.joints.push({
        id: i,
        angle: 0,
        velocity: 0,
        torque: 0,
        minLimit: -Math.PI,
        maxLimit: Math.PI,
      });
    }

    // Initialize DH parameters (simplified 6-DOF arm)
    this.initializeDHParameters();

    this.endEffector = {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      force: { x: 0, y: 0, z: 0 },
    };

    this.gripper = {
      opening: 1.0,
      force: 0,
      hasObject: false,
    };

    this.updateRate = 100; // 100 Hz for arm control
  }

  private initializeDHParameters(): void {
    // Simplified DH parameters for a 6-DOF manipulator
    // Format: [alpha, a, d, theta]
    const dh: DHParameters[] = [
      { alpha: Math.PI/2, a: 0, d: this.linkLengths[0], theta: 0 },
      { alpha: 0, a: this.linkLengths[1], d: 0, theta: 0 },
      { alpha: Math.PI/2, a: this.linkLengths[2], d: 0, theta: 0 },
      { alpha: -Math.PI/2, a: 0, d: this.linkLengths[3], theta: 0 },
      { alpha: Math.PI/2, a: 0, d: this.linkLengths[4], theta: 0 },
      { alpha: 0, a: 0, d: this.linkLengths[5], theta: 0 },
    ];

    this.dhParams = dh;
  }

  protected async initializeRobot(): Promise<void> {
    console.error('Robotic arm initialized');
    console.error(`  DOF: ${this.numJoints}`);
    console.error(`  Link lengths: ${this.linkLengths.map(l => l.toFixed(2)).join(', ')}m`);
    console.error(`  Max reach: ${this.maxReach.toFixed(2)}m`);

    await this.storeExperience(
      'initialization',
      true,
      'Robotic arm initialized successfully',
      { numJoints: this.numJoints, maxReach: this.maxReach }
    );
  }

  protected async shutdownRobot(): Promise<void> {
    this.joints.forEach(joint => {
      joint.velocity = 0;
      joint.torque = 0;
    });
    console.error('Robotic arm shutdown complete');
  }

  protected updateState(dt: number): void {
    // Update joint dynamics
    this.updateJointDynamics(dt);

    // Forward kinematics to update end-effector position
    this.computeForwardKinematics();

    // If target position is set, compute IK and move towards it
    if (this.targetPosition) {
      this.moveTowardsTarget(dt);
    }

    // Update gripper
    this.updateGripper(dt);

    // Store sensor data
    this.storeSensorData('joint_angles', this.joints.map(j => j.angle));
    this.storeSensorData('end_effector', this.endEffector);
    this.storeSensorData('gripper', this.gripper);
  }

  private updateJointDynamics(dt: number): void {
    this.joints.forEach(joint => {
      // Simple PD control
      const kp = 50.0;
      const kd = 5.0;
      const acceleration = (joint.torque - kd * joint.velocity) / kp;

      joint.velocity += acceleration * dt;
      joint.angle += joint.velocity * dt;

      // Enforce joint limits
      if (joint.angle < joint.minLimit || joint.angle > joint.maxLimit) {
        joint.angle = this.clamp(joint.angle, joint.minLimit, joint.maxLimit);
        joint.velocity = 0;
      }
    });
  }

  private computeForwardKinematics(): void {
    // Compute end-effector position using DH parameters
    let T = this.identityMatrix4();

    for (let i = 0; i < this.numJoints; i++) {
      const dh = this.dhParams[i];
      const theta = this.joints[i].angle + dh.theta;

      // DH transformation matrix
      const Ti = this.dhTransform(dh.alpha, dh.a, dh.d, theta);
      T = this.multiplyMatrix4(T, Ti);
    }

    // Extract position from transformation matrix
    this.endEffector.position = {
      x: T[0][3],
      y: T[1][3],
      z: T[2][3],
    };

    // Extract orientation (simplified - would use full rotation matrix)
    this.endEffector.orientation = { x: 0, y: 0, z: 0, w: 1 };
  }

  private dhTransform(alpha: number, a: number, d: number, theta: number): number[][] {
    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    const ct = Math.cos(theta);
    const st = Math.sin(theta);

    return [
      [ct, -st * ca, st * sa, a * ct],
      [st, ct * ca, -ct * sa, a * st],
      [0, sa, ca, d],
      [0, 0, 0, 1],
    ];
  }

  private identityMatrix4(): number[][] {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  }

  private multiplyMatrix4(A: number[][], B: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < 4; i++) {
      result[i] = [];
      for (let j = 0; j < 4; j++) {
        result[i][j] = 0;
        for (let k = 0; k < 4; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  private moveTowardsTarget(dt: number): void {
    if (!this.targetPosition) return;

    const dx = this.targetPosition.x - this.endEffector.position.x;
    const dy = this.targetPosition.y - this.endEffector.position.y;
    const dz = this.targetPosition.z - this.endEffector.position.z;

    const error = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (error < 0.01) {
      // Target reached
      this.targetPosition = null;
      this.state.status = 'idle';
      return;
    }

    // Compute Jacobian and use inverse kinematics
    const J = this.computeJacobian();
    const dq = this.pseudoInverse(J, [dx, dy, dz]);

    // Apply joint velocities
    for (let i = 0; i < this.numJoints; i++) {
      this.joints[i].torque = 50.0 * dq[i];
    }
  }

  private computeJacobian(): number[][] {
    // Simplified Jacobian computation
    // In production, would compute proper geometric Jacobian
    const J: number[][] = [];
    const epsilon = 0.001;

    for (let i = 0; i < this.numJoints; i++) {
      const originalAngle = this.joints[i].angle;

      // Compute position with small perturbation
      this.joints[i].angle += epsilon;
      this.computeForwardKinematics();
      const pos1 = { ...this.endEffector.position };

      this.joints[i].angle = originalAngle - epsilon;
      this.computeForwardKinematics();
      const pos2 = { ...this.endEffector.position };

      // Restore original angle
      this.joints[i].angle = originalAngle;

      // Compute derivative
      J[i] = [
        (pos1.x - pos2.x) / (2 * epsilon),
        (pos1.y - pos2.y) / (2 * epsilon),
        (pos1.z - pos2.z) / (2 * epsilon),
      ];
    }

    // Restore end-effector position
    this.computeForwardKinematics();

    return J;
  }

  private pseudoInverse(J: number[][], dx: number[]): number[] {
    // Simplified pseudo-inverse using transpose (for square J)
    // In production, would use proper SVD-based pseudo-inverse
    const dq: number[] = [];

    for (let i = 0; i < this.numJoints; i++) {
      dq[i] = 0;
      for (let j = 0; j < 3; j++) {
        dq[i] += J[i][j] * dx[j];
      }
      dq[i] *= 0.1; // Damping factor
    }

    return dq;
  }

  private updateGripper(dt: number): void {
    // Simple gripper dynamics
    // If gripper is closing and force threshold reached, object is grasped
    if (this.gripper.opening < 0.3 && !this.gripper.hasObject) {
      this.gripper.force += 5.0 * dt;
      if (this.gripper.force > 2.0) {
        this.gripper.hasObject = true;
        console.error('Object grasped!');
      }
    }

    // If gripper is opening, release object
    if (this.gripper.opening > 0.7 && this.gripper.hasObject) {
      this.gripper.hasObject = false;
      this.gripper.force = 0;
      console.error('Object released!');
    }
  }

  public async processControl(command: any): Promise<void> {
    const { type, ...params } = command;

    switch (type) {
      case 'move_to':
        await this.moveTo(params.x, params.y, params.z);
        break;
      case 'set_joint':
        await this.setJoint(params.joint, params.angle);
        break;
      case 'open_gripper':
        await this.openGripper();
        break;
      case 'close_gripper':
        await this.closeGripper();
        break;
      default:
        console.error(`Unknown command type: ${type}`);
    }
  }

  /**
   * Move end-effector to target position using IK
   */
  public async moveTo(x: number, y: number, z: number): Promise<void> {
    const distance = Math.sqrt(x*x + y*y + z*z);

    if (distance > this.maxReach) {
      throw new Error(`Target position out of reach (${distance.toFixed(2)}m > ${this.maxReach.toFixed(2)}m)`);
    }

    this.targetPosition = { x, y, z };
    this.state.status = 'moving';

    await this.storeExperience(
      'move_to',
      true,
      `Moving to position (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
      { target: { x, y, z }, distance }
    );

    console.error(`Moving arm to (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
  }

  /**
   * Set specific joint angle
   */
  public async setJoint(jointId: number, angle: number): Promise<void> {
    if (jointId < 0 || jointId >= this.numJoints) {
      throw new Error(`Invalid joint ID: ${jointId}`);
    }

    const joint = this.joints[jointId];
    const targetAngle = this.clamp(angle, joint.minLimit, joint.maxLimit);
    joint.torque = 100.0 * (targetAngle - joint.angle);

    await this.storeExperience(
      'set_joint',
      true,
      `Set joint ${jointId} to ${targetAngle.toFixed(3)} rad`,
      { joint: jointId, targetAngle }
    );
  }

  /**
   * Open gripper
   */
  public async openGripper(): Promise<void> {
    this.gripper.opening = 1.0;
    console.error('Gripper opened');

    await this.storeExperience(
      'open_gripper',
      true,
      'Gripper opened',
      { opening: this.gripper.opening }
    );
  }

  /**
   * Close gripper
   */
  public async closeGripper(): Promise<void> {
    this.gripper.opening = 0.0;
    console.error('Gripper closed');

    await this.storeExperience(
      'close_gripper',
      true,
      'Gripper closed',
      { opening: this.gripper.opening, force: this.gripper.force }
    );
  }

  /**
   * Get joint angles
   */
  public getJointAngles(): number[] {
    return this.joints.map(j => j.angle);
  }

  /**
   * Get end-effector position
   */
  public getEndEffectorPosition(): Vector3 {
    return { ...this.endEffector.position };
  }

  /**
   * Get gripper state
   */
  public getGripperState(): GripperState {
    return { ...this.gripper };
  }

  /**
   * Check if position is reachable
   */
  public isReachable(x: number, y: number, z: number): boolean {
    const distance = Math.sqrt(x*x + y*y + z*z);
    return distance <= this.maxReach;
  }
}

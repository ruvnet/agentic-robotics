/**
 * Humanoid Robot - Bipedal humanoid with articulation
 *
 * Features:
 * - Multi-joint system (revolute and prismatic)
 * - Inverse kinematics for end-effector control
 * - Balance and stability control
 * - Gait generation for walking
 * - Center of mass tracking
 */

import { RobotBase, Vector3, Quaternion } from './base-robot.js';
import { ROS3McpServerConfig } from '../../npm/mcp/src/server.js';

export enum JointType {
  REVOLUTE = 'revolute',
  PRISMATIC = 'prismatic',
  FIXED = 'fixed',
}

export interface Joint {
  name: string;
  type: JointType;
  position: number; // rad for revolute, m for prismatic
  velocity: number;
  torque: number;
  minLimit: number;
  maxLimit: number;
  parentLink: string;
  childLink: string;
}

export interface Link {
  name: string;
  mass: number;
  position: Vector3;
  orientation: Quaternion;
  centerOfMass: Vector3;
}

export interface GaitPhase {
  phase: 'stance' | 'swing';
  foot: 'left' | 'right';
  progress: number; // 0-1
}

export class HumanoidRobot extends RobotBase {
  private joints: Map<string, Joint> = new Map();
  private links: Map<string, Link> = new Map();
  private centerOfMass: Vector3 = { x: 0, y: 0, z: 0 };
  private balanceError: number = 0;
  private gaitPhase: GaitPhase = { phase: 'stance', foot: 'left', progress: 0 };
  private gaitCycleDuration: number = 2.0; // seconds

  constructor(config: ROS3McpServerConfig = {}) {
    super({
      name: config.name || 'humanoid-robot',
      version: config.version || '1.0.0',
      dbPath: config.dbPath || './humanoid-robot.db',
    });

    this.updateRate = 100; // 100 Hz for humanoid control
  }

  protected async initializeRobot(): Promise<void> {
    // Initialize kinematic chain
    this.initializeKinematicChain();

    console.error('Humanoid robot initialized');
    console.error(`  Joints: ${this.joints.size}`);
    console.error(`  Links: ${this.links.size}`);
    console.error(`  Degrees of freedom: ${Array.from(this.joints.values()).filter(j => j.type !== JointType.FIXED).length}`);

    await this.storeExperience(
      'initialization',
      true,
      'Humanoid robot initialized with kinematic chain',
      { jointCount: this.joints.size, linkCount: this.links.size }
    );
  }

  private initializeKinematicChain(): void {
    // Torso
    this.addLink('base_link', 15.0, { x: 0, y: 0, z: 0.9 });
    this.addLink('torso', 20.0, { x: 0, y: 0, z: 1.2 });

    // Head
    this.addLink('head', 5.0, { x: 0, y: 0, z: 1.5 });
    this.addJoint('neck', JointType.REVOLUTE, 'torso', 'head', -Math.PI/4, Math.PI/4);

    // Left arm
    this.addLink('left_shoulder', 2.0, { x: 0, y: 0.2, z: 1.3 });
    this.addLink('left_upper_arm', 2.5, { x: 0, y: 0.4, z: 1.3 });
    this.addLink('left_forearm', 1.5, { x: 0, y: 0.65, z: 1.3 });
    this.addLink('left_hand', 0.5, { x: 0, y: 0.9, z: 1.3 });

    this.addJoint('left_shoulder_pitch', JointType.REVOLUTE, 'torso', 'left_shoulder', -Math.PI, Math.PI);
    this.addJoint('left_shoulder_roll', JointType.REVOLUTE, 'left_shoulder', 'left_upper_arm', -Math.PI/2, Math.PI/2);
    this.addJoint('left_elbow', JointType.REVOLUTE, 'left_upper_arm', 'left_forearm', 0, Math.PI);
    this.addJoint('left_wrist', JointType.REVOLUTE, 'left_forearm', 'left_hand', -Math.PI/2, Math.PI/2);

    // Right arm (mirror of left)
    this.addLink('right_shoulder', 2.0, { x: 0, y: -0.2, z: 1.3 });
    this.addLink('right_upper_arm', 2.5, { x: 0, y: -0.4, z: 1.3 });
    this.addLink('right_forearm', 1.5, { x: 0, y: -0.65, z: 1.3 });
    this.addLink('right_hand', 0.5, { x: 0, y: -0.9, z: 1.3 });

    this.addJoint('right_shoulder_pitch', JointType.REVOLUTE, 'torso', 'right_shoulder', -Math.PI, Math.PI);
    this.addJoint('right_shoulder_roll', JointType.REVOLUTE, 'right_shoulder', 'right_upper_arm', -Math.PI/2, Math.PI/2);
    this.addJoint('right_elbow', JointType.REVOLUTE, 'right_upper_arm', 'right_forearm', 0, Math.PI);
    this.addJoint('right_wrist', JointType.REVOLUTE, 'right_forearm', 'right_hand', -Math.PI/2, Math.PI/2);

    // Left leg
    this.addLink('left_hip', 3.0, { x: 0, y: 0.1, z: 0.85 });
    this.addLink('left_thigh', 5.0, { x: 0, y: 0.1, z: 0.5 });
    this.addLink('left_shin', 3.5, { x: 0, y: 0.1, z: 0.15 });
    this.addLink('left_foot', 1.0, { x: 0, y: 0.1, z: 0 });

    this.addJoint('left_hip_pitch', JointType.REVOLUTE, 'base_link', 'left_hip', -Math.PI/4, Math.PI/4);
    this.addJoint('left_hip_roll', JointType.REVOLUTE, 'left_hip', 'left_thigh', -Math.PI/6, Math.PI/6);
    this.addJoint('left_knee', JointType.REVOLUTE, 'left_thigh', 'left_shin', -Math.PI, 0);
    this.addJoint('left_ankle', JointType.REVOLUTE, 'left_shin', 'left_foot', -Math.PI/6, Math.PI/6);

    // Right leg (mirror of left)
    this.addLink('right_hip', 3.0, { x: 0, y: -0.1, z: 0.85 });
    this.addLink('right_thigh', 5.0, { x: 0, y: -0.1, z: 0.5 });
    this.addLink('right_shin', 3.5, { x: 0, y: -0.1, z: 0.15 });
    this.addLink('right_foot', 1.0, { x: 0, y: -0.1, z: 0 });

    this.addJoint('right_hip_pitch', JointType.REVOLUTE, 'base_link', 'right_hip', -Math.PI/4, Math.PI/4);
    this.addJoint('right_hip_roll', JointType.REVOLUTE, 'right_hip', 'right_thigh', -Math.PI/6, Math.PI/6);
    this.addJoint('right_knee', JointType.REVOLUTE, 'right_thigh', 'right_shin', -Math.PI, 0);
    this.addJoint('right_ankle', JointType.REVOLUTE, 'right_shin', 'right_foot', -Math.PI/6, Math.PI/6);
  }

  private addLink(name: string, mass: number, position: Vector3): void {
    this.links.set(name, {
      name,
      mass,
      position,
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      centerOfMass: position,
    });
  }

  private addJoint(
    name: string,
    type: JointType,
    parent: string,
    child: string,
    minLimit: number,
    maxLimit: number
  ): void {
    this.joints.set(name, {
      name,
      type,
      position: 0,
      velocity: 0,
      torque: 0,
      minLimit,
      maxLimit,
      parentLink: parent,
      childLink: child,
    });
  }

  protected async shutdownRobot(): Promise<void> {
    // Set all joints to zero velocity
    this.joints.forEach(joint => {
      joint.velocity = 0;
      joint.torque = 0;
    });
    console.error('Humanoid robot shutdown complete');
  }

  protected updateState(dt: number): void {
    // Update joint dynamics
    this.updateJointDynamics(dt);

    // Update forward kinematics
    this.updateForwardKinematics();

    // Calculate center of mass
    this.calculateCenterOfMass();

    // Update balance
    this.updateBalance(dt);

    // Update gait if walking
    if (this.state.status === 'moving') {
      this.updateGait(dt);
    }

    // Store sensor data
    this.storeSensorData('joint_states', this.getJointStates());
    this.storeSensorData('center_of_mass', this.centerOfMass);
    this.storeSensorData('balance_error', this.balanceError);
  }

  private updateJointDynamics(dt: number): void {
    this.joints.forEach(joint => {
      if (joint.type !== JointType.FIXED) {
        // Simple PD control
        const kp = 100.0;
        const kd = 10.0;
        const acceleration = (joint.torque - kd * joint.velocity) / kp;

        joint.velocity += acceleration * dt;
        joint.position += joint.velocity * dt;

        // Enforce joint limits
        joint.position = this.clamp(joint.position, joint.minLimit, joint.maxLimit);
      }
    });
  }

  private updateForwardKinematics(): void {
    // Simplified forward kinematics - update link positions based on joint angles
    // In production, this would use DH parameters or URDF
    this.links.forEach(link => {
      // Update link orientation and position based on parent joints
      // (Simplified - would need proper kinematic chain traversal)
    });
  }

  private calculateCenterOfMass(): void {
    let totalMass = 0;
    let comX = 0, comY = 0, comZ = 0;

    this.links.forEach(link => {
      totalMass += link.mass;
      comX += link.position.x * link.mass;
      comY += link.position.y * link.mass;
      comZ += link.position.z * link.mass;
    });

    this.centerOfMass = {
      x: comX / totalMass,
      y: comY / totalMass,
      z: comZ / totalMass,
    };
  }

  private updateBalance(dt: number): void {
    // Calculate balance error (distance from CoM to support polygon)
    const supportPolygonY = this.gaitPhase.foot === 'left' ? 0.1 : -0.1;
    this.balanceError = Math.abs(this.centerOfMass.y - supportPolygonY);

    // Apply balance control
    if (this.balanceError > 0.05) {
      // Adjust hip roll to maintain balance
      const hipRollJoint = this.gaitPhase.foot === 'left' ? 'left_hip_roll' : 'right_hip_roll';
      const joint = this.joints.get(hipRollJoint);
      if (joint) {
        const correctionTorque = -10.0 * this.balanceError;
        joint.torque += correctionTorque;
      }
    }
  }

  private updateGait(dt: number): void {
    this.gaitPhase.progress += dt / this.gaitCycleDuration;

    if (this.gaitPhase.progress >= 1.0) {
      // Switch phase
      this.gaitPhase.progress = 0;
      this.gaitPhase.foot = this.gaitPhase.foot === 'left' ? 'right' : 'left';
      this.gaitPhase.phase = this.gaitPhase.phase === 'stance' ? 'swing' : 'stance';
    }

    // Generate gait trajectory
    this.generateGaitTrajectory();
  }

  private generateGaitTrajectory(): void {
    const t = this.gaitPhase.progress;
    const swingHeight = 0.05; // 5cm lift

    // Simplified gait: sinusoidal trajectory
    const hipPitch = 0.2 * Math.sin(2 * Math.PI * t);
    const kneeFlex = 0.4 * Math.sin(2 * Math.PI * t);

    const legPrefix = this.gaitPhase.foot;
    const hipJoint = this.joints.get(`${legPrefix}_hip_pitch`);
    const kneeJoint = this.joints.get(`${legPrefix}_knee`);

    if (hipJoint) hipJoint.torque = 50.0 * (hipPitch - hipJoint.position);
    if (kneeJoint) kneeJoint.torque = 50.0 * (kneeFlex - kneeJoint.position);
  }

  public async processControl(command: any): Promise<void> {
    const { type, ...params } = command;

    switch (type) {
      case 'walk':
        await this.walk(params.speed || 0.5);
        break;
      case 'set_joint':
        await this.setJoint(params.joint, params.position);
        break;
      case 'reach':
        await this.reachTo(params.x, params.y, params.z, params.hand || 'right');
        break;
      default:
        console.error(`Unknown command type: ${type}`);
    }
  }

  private async walk(speed: number): Promise<void> {
    this.state.status = 'moving';
    this.gaitCycleDuration = 2.0 / speed;

    await this.storeExperience(
      'walk',
      true,
      `Walking at speed ${speed.toFixed(2)}`,
      { speed, gaitCycleDuration: this.gaitCycleDuration }
    );
  }

  private async setJoint(jointName: string, position: number): Promise<void> {
    const joint = this.joints.get(jointName);
    if (!joint) {
      throw new Error(`Joint ${jointName} not found`);
    }

    const targetPos = this.clamp(position, joint.minLimit, joint.maxLimit);
    joint.torque = 100.0 * (targetPos - joint.position);

    await this.storeExperience(
      'set_joint',
      true,
      `Set joint ${jointName} to ${targetPos.toFixed(3)}`,
      { joint: jointName, targetPosition: targetPos }
    );
  }

  /**
   * Inverse kinematics to reach target position
   */
  private async reachTo(x: number, y: number, z: number, hand: 'left' | 'right'): Promise<void> {
    // Simplified IK - in production would use proper IK solver (CCD, Jacobian, etc.)
    const handLink = hand === 'left' ? 'left_hand' : 'right_hand';
    const link = this.links.get(handLink);

    if (link) {
      const dx = x - link.position.x;
      const dy = y - link.position.y;
      const dz = z - link.position.z;

      // Simple reaching behavior
      const shoulderPitch = this.joints.get(`${hand}_shoulder_pitch`);
      const elbowJoint = this.joints.get(`${hand}_elbow`);

      if (shoulderPitch && elbowJoint) {
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const targetShoulderAngle = Math.atan2(dz, Math.sqrt(dx*dx + dy*dy));
        const targetElbowAngle = Math.acos(Math.min(1, distance / 0.5)); // Simplified

        shoulderPitch.torque = 50.0 * (targetShoulderAngle - shoulderPitch.position);
        elbowJoint.torque = 50.0 * (targetElbowAngle - elbowJoint.position);
      }

      await this.storeExperience(
        'reach',
        true,
        `Reaching to (${x}, ${y}, ${z}) with ${hand} hand`,
        { x, y, z, hand, error: Math.sqrt(dx*dx + dy*dy + dz*dz) }
      );
    }
  }

  public getJointStates(): { [key: string]: Joint } {
    const states: { [key: string]: Joint } = {};
    this.joints.forEach((joint, name) => {
      states[name] = { ...joint };
    });
    return states;
  }

  public getCenterOfMass(): Vector3 {
    return { ...this.centerOfMass };
  }

  public getBalanceError(): number {
    return this.balanceError;
  }
}

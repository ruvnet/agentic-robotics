/**
 * Robot Types Index
 *
 * Exports all robot simulation types for the ROS3 Agentic Robotics system.
 * Each robot type extends the base ROS3McpServer and includes:
 * - State management
 * - Control interfaces
 * - Sensor integration
 * - AgentDB memory for learning
 */

// Base robot class
export { RobotBase, RobotState, Vector3, Quaternion, SensorData } from './base-robot.js';

// Wheeled robot (differential drive)
export {
  WheeledRobot,
  WheeledRobotConfig,
  WheelState,
  DifferentialDriveCommand,
} from './wheeled-robot.js';

// Humanoid robot (bipedal with articulation)
export {
  HumanoidRobot,
  Joint,
  JointType,
  Link,
  GaitPhase,
} from './humanoid-robot.js';

// Drone robot (quadcopter)
export {
  DroneRobot,
  DroneConfig,
  RotorState,
  IMUData,
  FlightCommand,
} from './drone-robot.js';

// Robotic arm (manipulator)
export {
  RoboticArm,
  RoboticArmConfig,
  ArmJoint,
  DHParameters,
  EndEffector,
  GripperState,
} from './robotic-arm.js';

/**
 * Robot type enumeration for easy selection
 */
export enum RobotType {
  WHEELED = 'wheeled',
  HUMANOID = 'humanoid',
  DRONE = 'drone',
  ARM = 'arm',
}

/**
 * Factory function to create robot instances
 */
export function createRobot(type: RobotType, config?: any): RobotBase {
  switch (type) {
    case RobotType.WHEELED:
      return new WheeledRobot(config);
    case RobotType.HUMANOID:
      return new HumanoidRobot(config);
    case RobotType.DRONE:
      return new DroneRobot(config);
    case RobotType.ARM:
      return new RoboticArm(config);
    default:
      throw new Error(`Unknown robot type: ${type}`);
  }
}

/**
 * Get available robot types
 */
export function getAvailableRobotTypes(): RobotType[] {
  return [
    RobotType.WHEELED,
    RobotType.HUMANOID,
    RobotType.DRONE,
    RobotType.ARM,
  ];
}

/**
 * Get robot type description
 */
export function getRobotDescription(type: RobotType): string {
  const descriptions = {
    [RobotType.WHEELED]: 'Mobile rover with differential drive, odometry, and collision detection',
    [RobotType.HUMANOID]: 'Bipedal humanoid with multi-joint system, kinematics, and gait generation',
    [RobotType.DRONE]: 'Quadcopter with 6-DOF flight dynamics, IMU, and battery simulation',
    [RobotType.ARM]: 'Multi-DOF manipulator with forward/inverse kinematics and gripper',
  };

  return descriptions[type] || 'Unknown robot type';
}

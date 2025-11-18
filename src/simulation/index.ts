/**
 * Simulation Framework - Export all components
 *
 * Core simulation system for agentic-robotics with:
 * - Physics engine with collision detection
 * - Environment management (obstacles, terrain, lighting)
 * - Sensor simulation (LiDAR, Camera, IMU, Proximity)
 * - Real-time simulation with configurable time management
 * - Coordinate frame transformations
 * - Event-driven architecture
 * - ROS3McpServer integration support
 */

// Physics Engine
export {
  Vector3D,
  Quaternion,
  Pose,
  Velocity,
  Force,
  CollisionShape,
  RigidBodyConfig,
  RigidBody,
  CollisionInfo,
  CollisionDetector,
  PhysicsConfig,
  PhysicsEngine,
  VectorMath,
  QuaternionMath
} from './physics-engine';

// Environment
export {
  Color,
  Material,
  ObstacleConfig,
  Obstacle,
  TerrainConfig,
  Terrain,
  LightConfig,
  Light,
  EnvironmentConfig,
  Environment,
  EnvironmentPresets
} from './environment';

// Sensors
export {
  SensorConfig,
  LidarConfig,
  LidarScan,
  LidarSimulator,
  CameraConfig,
  CameraImage,
  CameraSimulator,
  IMUConfig,
  IMUData,
  IMUSimulator,
  ProximityConfig,
  ProximityData,
  ProximitySensor,
  SensorSimulator
} from './sensor-simulator';

// Base Simulator
export {
  CoordinateFrame,
  Transform,
  CoordinateFrameManager,
  TimeMode,
  TimeConfig,
  TimeManager,
  SimulationConfig,
  SimulationState,
  SimulationEvents,
  BaseSimulator
} from './base-simulator';

// Re-export commonly used types
export type {
  Vector3D as Vec3,
  Quaternion as Quat,
  Pose as RobotPose
} from './physics-engine';

/**
 * Example Usage:
 *
 * ```typescript
 * import { BaseSimulator, EnvironmentPresets, RigidBody } from './simulation';
 *
 * // Create simulator
 * const sim = new BaseSimulator({
 *   updateRate: 100, // 100Hz
 *   physics: {
 *     gravity: { x: 0, y: 0, z: -9.81 },
 *     timestep: 0.01
 *   },
 *   environment: EnvironmentPresets.obstacleCourseName(),
 *   time: {
 *     mode: 'realtime'
 *   }
 * });
 *
 * // Add robot
 * const robotBody = new RigidBody({
 *   id: 'robot1',
 *   mass: 10,
 *   inertia: { x: 1, y: 1, z: 1 },
 *   collisionShape: { type: 'box', dimensions: { x: 0.5, y: 0.3, z: 0.2 } },
 *   restitution: 0.3,
 *   friction: 0.8,
 *   linearDamping: 0.1,
 *   angularDamping: 0.1,
 *   isStatic: false
 * });
 *
 * sim.addRobot('robot1', robotBody);
 *
 * // Add LiDAR sensor
 * sim.addSensor({
 *   id: 'lidar1',
 *   type: 'lidar',
 *   mountPose: {
 *     position: { x: 0, y: 0, z: 0.2 },
 *     orientation: { x: 0, y: 0, z: 0, w: 1 }
 *   },
 *   updateRate: 10,
 *   enabled: true,
 *   range: 10,
 *   fov: Math.PI,
 *   resolution: 360
 * });
 *
 * // Start simulation
 * sim.start();
 *
 * // Listen to events
 * sim.on('step', (deltaTime) => {
 *   console.log('Simulation step:', deltaTime);
 * });
 * ```
 */

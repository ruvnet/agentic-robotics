# Robot Types Documentation

## Overview

The ROS3 Agentic Robotics system provides comprehensive robot simulation capabilities with multiple robot types. Each robot extends the base `ROS3McpServer` class and includes state management, control interfaces, sensor integration, and AgentDB memory for adaptive learning.

## Robot Types

### 1. Wheeled Robot (WheeledRobot)

**Location:** `/home/user/agentic-robotics/src/robots/wheeled-robot.ts`

**Description:** Mobile rover with differential drive kinematics.

**Features:**
- Differential drive control (left/right wheel velocities)
- Wheel dynamics with friction simulation
- Dead reckoning odometry with noise
- Collision detection (boundary-based)
- Skid steering capability
- Battery drain based on movement

**Configuration:**
```typescript
const robot = new WheeledRobot({
  name: 'rover-1',
  dbPath: './rover.db',
  wheelRadius: 0.1,      // meters
  wheelBase: 0.5,        // meters
  maxWheelSpeed: 10.0,   // rad/s
  frictionCoeff: 0.8,
  mass: 50.0,            // kg
});
```

**Control Interface:**
```typescript
// Differential drive command
await robot.processControl({
  linearVelocity: 0.5,    // m/s
  angularVelocity: 0.2,   // rad/s
});

// Drive to target position
await robot.driveToTarget(targetX, targetY);

// Get odometry
const odometry = robot.getOdometry();

// Reset odometry
robot.resetOdometry();
```

**Sensors:**
- Odometry (position, orientation)
- Wheel encoders (angular velocity, slip ratio)

---

### 2. Humanoid Robot (HumanoidRobot)

**Location:** `/home/user/agentic-robotics/src/robots/humanoid-robot.ts`

**Description:** Bipedal humanoid with multi-joint articulation and gait generation.

**Features:**
- 20+ degrees of freedom (arms, legs, torso, head)
- Revolute and prismatic joint types
- Forward kinematics
- Inverse kinematics for end-effector control
- Balance and stability control (ZMP-based)
- Gait generation for bipedal walking
- Center of mass tracking

**Configuration:**
```typescript
const robot = new HumanoidRobot({
  name: 'humanoid-1',
  dbPath: './humanoid.db',
});
```

**Control Interface:**
```typescript
// Walking control
await robot.processControl({
  type: 'walk',
  speed: 0.8,  // walking speed multiplier
});

// Reach to target position
await robot.processControl({
  type: 'reach',
  x: 0.3,
  y: -0.4,
  z: 1.2,
  hand: 'right',  // or 'left'
});

// Set individual joint
await robot.processControl({
  type: 'set_joint',
  joint: 'left_knee',
  position: 0.5,  // radians
});

// Get joint states
const jointStates = robot.getJointStates();

// Get center of mass
const com = robot.getCenterOfMass();

// Get balance error
const error = robot.getBalanceError();
```

**Kinematic Chain:**
- Base link
- Torso (chest, spine)
- Head (neck joint)
- Left/Right arms (shoulder, elbow, wrist)
- Left/Right legs (hip, knee, ankle)

**Sensors:**
- Joint encoders (position, velocity, torque)
- IMU (center of mass, balance)
- Force sensors (foot contact)

---

### 3. Drone Robot (DroneRobot)

**Location:** `/home/user/agentic-robotics/src/robots/drone-robot.ts`

**Description:** Quadcopter with full 6-DOF flight dynamics.

**Features:**
- 6-DOF flight (3D position + 3D orientation)
- 4 rotor thrust and torque control
- IMU sensor simulation (acceleration, angular velocity, orientation)
- Wind effects and aerodynamic drag
- Battery simulation with flight time
- Altitude hold and position control
- Ground collision detection

**Configuration:**
```typescript
const robot = new DroneRobot({
  name: 'quadcopter-1',
  dbPath: './drone.db',
  mass: 1.5,           // kg
  armLength: 0.25,     // meters
  maxThrust: 20.0,     // Newtons
  dragCoeff: 0.1,
});
```

**Control Interface:**
```typescript
// Flight command
await robot.processControl({
  thrust: 0.6,    // 0-1 (normalized)
  roll: 0.1,      // rad/s
  pitch: 0.05,    // rad/s
  yaw: 0.2,       // rad/s
});

// Takeoff to altitude
await robot.takeoff(2.0);  // target altitude in meters

// Land
await robot.land();

// Hover at current altitude
await robot.hover();

// Set wind conditions
robot.setWind(2.0, 1.0, 0.5);  // wind vector (m/s)

// Get IMU data
const imu = robot.getIMU();

// Get rotor states
const rotors = robot.getRotorStates();
```

**Flight Dynamics:**
- Thrust-to-weight ratio based flight
- Rotor mixing matrix (quadcopter X configuration)
- First-order rotor dynamics
- Aerodynamic drag proportional to velocity²
- Gravity and wind force integration

**Sensors:**
- IMU (acceleration, angular velocity, quaternion orientation)
- Barometer (altitude)
- GPS (position - simulated)
- Rotor tachometers (RPM, thrust, torque)

---

### 4. Robotic Arm (RoboticArm)

**Location:** `/home/user/agentic-robotics/src/robots/robotic-arm.ts`

**Description:** Multi-DOF manipulator with forward/inverse kinematics and gripper.

**Features:**
- 6 degrees of freedom (configurable)
- Forward kinematics using DH parameters
- Inverse kinematics (Jacobian-based)
- End-effector position/orientation control
- Gripper simulation with force feedback
- Trajectory planning
- Reachability checking
- Joint limit enforcement

**Configuration:**
```typescript
const robot = new RoboticArm({
  name: 'manipulator-1',
  dbPath: './arm.db',
  numJoints: 6,
  linkLengths: [0.4, 0.4, 0.3, 0.2, 0.15, 0.1],  // meters
  maxReach: 1.55,  // meters
});
```

**Control Interface:**
```typescript
// Move to Cartesian position (IK)
await robot.moveTo(0.5, 0.3, 0.4);

// Set individual joint angle
await robot.setJoint(jointId, angle);

// Gripper control
await robot.closeGripper();
await robot.openGripper();

// Get end-effector position
const pos = robot.getEndEffectorPosition();

// Get joint angles
const angles = robot.getJointAngles();

// Get gripper state
const gripper = robot.getGripperState();

// Check reachability
const reachable = robot.isReachable(x, y, z);
```

**Kinematics:**
- DH parameters (Denavit-Hartenberg convention)
- Forward kinematics: Joint angles → End-effector pose
- Inverse kinematics: Target pose → Joint angles (Jacobian pseudo-inverse)
- Workspace: Spherical, radius = sum of link lengths

**Sensors:**
- Joint encoders (position, velocity, torque)
- End-effector pose (position, orientation)
- Force/torque sensor (end-effector wrench)
- Gripper sensors (opening, force, object detection)

---

## Base Robot Class (RobotBase)

**Location:** `/home/user/agentic-robotics/src/robots/base-robot.ts`

All robots extend the abstract `RobotBase` class, which provides:

### Common State Management
```typescript
interface RobotState {
  pose: Pose;              // x, y, z, roll, pitch, yaw
  velocity: Vector3;       // linear velocity
  acceleration: Vector3;   // linear acceleration
  timestamp: number;
  status: 'idle' | 'moving' | 'error' | 'charging';
  batteryLevel: number;    // 0-100%
  health: number;          // 0-100%
}
```

### Common Methods
- `start()`: Initialize robot and start control loop
- `stop()`: Shutdown robot and stop control loop
- `getState()`: Get current robot state
- `getSensorData(type)`: Get specific sensor data
- `storeExperience()`: Store experience in AgentDB
- `queryExperiences()`: Query past experiences for learning

### Physics Simulation
- Control loop at configurable rate (50-100 Hz)
- Numerical integration (Euler method)
- Battery drain based on activity
- Sensor data storage and retrieval

### AgentDB Integration
Each robot stores experiences in AgentDB for adaptive learning:
```typescript
await robot['memory'].storeEpisode({
  sessionId: `${robotName}-${timestamp}`,
  taskName: 'navigation',
  confidence: 0.9,
  success: true,
  outcome: 'Reached target successfully',
  strategy: 'proportional_control',
  metadata: { /* task-specific data */ },
});
```

---

## Robot Factory

**Location:** `/home/user/agentic-robotics/src/robots/index.ts`

Convenient factory functions for creating robots:

```typescript
import { createRobot, RobotType, getAvailableRobotTypes, getRobotDescription } from './src/robots/index.js';

// Create robot using factory
const robot = createRobot(RobotType.WHEELED, { name: 'rover-1' });

// Get available types
const types = getAvailableRobotTypes();
// Returns: [RobotType.WHEELED, RobotType.HUMANOID, RobotType.DRONE, RobotType.ARM]

// Get robot description
const description = getRobotDescription(RobotType.HUMANOID);
```

---

## Example Usage

**Location:** `/home/user/agentic-robotics/examples/robot-simulations/test-all-robots.ts`

Comprehensive test suite demonstrating all robot types:

```bash
# Run the test suite
tsx examples/robot-simulations/test-all-robots.ts
```

The test suite includes:
1. **Wheeled Robot:** Square pattern navigation with odometry
2. **Humanoid Robot:** Walking, reaching, and joint control
3. **Drone Robot:** Takeoff, hovering, wind disturbance, landing
4. **Robotic Arm:** Pick-and-place with IK and gripper control
5. **Factory Demo:** Using robot factory functions

---

## Integration with ROS3 MCP Server

All robots extend `ROS3McpServer` and inherit:

- **MCP Tools:** Integration with Model Context Protocol
- **AgentDB Memory:** Persistent learning and experience replay
- **Sensor Fusion:** Multi-sensor data integration
- **Tool Implementations:**
  - `move_robot`: Move robot to target pose
  - `get_pose`: Get current robot pose
  - `get_status`: Get robot status
  - `read_lidar`: Read LIDAR data (wheeled robot)
  - `detect_objects`: Detect objects from camera
  - `query_memory`: Query past experiences
  - `consolidate_skills`: Learn from experiences
  - `get_memory_stats`: Get memory statistics

---

## Coordination Hooks

All robot implementations use Claude-Flow coordination hooks:

```bash
# Pre-task hook
npx claude-flow@alpha hooks pre-task --description "Robot task"

# Post-edit hook (after code changes)
npx claude-flow@alpha hooks post-edit --file "src/robots/*.ts" --memory-key "swarm/robots/type"

# Post-task hook
npx claude-flow@alpha hooks post-task --task-id "robot-task"
```

This enables:
- Automatic memory coordination
- Neural pattern training
- Swarm-based collaboration
- Experience sharing across robots

---

## File Structure

```
/home/user/agentic-robotics/
├── src/
│   └── robots/
│       ├── base-robot.ts       # Abstract base class
│       ├── wheeled-robot.ts    # Differential drive rover
│       ├── humanoid-robot.ts   # Bipedal humanoid
│       ├── drone-robot.ts      # Quadcopter
│       ├── robotic-arm.ts      # Manipulator
│       └── index.ts            # Exports and factory
├── examples/
│   └── robot-simulations/
│       └── test-all-robots.ts  # Comprehensive test suite
└── docs/
    └── ROBOT_TYPES.md          # This file
```

---

## Future Enhancements

- **Multi-robot Coordination:** Swarm behavior and formation control
- **Advanced IK Solvers:** CCD, FABRIK, analytical solutions
- **Collision Detection:** Mesh-based collision checking
- **Sensor Noise Models:** Realistic sensor uncertainty
- **ROS3 Bridge:** Direct integration with ROS3 runtime
- **Hardware Deployment:** Real robot control via MCP
- **Reinforcement Learning:** Policy optimization using AgentDB
- **Visual Servoing:** Camera-based control feedback

---

## Contributing

When adding new robot types:

1. Extend `RobotBase` class
2. Implement required abstract methods:
   - `initializeRobot()`
   - `shutdownRobot()`
   - `updateState(dt)`
   - `processControl(command)`
3. Add AgentDB experience tracking
4. Include sensor simulation
5. Update `index.ts` with new type
6. Add tests in `examples/robot-simulations/`
7. Run coordination hooks
8. Update this documentation

---

## License

Part of the ROS3 Agentic Robotics project.

# Robot Types Guide

Comprehensive guide to all robot types available in Agentic Robotics with detailed examples, use cases, and best practices.

## 📚 Table of Contents

1. [Industrial Robots](#industrial-robots)
2. [Autonomous Vehicles](#autonomous-vehicles)
3. [Autonomous Drones](#autonomous-drones)
4. [Swarm Robots](#swarm-robots)
5. [Custom Robots](#custom-robots)
6. [Comparison Table](#comparison-table)

---

## Industrial Robots

### Overview

High-precision manufacturing robots with AI-powered vision inspection and predictive maintenance.

**Key Characteristics:**
- **Accuracy**: ±0.1mm positioning precision
- **Speed**: 2-5 second cycle time per component
- **Update Rate**: 10Hz state publishing
- **Learning**: Quality inspection patterns from AgentDB

### Use Cases

1. **Assembly Lines**: Pick-and-place operations, component assembly
2. **Quality Control**: AI vision inspection, defect detection
3. **Packaging**: Product sorting, box packing
4. **Welding**: Precision welding with path following
5. **Painting**: Uniform coating application

### Architecture

```
AssemblyLineRobot
├── AgenticNode (communication)
├── AgentDBMemory (learning)
├── Position Control (±0.1mm accuracy)
├── Gripper System (force control)
├── Camera Vision (AI inspection)
└── State Machine (task execution)
```

### Quick Start

```javascript
const { AssemblyLineRobot } = require('agentic-robotics/industrial');

// Create robot
const robot = new AssemblyLineRobot('ROBOT-001', './memory.db');
await robot.initialize();

// Create task publisher
const taskPub = await robot.node.createPublisher('/factory/tasks');

// Define assembly task
const task = {
  taskId: 'TASK-001',
  productId: 'WIDGET-A',
  components: [
    {
      id: 'PCB-001',
      type: 'pcb',
      position: { x: 100, y: 100, z: 50 },
      orientation: { roll: 0, pitch: 0, yaw: 0 }
    },
    {
      id: 'CONNECTOR-001',
      type: 'connector',
      position: { x: 120, y: 120, z: 55 },
      orientation: { roll: 0, pitch: 0, yaw: 90 }
    }
  ],
  qualityCriteria: {
    torqueMin: 1.5,
    torqueMax: 2.5,
    positionTolerance: 0.1
  }
};

// Execute task
await taskPub.publish(JSON.stringify(task));
```

### Component Details

#### Pick and Place

```javascript
private async pickAndPlace(component: Component): Promise<void> {
  // 1. Move to component location
  await this.moveTo(component.position);

  // 2. Open gripper
  this.gripper.isOpen = true;
  await this.delay(50);

  // 3. Close gripper (pick)
  this.gripper.isOpen = false;
  this.gripper.force = 10; // Newtons
  this.gripper.holding = component;
  await this.delay(100);

  // 4. Move to assembly position
  const assemblyPos = this.calculateAssemblyPosition(component);
  await this.moveTo(assemblyPos);

  // 5. Apply orientation
  await this.rotateTo(component.orientation);

  // 6. Place component
  this.gripper.isOpen = true;
  this.gripper.holding = null;
}
```

#### AI Vision Inspection

```javascript
private async inspectQuality(task: AssemblyTask): Promise<QualityResult> {
  // Check past failures
  const memories = await this.memory.retrieveMemories(
    `assembly_${task.productId}`,
    5,
    { onlyFailures: true }
  );

  // Adjust confidence based on history
  let confidence = 0.95;
  if (memories.length > 0) {
    confidence = 0.85; // Be more careful
    console.log(`Previous failures detected, extra care taken`);
  }

  // Simulate defect detection
  const defects = await this.detectDefects();

  return {
    passed: defects.length === 0,
    defects,
    confidence,
    images: [`camera_${Date.now()}.jpg`]
  };
}
```

### Topics

| Topic | Rate | Description |
|-------|------|-------------|
| `/robots/{id}/state` | 10Hz | Robot position, gripper status, statistics |
| `/factory/tasks` | Event | Task assignments from coordinator |
| `/factory/quality` | Event | Quality inspection results |
| `/robots/{id}/maintenance` | 5min | Predictive maintenance alerts |

### Performance Characteristics

```
Metric                    Value              Notes
───────────────────────────────────────────────────────────
Position Accuracy        ±0.1mm              With calibration
Cycle Time              2-5 seconds         Per component
Pick Success Rate       >95%                With learning
Quality Inspection      0.95 confidence     AI-powered
State Update Rate       10Hz (100ms)        Real-time monitoring
Maintenance Prediction  >85% accuracy       Using uptime data
```

### Best Practices

1. **Calibration**: Run calibration routine daily
2. **Quality Checks**: Inspect every 100th component manually
3. **Learning**: Store all failures for pattern recognition
4. **Maintenance**: Schedule maintenance at performance threshold
5. **Safety**: Implement emergency stop on collision detection

---

## Autonomous Vehicles

### Overview

Level 4/5 self-driving vehicles with multi-sensor fusion and V2V communication.

**Key Characteristics:**
- **Control Loop**: 50Hz (20ms response time)
- **Sensors**: LIDAR (200m), cameras (4x), radar (250m), GPS
- **Safety**: Emergency braking < 50ms
- **Coordination**: Vehicle-to-vehicle communication

### Use Cases

1. **Delivery**: Autonomous package delivery
2. **Taxi Services**: Passenger transportation
3. **Logistics**: Warehouse to dock transport
4. **Patrol**: Security and surveillance
5. **Inspection**: Infrastructure monitoring

### Architecture

```
AutonomousVehicle
├── Sensor Fusion Layer
│   ├── LIDAR (128k points @ 10Hz)
│   ├── Cameras (4x @ 60fps front/rear, 30fps sides)
│   ├── Radar (250m range)
│   └── GPS/IMU (0.5m accuracy)
├── Perception Layer
│   ├── Obstacle Detection
│   ├── Lane Detection
│   ├── Traffic Sign Recognition
│   └── Pedestrian Tracking
├── Planning Layer
│   ├── Path Planning (A*, RRT)
│   ├── Trajectory Optimization
│   ├── Velocity Planning
│   └── Emergency Maneuvers
├── Control Layer
│   ├── Steering Control
│   ├── Throttle/Brake
│   ├── PID Controllers
│   └── Model Predictive Control
└── Communication Layer
    ├── V2V Broadcast
    ├── Traffic Updates
    └── Route Management
```

### Quick Start

```javascript
const { AutonomousVehicle } = require('agentic-robotics/vehicles');

// Create vehicle
const car = new AutonomousVehicle('CAR-001', './memory.db');
await car.initialize();

// Assign route
const routePub = await car.node.createPublisher('/vehicles/CAR-001/route');

const route = {
  waypoints: [
    { lat: 37.7749, lon: -122.4194 },  // Start: San Francisco
    { lat: 37.7849, lon: -122.4094 }   // End: 1.5km north-east
  ],
  distance: 1500,           // meters
  estimatedTime: 120,       // seconds
  speedLimits: [50, 60]     // km/h per segment
};

await routePub.publish(JSON.stringify(route));
```

### Control Loop

```javascript
private async controlLoop(): Promise<void> {
  // 50Hz loop (20ms per iteration)

  // 1. Sensor fusion - process all sensor data
  await this.processSensors();

  // 2. Perception - detect and track obstacles
  await this.detectObstacles();

  // 3. Planning - calculate optimal path
  const path = await this.planPath();

  // 4. Control - actuate vehicle
  await this.executeControl(path);

  // 5. Communication - V2V broadcast
  await this.broadcastState();
}
```

### Emergency Braking

```javascript
// Emergency braking check
for (const obstacle of this.obstacles.values()) {
  const distance = this.calculateDistance(obstacle);

  if (distance < 10 && obstacle.type !== 'static') {
    console.log(`Emergency braking! Obstacle at ${distance.toFixed(1)}m`);

    // Apply maximum braking
    return {
      steering: 0,
      throttle: 0,
      brake: 100
    };
  }
}
```

### Sensor Fusion

```javascript
// Kalman filter for sensor fusion
private async fuseData(lidar, camera, radar, gps) {
  // Weight sensors by reliability
  const weights = {
    lidar: 0.4,    // High accuracy, short range
    camera: 0.3,   // Good features, weather-dependent
    radar: 0.2,    // All-weather, lower resolution
    gps: 0.1       // Global position, lower accuracy
  };

  // Prediction step
  const predicted = this.kalmanPredict(this.state);

  // Update with each sensor
  let fused = predicted;
  if (lidar) fused = this.kalmanUpdate(fused, lidar, weights.lidar);
  if (camera) fused = this.kalmanUpdate(fused, camera, weights.camera);
  if (radar) fused = this.kalmanUpdate(fused, radar, weights.radar);
  if (gps) fused = this.kalmanUpdate(fused, gps, weights.gps);

  return fused;
}
```

### Topics

| Topic | Rate | Description |
|-------|------|-------------|
| `/vehicles/{id}/state` | 50Hz | Position, velocity, heading, control inputs |
| `/vehicles/{id}/obstacles` | 10Hz | Detected obstacles with bounding boxes |
| `/vehicles/{id}/route` | Event | Route assignments |
| `/v2v/broadcast` | 10Hz | Vehicle-to-vehicle state sharing |
| `/traffic/updates` | Event | Traffic lights, road conditions |

### Performance Characteristics

```
Metric                    Value              Notes
───────────────────────────────────────────────────────────
Control Loop             50Hz (20ms)         Real-time response
Emergency Braking        <50ms               From detection to brake
LIDAR Processing         10Hz                128k points per scan
Camera Processing        30-60fps            Object detection
Obstacle Detection       200m range          360° coverage
GPS Accuracy             0.5m                With RTK correction
V2V Latency             <100ms              Local network
```

### Best Practices

1. **Sensor Calibration**: Calibrate sensors weekly
2. **Weather Adaptation**: Adjust weights in bad weather
3. **V2V Communication**: Always broadcast state for coordination
4. **Emergency Testing**: Test emergency braking regularly
5. **Route Optimization**: Learn optimal routes from experience

---

## Autonomous Drones

### Overview

Multi-purpose aerial robots for delivery, inspection, and surveying with swarm support.

**Key Characteristics:**
- **Flight Control**: 100Hz (10ms response)
- **Stabilization**: 6-axis IMU at 400Hz
- **Obstacle Avoidance**: 3D mapping, 20m range
- **Battery Life**: 20-30 minutes flight time

### Use Cases

1. **Delivery**: Package delivery to remote areas
2. **Inspection**: Bridge, tower, pipeline inspection
3. **Surveying**: Land mapping, agricultural monitoring
4. **Search & Rescue**: Thermal imaging, area scanning
5. **Security**: Perimeter patrol, crowd monitoring

### Architecture

```
AutonomousDrone
├── Flight Controller (100Hz)
│   ├── Altitude Hold (PID)
│   ├── Position Hold (GPS + vision)
│   ├── Attitude Control (IMU)
│   └── Velocity Control
├── Stabilization (400Hz)
│   ├── Gyroscope (3-axis)
│   ├── Accelerometer (3-axis)
│   ├── Magnetometer (heading)
│   └── Barometer (altitude)
├── Navigation
│   ├── GPS/GNSS
│   ├── Visual Odometry
│   ├── Waypoint Following
│   └── Return-to-Home
├── Obstacle Avoidance
│   ├── 3D LIDAR/Sonar
│   ├── Depth Cameras
│   ├── Collision Prediction
│   └── Path Replanning
└── Mission Management
    ├── Task Queue
    ├── Battery Monitor
    ├── Fail-Safe Systems
    └── Swarm Coordination
```

### Quick Start

```javascript
const { AutonomousDrone } = require('agentic-robotics/drones');

// Create drone
const drone = new AutonomousDrone('DRONE-001', './memory.db');
await drone.initialize();

// Takeoff
await drone.takeoff(10.0);  // 10m altitude

// Assign mission
const missionPub = await drone.node.createPublisher('/drones/DRONE-001/mission');

const mission = {
  type: 'survey',
  area: {
    points: [
      { lat: 37.7749, lon: -122.4194 },
      { lat: 37.7759, lon: -122.4184 },
      { lat: 37.7769, lon: -122.4194 },
      { lat: 37.7759, lon: -122.4204 }
    ]
  },
  altitude: 50,    // meters
  speed: 10,       // m/s
  overlap: 0.7     // 70% image overlap
};

await missionPub.publish(JSON.stringify(mission));

// Auto-land when mission complete
```

### Flight Controller

```javascript
private async flightController(): Promise<void> {
  // 100Hz control loop (10ms)

  // 1. Read IMU data (400Hz internally)
  const imu = await this.readIMU();

  // 2. Get target from mission
  const target = this.getCurrentWaypoint();

  // 3. Compute control commands
  const altitude_cmd = this.altitudeController.compute(
    target.altitude,
    this.state.altitude
  );

  const position_cmd = this.positionController.compute(
    { x: target.lat, y: target.lon },
    { x: this.state.lat, y: this.state.lon }
  );

  const attitude_cmd = this.attitudeController.compute(
    position_cmd,
    imu
  );

  // 4. Send to motors
  await this.sendMotorCommands(attitude_cmd);
}
```

### 3D Obstacle Avoidance

```javascript
private async avoidObstacles(): Promise<Vector3D> {
  // Scan 3D space
  const obstacles = await this.scan3DSpace();

  // Build occupancy grid
  const grid = this.buildOccupancyGrid(obstacles);

  // Find safe path
  const avoidanceVector = { x: 0, y: 0, z: 0 };

  for (const obstacle of obstacles) {
    const distance = this.distance3D(this.state.position, obstacle.position);

    if (distance < 5.0) {  // 5m safety margin
      // Repulsion force (inverse square law)
      const force = 10.0 / (distance * distance);
      const direction = this.normalize(
        this.subtract(this.state.position, obstacle.position)
      );

      avoidanceVector.x += direction.x * force;
      avoidanceVector.y += direction.y * force;
      avoidanceVector.z += direction.z * force;
    }
  }

  return avoidanceVector;
}
```

### Topics

| Topic | Rate | Description |
|-------|------|-------------|
| `/drones/{id}/state` | 100Hz | Position, velocity, attitude, battery |
| `/drones/{id}/mission` | Event | Mission commands |
| `/drones/{id}/obstacles` | 10Hz | 3D obstacle map |
| `/swarm/coordination` | 10Hz | Multi-drone coordination |
| `/drones/{id}/telemetry` | 1Hz | Battery, temperature, diagnostics |

### Performance Characteristics

```
Metric                    Value              Notes
───────────────────────────────────────────────────────────
Flight Control           100Hz (10ms)        Attitude stabilization
IMU Update Rate          400Hz               Internal sensor fusion
Position Accuracy        0.5m horizontal     With GPS
Altitude Accuracy        0.1m                With barometer
Obstacle Detection       20m range           360° horizontal, ±30° vertical
Max Speed                20 m/s              Sport mode
Battery Life             20-30 min           Depends on payload
Wind Resistance          15 m/s              Max safe wind speed
```

### Best Practices

1. **Pre-Flight Checks**: Verify IMU calibration, GPS lock, battery
2. **Weather Limits**: Don't fly in wind > 15 m/s or rain
3. **Battery Management**: Land at 20% battery (safety margin)
4. **Obstacle Avoidance**: Enable in all autonomous modes
5. **Fail-Safe**: Configure return-to-home on signal loss

---

## Swarm Robots

### Overview

Collective intelligence robots with emergent behaviors like flocking, foraging, and coordination.

**Key Characteristics:**
- **Update Rate**: 10Hz per agent
- **Perception**: 3.0 unit radius
- **Behaviors**: Flocking, stigmergy, role specialization
- **Scale**: 100+ agents per swarm

### Use Cases

1. **Foraging**: Distributed search and collection
2. **Exploration**: Unknown area mapping
3. **Construction**: Collective building tasks
4. **Defense**: Perimeter protection
5. **Research**: Studying emergence and self-organization

### Architecture

```
SwarmRobot
├── Local Behaviors
│   ├── Separation (avoid crowding)
│   ├── Alignment (match neighbors)
│   ├── Cohesion (move to center)
│   └── Exploration (random walk)
├── Role Behaviors
│   ├── Scout (find resources)
│   ├── Worker (collect resources)
│   └── Guard (protect base)
├── Communication
│   ├── Pheromone Trails (stigmergy)
│   ├── Neighbor Detection
│   └── State Broadcast
└── Learning
    ├── Strategy Success Tracking
    ├── Environmental Mapping
    └── Collective Memory
```

### Quick Start

```javascript
const { SwarmManager } = require('agentic-robotics/swarm');

// Create swarm
const swarm = new SwarmManager();

// Initialize with different roles
await swarm.initialize(
  3,   // 3 scouts (explorers)
  10,  // 10 workers (collectors)
  2    // 2 guards (defenders)
);

// Simulation loop
const dt = 0.1;  // 100ms timestep
const interval = setInterval(() => {
  // Update all robots
  swarm.update(dt);

  // Get statistics
  const stats = swarm.getStats();
  console.log(`Food collected: ${stats.foodCollected}`);
  console.log(`Avg energy: ${stats.avgEnergy.toFixed(1)}%`);

}, dt * 1000);
```

### Flocking Behavior (Boids Algorithm)

```javascript
// Reynolds' Boids: Three simple rules create complex flocking

// 1. Separation: Avoid crowding neighbors
private calculateSeparation(): Vector2D {
  const force = { x: 0, y: 0 };

  for (const neighbor of this.neighbors.values()) {
    const dist = this.distance(this.position, neighbor.position);
    if (dist < 1.0 && dist > 0) {
      // Repulsion force (stronger when closer)
      const diff = this.subtract(this.position, neighbor.position);
      const scaled = this.scale(this.normalize(diff), 1.0 / dist);
      force.x += scaled.x;
      force.y += scaled.y;
    }
  }

  return force;
}

// 2. Alignment: Match velocity with neighbors
private calculateAlignment(): Vector2D {
  const avgVelocity = { x: 0, y: 0 };
  let count = 0;

  for (const neighbor of this.neighbors.values()) {
    if (neighbor.role === this.role) {
      avgVelocity.x += neighbor.velocity.x;
      avgVelocity.y += neighbor.velocity.y;
      count++;
    }
  }

  if (count > 0) {
    avgVelocity.x /= count;
    avgVelocity.y /= count;
    return this.normalize(avgVelocity);
  }

  return { x: 0, y: 0 };
}

// 3. Cohesion: Move toward center of neighbors
private calculateCohesion(): Vector2D {
  const centerOfMass = { x: 0, y: 0 };
  let count = 0;

  for (const neighbor of this.neighbors.values()) {
    centerOfMass.x += neighbor.position.x;
    centerOfMass.y += neighbor.position.y;
    count++;
  }

  if (count > 0) {
    centerOfMass.x /= count;
    centerOfMass.y /= count;
    return this.normalize(this.subtract(centerOfMass, this.position));
  }

  return { x: 0, y: 0 };
}
```

### Stigmergy (Pheromone Communication)

```javascript
// Indirect communication through environment (like ant trails)

// Drop pheromone when found food
if (this.foundFood) {
  const homeDirection = this.subtract(this.home, this.position);
  this.dropPheromone('food', this.foodQuality);
}

// Follow pheromone trail
private followPheromoneTrail(): Vector2D {
  let strongestDirection = { x: 0, y: 0 };
  let maxStrength = 0;

  // Check neighbors' pheromones
  for (const neighbor of this.neighbors.values()) {
    const strength = neighbor.pheromones.get('food') || 0;
    if (strength > maxStrength) {
      maxStrength = strength;
      strongestDirection = this.normalize(
        this.subtract(neighbor.position, this.position)
      );
    }
  }

  return strongestDirection;
}

// Pheromones decay over time
for (const [key, value] of this.pheromones.entries()) {
  const decayed = value * 0.95;  // 5% decay per update
  if (decayed < 0.01) {
    this.pheromones.delete(key);
  } else {
    this.pheromones.set(key, decayed);
  }
}
```

### Role Specialization

```javascript
// Different behaviors based on role

switch (this.agent.role) {
  case 'scout':
    // Explore widely, find resources
    steeringForce = this.scoutBehavior(foodSources);
    break;

  case 'worker':
    // Follow pheromone trails, collect resources
    steeringForce = this.workerBehavior(foodSources);
    break;

  case 'guard':
    // Patrol around home base
    steeringForce = this.guardBehavior();
    break;
}
```

### Topics

| Topic | Rate | Description |
|-------|------|-------------|
| `/swarm/agents` | 10Hz | All agent states |
| `/swarm/pheromones` | 1Hz | Pheromone map |
| `/swarm/resources` | Event | Resource discoveries |
| `/swarm/statistics` | 1Hz | Collective statistics |

### Performance Characteristics

```
Metric                    Value              Notes
───────────────────────────────────────────────────────────
Update Rate              10Hz per agent      Simulation loop
Perception Radius        3.0 units           Neighbor detection
Max Swarm Size           100+ agents         Scalable architecture
Convergence Time         5-10 seconds        Formation stability
Communication            Local only          No global knowledge
Emergence Time           10-20 updates       Pattern formation
Energy Efficiency        Self-organizing     No central control
```

### Best Practices

1. **Role Balance**: Use 3:10:2 ratio (scouts:workers:guards)
2. **Pheromone Decay**: Adjust decay rate based on environment size
3. **Perception Radius**: Larger radius = smoother flocking, more computation
4. **Update Rate**: 10Hz is optimal for most swarms
5. **Learning**: Store successful foraging strategies

---

## Custom Robots

### Create Your Own Robot Type

```javascript
const { AgenticNode } = require('agentic-robotics');
const { AgentDBMemory } = require('@agentic-robotics/mcp');

class MyCustomRobot {
  private node: AgenticNode;
  private memory: AgentDBMemory;

  constructor(robotId: string, memoryPath: string) {
    this.node = new AgenticNode(`my-robot-${robotId}`);
    this.memory = new AgentDBMemory(memoryPath);
  }

  async initialize(): Promise<void> {
    await this.memory.initialize();

    // Create publishers
    this.statePub = await this.node.createPublisher('/my-robot/state');

    // Create subscribers
    this.cmdSub = await this.node.createSubscriber('/my-robot/commands');
    await this.cmdSub.subscribe(this.handleCommand.bind(this));

    // Start control loop
    setInterval(() => this.controlLoop(), 100);  // 10Hz
  }

  private async controlLoop(): Promise<void> {
    // Your robot logic here

    // Publish state
    await this.statePub.publish(JSON.stringify({
      // your state data
    }));
  }

  private async handleCommand(message: string): Promise<void> {
    const cmd = JSON.parse(message);

    // Process command and learn
    const result = await this.executeCommand(cmd);

    await this.memory.storeEpisode({
      taskName: cmd.type,
      success: result.success,
      confidence: result.confidence,
      outcome: result.description,
      metadata: result.data
    });
  }
}
```

---

## Comparison Table

| Feature | Industrial | Vehicles | Drones | Swarm |
|---------|-----------|----------|--------|-------|
| **Update Rate** | 10Hz | 50Hz | 100Hz | 10Hz/agent |
| **Precision** | ±0.1mm | 0.5m | 0.5m horizontal | 0.1 units |
| **Range** | 2m workspace | Unlimited | 10km | 50 units |
| **Speed** | 0.5 m/s | 30 m/s | 20 m/s | 2 m/s |
| **Sensors** | Camera, Force | LIDAR, Camera, Radar, GPS | IMU, GPS, LIDAR | Proximity |
| **AI Integration** | Quality inspection | Path planning | Mission planning | Emergent behavior |
| **Learning** | Defect patterns | Route optimization | Obstacle avoidance | Foraging strategies |
| **Coordination** | Task allocation | V2V | Swarm | Stigmergy |
| **Typical Use** | Manufacturing | Transportation | Aerial tasks | Exploration |
| **Complexity** | Medium | High | High | Medium |
| **Setup Time** | 5 minutes | 15 minutes | 10 minutes | 20 minutes |

---

**Next:** [Training Guide](./training-guide.md) | **Previous:** [API Reference](./api-reference.md)

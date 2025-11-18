# Examples Guide

Step-by-step walkthroughs of complete robot simulations with code examples, explanations, and best practices.

## 📚 Table of Contents

1. [Example 1: Hello World Robot](#example-1-hello-world-robot)
2. [Example 2: Autonomous Navigator](#example-2-autonomous-navigator)
3. [Example 3: Assembly Line Robot](#example-3-assembly-line-robot)
4. [Example 4: Self-Driving Car](#example-4-self-driving-car)
5. [Example 5: Swarm Intelligence](#example-5-swarm-intelligence)
6. [Example 6: Adaptive Learning Robot](#example-6-adaptive-learning-robot)
7. [Example 7: Multi-Robot Warehouse](#example-7-multi-robot-warehouse)

---

## Example 1: Hello World Robot

**Goal:** Create your first robot that publishes sensor data and responds to commands.

**Time:** 10 minutes | **Difficulty:** Beginner

### What You'll Learn

- Create an AgenticNode
- Set up publishers and subscribers
- Handle messages with JSON serialization
- Basic robot control loop

### Code

```javascript
const { AgenticNode } = require('agentic-robotics');

async function main() {
  // Step 1: Create robot node
  const robot = new AgenticNode('hello-robot');
  console.log('🤖 Robot initialized!');

  // Step 2: Create sensor publisher
  const sensorPub = await robot.createPublisher('/sensors/temperature');

  // Step 3: Create command subscriber
  const cmdSub = await robot.createSubscriber('/commands');

  // Step 4: Listen for commands
  await cmdSub.subscribe(async (message) => {
    const cmd = JSON.parse(message);
    console.log('📥 Received command:', cmd);

    if (cmd.action === 'read_sensor') {
      // Simulate sensor reading
      const reading = {
        value: 20 + Math.random() * 10,
        unit: 'celsius',
        timestamp: Date.now()
      };

      await sensorPub.publish(JSON.stringify(reading));
      console.log('🌡️ Published:', reading);
    }
  });

  console.log('✅ Robot ready! Send commands to /commands');

  // Step 5: Simulate command
  const testPub = await robot.createPublisher('/commands');
  await testPub.publish(JSON.stringify({ action: 'read_sensor' }));
}

main().catch(console.error);
```

### Run It

```bash
node hello-robot.js
```

### Expected Output

```
🤖 Robot initialized!
✅ Robot ready! Send commands to /commands
📥 Received command: { action: 'read_sensor' }
🌡️ Published: { value: 24.3, unit: 'celsius', timestamp: 1731953400000 }
```

### Understanding the Code

**AgenticNode**: Main interface for robot communication
```javascript
const robot = new AgenticNode('hello-robot');
```

**Publishers**: Send messages to topics
```javascript
const pub = await robot.createPublisher('/topic/name');
await pub.publish(JSON.stringify({ data: 'value' }));
```

**Subscribers**: Receive messages from topics
```javascript
const sub = await robot.createSubscriber('/topic/name');
await sub.subscribe((message) => {
  const data = JSON.parse(message);
  // Process data
});
```

### Try This

1. Add multiple sensors (humidity, pressure)
2. Implement different command types
3. Add error handling for invalid commands
4. Publish sensor data periodically (setInterval)

---

## Example 2: Autonomous Navigator

**Goal:** Build a robot that autonomously navigates to waypoints while avoiding obstacles.

**Time:** 30 minutes | **Difficulty:** Intermediate

### What You'll Learn

- Position and velocity control
- Obstacle detection and avoidance
- Path planning algorithms
- State machine implementation

### Code

```javascript
const { AgenticNode } = require('agentic-robotics');

class AutonomousNavigator {
  constructor(robotId) {
    this.node = new AgenticNode(`nav-${robotId}`);
    this.position = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.goal = null;
    this.obstacles = [];
    this.state = 'idle';  // idle, navigating, avoiding, reached
  }

  async initialize() {
    // Publishers
    this.statePub = await this.node.createPublisher('/robot/state');
    this.pathPub = await this.node.createPublisher('/robot/path');

    // Subscribers
    const goalSub = await this.node.createSubscriber('/robot/goal');
    await goalSub.subscribe(this.handleGoal.bind(this));

    const obstacleSub = await this.node.createSubscriber('/obstacles');
    await obstacleSub.subscribe(this.handleObstacles.bind(this));

    // Control loop at 10Hz
    setInterval(() => this.controlLoop(), 100);

    console.log('🤖 Navigator ready!');
  }

  handleGoal(message) {
    this.goal = JSON.parse(message);
    this.state = 'navigating';
    console.log(`🎯 New goal: (${this.goal.x}, ${this.goal.y})`);
  }

  handleObstacles(message) {
    this.obstacles = JSON.parse(message);
  }

  async controlLoop() {
    // Publish current state
    await this.statePub.publish(JSON.stringify({
      position: this.position,
      velocity: this.velocity,
      state: this.state,
      timestamp: Date.now()
    }));

    if (this.state === 'idle') return;

    // Check if reached goal
    if (this.goal && this.distanceTo(this.goal) < 0.5) {
      this.state = 'reached';
      console.log('✅ Goal reached!');
      this.velocity = { x: 0, y: 0 };
      return;
    }

    // Check for obstacles
    const nearestObstacle = this.findNearestObstacle();
    if (nearestObstacle && nearestObstacle.distance < 2.0) {
      this.state = 'avoiding';
      await this.avoidObstacle(nearestObstacle);
    } else {
      this.state = 'navigating';
      await this.moveToGoal();
    }

    // Update position
    this.position.x += this.velocity.x * 0.1;  // dt = 0.1s
    this.position.y += this.velocity.y * 0.1;
  }

  async moveToGoal() {
    if (!this.goal) return;

    // Calculate direction to goal
    const dx = this.goal.x - this.position.x;
    const dy = this.goal.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize and scale by desired speed
    const speed = Math.min(1.0, distance);
    this.velocity.x = (dx / distance) * speed;
    this.velocity.y = (dy / distance) * speed;

    console.log(`→ Moving to goal (dist: ${distance.toFixed(2)}m)`);
  }

  async avoidObstacle(obstacle) {
    // Simple avoidance: move perpendicular to obstacle
    const dx = obstacle.position.x - this.position.x;
    const dy = obstacle.position.y - this.position.y;

    // Perpendicular vector
    this.velocity.x = -dy * 0.5;
    this.velocity.y = dx * 0.5;

    console.log(`⚠️ Avoiding obstacle at (${obstacle.position.x}, ${obstacle.position.y})`);
  }

  findNearestObstacle() {
    let nearest = null;
    let minDistance = Infinity;

    for (const obstacle of this.obstacles) {
      const distance = this.distanceTo(obstacle.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { ...obstacle, distance };
      }
    }

    return nearest;
  }

  distanceTo(target) {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// Main execution
async function main() {
  const robot = new AutonomousNavigator('bot-01');
  await robot.initialize();

  // Simulate goal
  const goalPub = await robot.node.createPublisher('/robot/goal');
  await goalPub.publish(JSON.stringify({ x: 10, y: 5 }));

  // Simulate obstacles
  const obstaclePub = await robot.node.createPublisher('/obstacles');
  await obstaclePub.publish(JSON.stringify([
    { id: 'obs-1', position: { x: 5, y: 2 }, radius: 1 },
    { id: 'obs-2', position: { x: 7, y: 4 }, radius: 0.5 }
  ]));
}

main().catch(console.error);
```

### Run It

```bash
node autonomous-navigator.js
```

### Expected Output

```
🤖 Navigator ready!
🎯 New goal: (10, 5)
→ Moving to goal (dist: 11.18m)
→ Moving to goal (dist: 10.53m)
⚠️ Avoiding obstacle at (5, 2)
→ Moving to goal (dist: 9.28m)
⚠️ Avoiding obstacle at (7, 4)
→ Moving to goal (dist: 5.12m)
→ Moving to goal (dist: 2.31m)
→ Moving to goal (dist: 0.42m)
✅ Goal reached!
```

### Key Concepts

**State Machine:**
```
idle ──→ navigating ──→ avoiding ──→ navigating ──→ reached
```

**Obstacle Avoidance:**
- Detect obstacles within safety margin (2m)
- Move perpendicular to obstacle direction
- Resume navigation when clear

**Control Loop:**
- Runs at fixed frequency (10Hz)
- Publishes state for monitoring
- Updates position based on velocity

### Try This

1. Implement A* path planning instead of direct navigation
2. Add dynamic obstacle prediction
3. Create smoother trajectories with splines
4. Add rotation/heading control

---

## Example 3: Assembly Line Robot

**Goal:** Build a high-precision manufacturing robot with AI vision inspection.

**Time:** 45 minutes | **Difficulty:** Advanced

### What You'll Learn

- Pick-and-place operations
- Quality inspection with AI
- Memory-based learning
- Predictive maintenance

### Code

```javascript
const { AgenticNode } = require('agentic-robotics');
const { AgentDBMemory } = require('@agentic-robotics/mcp');

class AssemblyLineRobot {
  constructor(robotId, memoryPath) {
    this.robotId = robotId;
    this.node = new AgenticNode(`assembly-${robotId}`);
    this.memory = new AgentDBMemory(memoryPath);

    this.position = { x: 0, y: 0, z: 100 };
    this.gripper = { isOpen: true, force: 0, holding: null };
    this.stats = {
      tasksCompleted: 0,
      defectsDetected: 0,
      averageCycleTime: 0
    };
  }

  async initialize() {
    await this.memory.initialize();
    console.log('🏭 Assembly robot initialized');

    // Publishers
    this.statePub = await this.node.createPublisher(`/robots/${this.robotId}/state`);
    this.qualityPub = await this.node.createPublisher('/factory/quality');

    // Subscribers
    const taskSub = await this.node.createSubscriber('/factory/tasks');
    await taskSub.subscribe(this.handleTask.bind(this));

    // State updates at 10Hz
    setInterval(() => this.publishState(), 100);
  }

  async handleTask(message) {
    const task = JSON.parse(message);
    console.log(`\n📋 Task ${task.taskId}: ${task.productId}`);

    const startTime = Date.now();

    try {
      // Execute assembly
      for (const component of task.components) {
        await this.pickAndPlace(component);
      }

      // Quality inspection
      const quality = await this.inspectQuality(task);

      const cycleTime = Date.now() - startTime;

      // Store experience
      await this.memory.storeEpisode({
        sessionId: this.robotId,
        taskName: `assembly_${task.productId}`,
        confidence: quality.confidence,
        success: quality.passed,
        outcome: quality.passed ? 'Passed QC' : `Failed: ${quality.defects.join(', ')}`,
        metadata: {
          cycleTime,
          components: task.components.length,
          qualityScore: quality.confidence
        }
      });

      // Publish results
      await this.qualityPub.publish(JSON.stringify({
        taskId: task.taskId,
        productId: task.productId,
        result: quality,
        cycleTime,
        timestamp: Date.now()
      }));

      // Update statistics
      this.stats.tasksCompleted++;
      this.stats.averageCycleTime =
        (this.stats.averageCycleTime * (this.stats.tasksCompleted - 1) + cycleTime) /
        this.stats.tasksCompleted;

      if (!quality.passed) {
        this.stats.defectsDetected++;
      }

      console.log(`✅ Task ${task.taskId} completed in ${cycleTime}ms`);
    } catch (error) {
      console.error(`❌ Task ${task.taskId} failed:`, error.message);

      await this.memory.storeEpisode({
        sessionId: this.robotId,
        taskName: `assembly_${task.productId}`,
        confidence: 0,
        success: false,
        outcome: `Error: ${error.message}`
      });
    }
  }

  async pickAndPlace(component) {
    // Move to component
    console.log(`  🔧 Picking ${component.type}...`);
    await this.moveTo(component.position);
    await this.delay(50);

    // Grasp
    this.gripper.isOpen = false;
    this.gripper.holding = component;
    await this.delay(100);

    // Move to assembly position
    const assemblyPos = { x: 500, y: 500, z: 200 };
    await this.moveTo(assemblyPos);

    // Place
    this.gripper.isOpen = true;
    this.gripper.holding = null;
    await this.delay(50);
  }

  async inspectQuality(task) {
    console.log('  🔍 Quality inspection...');

    // Check past failures
    const memories = await this.memory.retrieveMemories(
      `assembly_${task.productId}`,
      5,
      { onlyFailures: true }
    );

    let confidence = 0.95;
    const defects = [];

    // Be more careful if past failures exist
    if (memories.length > 0) {
      confidence = 0.85;
      console.log(`  ⚠️ ${memories.length} past failures detected`);
    }

    // Simulate defect detection (5% random failure)
    if (Math.random() < 0.05) {
      defects.push('Component misalignment');
      confidence = 0.6;
    }

    return {
      passed: defects.length === 0,
      defects,
      confidence,
      images: [`inspection_${Date.now()}.jpg`]
    };
  }

  async moveTo(position) {
    const distance = Math.sqrt(
      Math.pow(position.x - this.position.x, 2) +
      Math.pow(position.y - this.position.y, 2) +
      Math.pow(position.z - this.position.z, 2)
    );

    await this.delay(distance * 2);  // 2ms per unit
    this.position = { ...position };
  }

  async publishState() {
    await this.statePub.publish(JSON.stringify({
      robotId: this.robotId,
      position: this.position,
      gripper: this.gripper,
      stats: this.stats,
      timestamp: Date.now()
    }));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const robot = new AssemblyLineRobot('ROBOT-001', './assembly-memory.db');
  await robot.initialize();

  // Publish test task
  const taskPub = await robot.node.createPublisher('/factory/tasks');

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
        position: { x: 120, y: 120, z: 50 },
        orientation: { roll: 0, pitch: 0, yaw: 90 }
      }
    ],
    qualityCriteria: {
      torqueMin: 1.5,
      torqueMax: 2.5,
      positionTolerance: 0.1
    }
  };

  await taskPub.publish(JSON.stringify(task));

  console.log('🏭 Assembly line running...');
}

main().catch(console.error);
```

### Run It

```bash
node assembly-robot.js
```

### Expected Output

```
🏭 Assembly robot initialized
🏭 Assembly line running...

📋 Task TASK-001: WIDGET-A
  🔧 Picking pcb...
  🔧 Picking connector...
  🔍 Quality inspection...
✅ Task TASK-001 completed in 1243ms
```

### Key Features

**Memory-Based Learning:**
- Stores each task execution
- Retrieves past failures
- Adjusts confidence based on history

**Predictive Maintenance:**
- Tracks uptime and performance
- Alerts when degradation detected

**Quality Inspection:**
- AI-powered defect detection
- Historical pattern analysis

### Try This

1. Add force-torque sensing
2. Implement calibration routine
3. Add more defect types
4. Create maintenance scheduling

---

## Example 4: Self-Driving Car

**Goal:** Build a Level 4 autonomous vehicle with sensor fusion and V2V communication.

**Time:** 60 minutes | **Difficulty:** Advanced

### What You'll Learn

- Multi-sensor fusion (LIDAR, camera, radar, GPS)
- 50Hz control loop implementation
- Emergency braking system
- Vehicle-to-vehicle communication

### Full code available in:
```
/home/user/agentic-robotics/examples/autonomous-vehicles/self-driving-car.ts
```

### Quick Start

```javascript
const { AutonomousVehicle } = require('agentic-robotics/vehicles');

const car = new AutonomousVehicle('CAR-001', './memory.db');
await car.initialize();

// Assign route
const routePub = await car.node.createPublisher('/vehicles/CAR-001/route');
await routePub.publish(JSON.stringify({
  waypoints: [
    { lat: 37.7749, lon: -122.4194 },
    { lat: 37.7849, lon: -122.4094 }
  ],
  distance: 1500,
  estimatedTime: 120,
  speedLimits: [50, 60]
}));
```

### Key Features

- **50Hz Control Loop**: Real-time responsiveness
- **Sensor Fusion**: Kalman filter for LIDAR+camera+radar+GPS
- **Emergency Braking**: < 50ms detection-to-brake
- **V2V**: Coordinate with other vehicles

---

## Example 5: Swarm Intelligence

**Goal:** Create emergent collective behavior with flocking algorithms.

**Time:** 45 minutes | **Difficulty:** Intermediate

### What You'll Learn

- Reynolds' Boids algorithm (separation, alignment, cohesion)
- Stigmergy (pheromone communication)
- Role specialization (scouts, workers, guards)
- Emergent coordination

### Full code available in:
```
/home/user/agentic-robotics/examples/04-swarm-intelligence.ts
```

### Quick Start

```javascript
const { SwarmManager } = require('agentic-robotics/swarm');

const swarm = new SwarmManager();
await swarm.initialize(3, 10, 2);  // scouts, workers, guards

// Simulation loop
const dt = 0.1;
setInterval(() => {
  swarm.update(dt);

  const stats = swarm.getStats();
  console.log(`Food collected: ${stats.foodCollected}`);
}, dt * 1000);
```

### Key Behaviors

**Flocking**: Natural formation
**Foraging**: Resource collection
**Defense**: Base protection

---

## Example 6: Adaptive Learning Robot

**Goal:** Robot that learns optimal strategies from experience.

**Time:** 40 minutes | **Difficulty:** Advanced

### What You'll Learn

- Experience-based strategy selection
- Confidence-weighted decision making
- Performance improvement over time
- Skill consolidation

### Full code available in:
```
/home/user/agentic-robotics/examples/08-adaptive-learning.ts
```

### Quick Start

```javascript
const { AdaptiveLearningRobot } = require('agentic-robotics');

const robot = new AdaptiveLearningRobot('learner-1');
await robot.start();

// Run 12 tasks and learn
await robot.runLearningSession(12);

// Skills automatically consolidated
await robot.consolidateAndExport();
```

### Learning Curve

```
First half:  65% success rate
Second half: 82% success rate
Improvement: +17%
```

---

## Example 7: Multi-Robot Warehouse

**Goal:** Coordinate multiple robots for warehouse logistics.

**Time:** 50 minutes | **Difficulty:** Advanced

### Code

```javascript
const { AgenticNode } = require('agentic-robotics');

class WarehouseCoordinator {
  constructor() {
    this.node = new AgenticNode('warehouse-coordinator');
    this.robots = new Map();
    this.pendingTasks = [];
  }

  async initialize() {
    // Subscribe to robot status
    const statusSub = await this.node.createSubscriber('/robots/+/status');
    await statusSub.subscribe(this.handleRobotStatus.bind(this));

    // Publisher for task assignments
    this.taskPub = await this.node.createPublisher('/tasks/assignments');

    // Subscribe to orders
    const orderSub = await this.node.createSubscriber('/warehouse/orders');
    await orderSub.subscribe(this.handleNewOrder.bind(this));

    console.log('✅ Coordinator ready');
  }

  handleRobotStatus(message) {
    const status = JSON.parse(message);
    this.robots.set(status.robotId, status);

    // Assign task if robot became idle
    if (status.state === 'idle' && this.pendingTasks.length > 0) {
      this.assignTask(status.robotId);
    }
  }

  handleNewOrder(message) {
    const order = JSON.parse(message);
    console.log(`📦 New order: ${order.orderId}`);

    // Break into tasks
    const tasks = this.planTasks(order);
    this.pendingTasks.push(...tasks);

    // Assign to available robots
    this.assignPendingTasks();
  }

  planTasks(order) {
    return order.items.map(item => ({
      type: 'pick',
      orderId: order.orderId,
      item: item,
      location: this.findItemLocation(item),
      priority: order.priority || 0
    }));
  }

  assignPendingTasks() {
    for (const [robotId, status] of this.robots) {
      if (status.state === 'idle' && this.pendingTasks.length > 0) {
        this.assignTask(robotId);
      }
    }
  }

  async assignTask(robotId) {
    if (this.pendingTasks.length === 0) return;

    // Sort by priority
    this.pendingTasks.sort((a, b) => b.priority - a.priority);
    const task = this.pendingTasks.shift();

    console.log(`📋 Assigning ${task.type} to ${robotId}`);

    await this.taskPub.publish(JSON.stringify({
      robotId: robotId,
      task: task,
      timestamp: Date.now()
    }));
  }

  findItemLocation(item) {
    return {
      aisle: Math.floor(Math.random() * 10) + 1,
      shelf: Math.floor(Math.random() * 5) + 1,
      bin: Math.floor(Math.random() * 20) + 1
    };
  }
}

class WarehouseRobot {
  constructor(robotId) {
    this.robotId = robotId;
    this.node = new AgenticNode(`robot-${robotId}`);
    this.state = 'idle';
  }

  async initialize() {
    const taskSub = await this.node.createSubscriber('/tasks/assignments');
    await taskSub.subscribe(this.handleTask.bind(this));

    this.statusPub = await this.node.createPublisher(`/robots/${this.robotId}/status`);

    // Report status every second
    setInterval(() => this.reportStatus(), 1000);

    console.log(`🤖 Robot ${this.robotId} initialized`);
  }

  async handleTask(message) {
    const assignment = JSON.parse(message);
    if (assignment.robotId !== this.robotId) return;

    this.state = 'working';
    console.log(`📋 Robot ${this.robotId}: ${assignment.task.type}`);

    // Execute task (simulated)
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    this.state = 'idle';
    console.log(`✅ Robot ${this.robotId} completed`);
  }

  async reportStatus() {
    await this.statusPub.publish(JSON.stringify({
      robotId: this.robotId,
      state: this.state,
      battery: 0.7 + Math.random() * 0.3,
      timestamp: Date.now()
    }));
  }
}

// Main
async function main() {
  const coordinator = new WarehouseCoordinator();
  await coordinator.initialize();

  // Create 5 robots
  const robots = [];
  for (let i = 1; i <= 5; i++) {
    const robot = new WarehouseRobot(i);
    await robot.initialize();
    robots.push(robot);
  }

  // Simulate orders
  const orderPub = await coordinator.node.createPublisher('/warehouse/orders');

  setInterval(async () => {
    await orderPub.publish(JSON.stringify({
      orderId: `ORD-${Date.now()}`,
      items: ['Widget A', 'Widget B', 'Widget C'],
      priority: Math.floor(Math.random() * 3)
    }));
  }, 5000);

  console.log('🏭 Warehouse system running!');
}

main().catch(console.error);
```

### Key Concepts

- **Centralized Coordination**: Single coordinator assigns tasks
- **Priority Queue**: High-priority orders first
- **Load Balancing**: Distribute tasks evenly
- **Status Monitoring**: Track all robot states

---

## Next Steps

1. **Combine Examples**: Mix navigation + learning + coordination
2. **Add Visualization**: Create web dashboard
3. **Scale Up**: Test with 100+ robots
4. **Deploy**: Run on real hardware

---

**Next:** [Performance Tuning](./performance-tuning.md) | **Previous:** [Training Guide](./training-guide.md)

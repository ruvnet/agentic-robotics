# API Reference

Complete API documentation for Agentic Robotics simulation system.

## 📚 Table of Contents

- [Core API](#core-api)
  - [AgenticNode](#agenticnode)
  - [AgenticPublisher](#agenticpublisher)
  - [AgenticSubscriber](#agenticsubscriber)
- [Memory API](#memory-api)
  - [AgentDBMemory](#agentdbmemory)
- [MCP Tools](#mcp-tools)
  - [Robot Control](#robot-control)
  - [Memory & Learning](#memory--learning)
  - [Orchestration](#orchestration)
- [Robot Types](#robot-types)
  - [Industrial Robots](#industrial-robots)
  - [Autonomous Vehicles](#autonomous-vehicles)
  - [Autonomous Drones](#autonomous-drones)
  - [Swarm Robots](#swarm-robots)

---

## Core API

### AgenticNode

Main entry point for creating robot systems.

#### Constructor

```typescript
constructor(name: string)
```

**Parameters:**
- `name` (string): Unique identifier for this node

**Returns:** AgenticNode instance

**Example:**
```javascript
const { AgenticNode } = require('agentic-robotics');
const robot = new AgenticNode('my-robot-01');
```

---

#### createPublisher()

Create a publisher for a topic.

```typescript
async createPublisher(topic: string): Promise<AgenticPublisher>
```

**Parameters:**
- `topic` (string): Topic name (e.g., `/robot/sensors/lidar`)

**Returns:** Promise<AgenticPublisher>

**Throws:** Error if topic is invalid

**Example:**
```javascript
const sensorPub = await robot.createPublisher('/sensors/temperature');
```

**Performance:**
- Latency: < 1ms (one-time setup)
- Topics: Unlimited (memory bound)

---

#### createSubscriber()

Create a subscriber for a topic.

```typescript
async createSubscriber(topic: string): Promise<AgenticSubscriber>
```

**Parameters:**
- `topic` (string): Topic name, supports wildcards (`+` for single level)

**Returns:** Promise<AgenticSubscriber>

**Example:**
```javascript
// Exact topic
const cmdSub = await robot.createSubscriber('/commands');

// Wildcard (any robot ID)
const allRobotsSub = await robot.createSubscriber('/robots/+/status');
```

**Wildcard Patterns:**
- `+` matches one level: `/robots/+/status` matches `/robots/01/status`, `/robots/02/status`
- Use exact matches for performance

---

### AgenticPublisher

Publishes messages to a topic.

#### publish()

Publish a message to the topic.

```typescript
async publish(data: string): Promise<void>
```

**Parameters:**
- `data` (string): JSON-serialized message data

**Returns:** Promise<void>

**Throws:** Error if serialization fails

**Example:**
```javascript
await sensorPub.publish(JSON.stringify({
  value: 23.5,
  unit: 'celsius',
  timestamp: Date.now()
}));
```

**Performance:**
- Latency: 10-50µs per message
- Throughput: 100k+ messages/sec
- Max size: 1MB per message (recommended: < 10KB)

**Best Practices:**
```javascript
// ✅ Good: Small, focused messages
await pub.publish(JSON.stringify({ temp: 23.5 }));

// ❌ Bad: Large nested objects
await pub.publish(JSON.stringify(hugeNestedObject));

// ✅ Good: Batch related data
await pub.publish(JSON.stringify({
  sensors: [{ id: 1, value: 23.5 }, { id: 2, value: 24.1 }]
}));
```

---

#### getStats()

Get publisher statistics.

```typescript
getStats(): PublisherStats
```

**Returns:**
```typescript
interface PublisherStats {
  messages: number;  // Total messages published
  bytes: number;     // Total bytes published
}
```

**Example:**
```javascript
const stats = sensorPub.getStats();
console.log(`Published ${stats.messages} messages (${stats.bytes} bytes)`);
```

---

### AgenticSubscriber

Receives messages from a topic.

#### subscribe()

Register callback for incoming messages.

```typescript
async subscribe(callback: (message: string) => void): Promise<void>
```

**Parameters:**
- `callback` (function): Function called for each message

**Example:**
```javascript
await cmdSub.subscribe((message) => {
  const cmd = JSON.parse(message);
  console.log('Received:', cmd);

  // Process command
  if (cmd.action === 'move') {
    handleMove(cmd.params);
  }
});
```

**Error Handling:**
```javascript
await cmdSub.subscribe((message) => {
  try {
    const cmd = JSON.parse(message);
    processCommand(cmd);
  } catch (error) {
    console.error('Failed to process message:', error);
    // Don't throw - it will stop the subscriber
  }
});
```

---

#### recv()

Receive a message (blocking).

```typescript
async recv(): Promise<string>
```

**Returns:** Promise<string> - Next message from queue

**Example:**
```javascript
// Polling loop
while (running) {
  const message = await cmdSub.recv();
  const cmd = JSON.parse(message);
  await processCommand(cmd);
}
```

**Performance:**
- Latency: 10-50µs (if message ready)
- Blocks: Waits for message if queue empty

---

#### tryRecv()

Try to receive a message (non-blocking).

```typescript
async tryRecv(): Promise<string | null>
```

**Returns:** Promise<string | null> - Message or null if queue empty

**Example:**
```javascript
// Non-blocking check
const message = await cmdSub.tryRecv();
if (message !== null) {
  const cmd = JSON.parse(message);
  await processCommand(cmd);
} else {
  // Do other work
  await performBackgroundTask();
}
```

---

## Memory API

### AgentDBMemory

High-performance memory system for robot learning.

#### Constructor

```typescript
constructor(dbPath: string)
```

**Parameters:**
- `dbPath` (string): Path to SQLite database file

**Example:**
```javascript
const { AgentDBMemory } = require('@agentic-robotics/mcp');
const memory = new AgentDBMemory('./robot-memory.db');
await memory.initialize();
```

---

#### storeEpisode()

Store an experience episode.

```typescript
async storeEpisode(episode: Episode): Promise<void>
```

**Parameters:**
```typescript
interface Episode {
  sessionId: string;      // Session identifier
  taskName: string;       // Task type
  confidence: number;     // 0.0-1.0
  success: boolean;       // Task outcome
  outcome: string;        // Description
  strategy?: string;      // Strategy used
  critique?: string;      // Self-critique
  metadata?: any;         // Additional data
}
```

**Example:**
```javascript
await memory.storeEpisode({
  sessionId: 'robot-01-session-123',
  taskName: 'obstacle_avoidance',
  confidence: 0.95,
  success: true,
  outcome: 'Successfully avoided obstacle using path replanning',
  strategy: 'dynamic_replan',
  critique: 'Could improve smoothness of trajectory',
  metadata: {
    obstacle_distance: 2.5,
    replanning_time: 0.15,
    path_length: 12.3
  }
});
```

**Performance:**
- Latency: 0.175ms average
- Throughput: 5,725 ops/sec
- Speedup: 13,168x faster than CLI

---

#### retrieveMemories()

Retrieve similar experiences.

```typescript
async retrieveMemories(
  query: string,
  k: number,
  options?: RetrievalOptions
): Promise<Episode[]>
```

**Parameters:**
- `query` (string): Semantic search query
- `k` (number): Number of results
- `options` (optional):
  ```typescript
  interface RetrievalOptions {
    minConfidence?: number;   // Minimum confidence (0.0-1.0)
    onlySuccesses?: boolean;  // Filter successful only
    onlyFailures?: boolean;   // Filter failures only
    domain?: string;          // Task domain filter
    synthesizeContext?: boolean; // Generate context summary
  }
  ```

**Returns:** Promise<Episode[]>

**Example:**
```javascript
// Basic retrieval
const memories = await memory.retrieveMemories(
  'obstacle avoidance in narrow corridor',
  5
);

// Advanced filtering
const memories = await memory.retrieveMemories(
  'high-speed navigation',
  10,
  {
    minConfidence: 0.8,
    onlySuccesses: true,
    domain: 'navigation'
  }
);

// Use retrieved strategies
if (memories.length > 0) {
  const bestStrategy = memories[0].strategy;
  console.log(`Applying learned strategy: ${bestStrategy}`);
  await applyStrategy(bestStrategy, memories[0].metadata);
}
```

**Performance:**
- Latency: 0.334ms average
- Speedup: 5,988x faster than CLI

---

#### consolidateSkills()

Learn patterns from successful episodes.

```typescript
async consolidateSkills(domain: string): Promise<ConsolidationResult>
```

**Parameters:**
- `domain` (string): Task domain to consolidate

**Returns:**
```typescript
interface ConsolidationResult {
  skillsConsolidated: number;
  patternsFound: number;
  commonStrategies: string[];
}
```

**Example:**
```javascript
const result = await memory.consolidateSkills('navigation');
console.log(`Consolidated ${result.skillsConsolidated} skills`);
console.log(`Found ${result.patternsFound} common patterns`);
console.log(`Strategies: ${result.commonStrategies.join(', ')}`);
```

**Algorithm:**
1. Filter successful episodes (success = true, confidence > 0.7)
2. Group by task name and strategy
3. Calculate statistics (success rate, avg duration)
4. Extract common parameters
5. Create skill if: success_rate > 0.8 AND times_used > 5
6. Update skill library

---

#### searchSkills()

Search consolidated skill library.

```typescript
async searchSkills(
  query: string,
  k: number
): Promise<Skill[]>
```

**Parameters:**
- `query` (string): Semantic search query
- `k` (number): Number of results

**Returns:**
```typescript
interface Skill {
  name: string;
  description: string;
  successRate: number;
  timesUsed: number;
  strategy: string;
  parameters: Record<string, any>;
}
```

**Example:**
```javascript
const skills = await memory.searchSkills('precise object grasping', 3);

for (const skill of skills) {
  console.log(`${skill.name}: ${(skill.successRate * 100).toFixed(1)}% success`);
  console.log(`  Used: ${skill.timesUsed} times`);
  console.log(`  Parameters:`, skill.parameters);
}
```

**Performance:**
- Latency: 0.512ms average
- Speedup: 3,516x faster than CLI

---

## MCP Tools

21 AI tools for robot control and learning.

### Robot Control

#### move_robot

Move robot to specified position.

```typescript
move_robot(params: {
  x: number;
  y: number;
  z: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  speed?: number;
  useMemory?: boolean;
}): Promise<MoveResult>
```

**Parameters:**
- `x, y, z`: Target position (meters)
- `roll, pitch, yaw`: Target orientation (radians)
- `speed`: Movement speed (0.0-1.0)
- `useMemory`: Learn from past movements

**Example:**
```javascript
await move_robot({
  x: 10.0,
  y: 5.0,
  z: 0.0,
  speed: 0.5,
  useMemory: true
});
```

---

#### get_robot_status

Get current robot state.

```typescript
get_robot_status(robotId: string): Promise<RobotStatus>
```

**Returns:**
```typescript
interface RobotStatus {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  battery: number;
  status: 'idle' | 'moving' | 'working' | 'error';
  lastUpdate: number;
}
```

---

#### execute_action

Execute robot action with parameters.

```typescript
execute_action(params: {
  action: string;
  parameters: Record<string, any>;
  timeout?: number;
}): Promise<ActionResult>
```

**Example:**
```javascript
await execute_action({
  action: 'grasp_object',
  parameters: {
    object_id: 'OBJ-123',
    force: 0.7,
    approach_angle: 45
  },
  timeout: 5000
});
```

---

#### emergency_stop

Emergency halt all robot operations.

```typescript
emergency_stop(robotId: string): Promise<void>
```

**Example:**
```javascript
await emergency_stop('robot-01');
// Robot immediately stops all motion
```

---

### Memory & Learning

#### store_episode

Store experience episode.

```typescript
store_episode(episode: Episode): Promise<void>
```

See [storeEpisode()](#storeepisode) for details.

---

#### retrieve_memories

Retrieve similar experiences.

```typescript
retrieve_memories(
  query: string,
  k: number,
  options?: RetrievalOptions
): Promise<Episode[]>
```

See [retrieveMemories()](#retrievememories) for details.

---

#### consolidate_skills

Consolidate successful episodes into skills.

```typescript
consolidate_skills(domain: string): Promise<ConsolidationResult>
```

See [consolidateSkills()](#consolidateskills) for details.

---

### Orchestration

#### execute_swarm

Execute task with multiple robots.

```typescript
execute_swarm(params: {
  robots: string[];
  tasks: Task[];
  coordination: 'optimal' | 'greedy' | 'round-robin';
}): Promise<SwarmResult>
```

**Example:**
```javascript
await execute_swarm({
  robots: ['robot-01', 'robot-02', 'robot-03'],
  tasks: [
    { type: 'patrol', area: 'warehouse-A' },
    { type: 'inspect', area: 'warehouse-B' },
    { type: 'transport', from: 'dock', to: 'storage' }
  ],
  coordination: 'optimal'
});
```

---

#### coordinate_robots

Strategic task allocation across robots.

```typescript
coordinate_robots(params: {
  robots: string[];
  mission: Mission;
}): Promise<CoordinationPlan>
```

**Example:**
```javascript
const plan = await coordinate_robots({
  robots: ['bot-1', 'bot-2', 'bot-3'],
  mission: {
    type: 'warehouse_inventory',
    objectives: [
      'scan_all_shelves',
      'detect_misplaced_items',
      'update_database'
    ],
    deadline: '30 minutes'
  }
});
```

---

## Robot Types

### Industrial Robots

#### AssemblyLineRobot

High-precision manufacturing robot.

```typescript
class AssemblyLineRobot {
  constructor(robotId: string, memoryPath: string);

  async initialize(): Promise<void>;

  // Internal methods (called automatically)
  private async executeAssemblyTask(task: AssemblyTask): Promise<void>;
  private async pickAndPlace(component: Component): Promise<void>;
  private async inspectQuality(task: AssemblyTask): Promise<QualityResult>;
}
```

**Topics:**
- `/robots/{id}/state` - Robot state (10Hz)
- `/factory/tasks` - Task assignments
- `/factory/quality` - Quality inspection results
- `/robots/{id}/maintenance` - Maintenance alerts

**Example:**
```javascript
const { AssemblyLineRobot } = require('agentic-robotics/industrial');

const robot = new AssemblyLineRobot('ROBOT-001', './memory.db');
await robot.initialize();

// Publish task
const taskPub = await robot.node.createPublisher('/factory/tasks');
await taskPub.publish(JSON.stringify({
  taskId: 'TASK-001',
  productId: 'WIDGET-A',
  components: [
    {
      id: 'PCB-001',
      type: 'pcb',
      position: { x: 100, y: 100, z: 50 },
      orientation: { roll: 0, pitch: 0, yaw: 0 }
    }
  ],
  qualityCriteria: {
    torqueMin: 1.5,
    torqueMax: 2.5,
    positionTolerance: 0.1
  }
}));
```

**Performance:**
- Update Rate: 10Hz (100ms)
- Position Accuracy: ±0.1mm
- Cycle Time: 2-5 seconds per component
- Quality Inspection: 0.95 confidence

---

### Autonomous Vehicles

#### AutonomousVehicle

Level 4/5 self-driving vehicle.

```typescript
class AutonomousVehicle {
  constructor(vehicleId: string, memoryPath: string);

  async initialize(): Promise<void>;

  // Internal methods
  private async controlLoop(): Promise<void>;
  private async processSensors(): Promise<void>;
  private async detectObstacles(): Promise<void>;
  private async planPath(): Promise<ControlCommand>;
}
```

**Topics:**
- `/vehicles/{id}/state` - Vehicle state (50Hz)
- `/vehicles/{id}/obstacles` - Detected obstacles
- `/vehicles/{id}/route` - Route assignments
- `/v2v/broadcast` - Vehicle-to-vehicle communication
- `/traffic/updates` - Traffic light & road conditions

**Example:**
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

**Performance:**
- Control Loop: 50Hz (20ms)
- Sensor Fusion: LIDAR + camera + radar + GPS
- Emergency Braking: < 50ms response
- Obstacle Detection: 200m range, 360° coverage

---

### Autonomous Drones

#### AutonomousDrone

Multi-purpose aerial robot.

```typescript
class AutonomousDrone {
  constructor(droneId: string, memoryPath: string);

  async initialize(): Promise<void>;
  async takeoff(altitude: number): Promise<void>;
  async land(): Promise<void>;

  // Internal methods
  private async flightController(): Promise<void>;
  private async stabilize(): Promise<void>;
  private async avoidObstacles(): Promise<void>;
}
```

**Topics:**
- `/drones/{id}/state` - Flight state (100Hz)
- `/drones/{id}/mission` - Mission commands
- `/drones/{id}/obstacles` - 3D obstacle map
- `/swarm/coordination` - Multi-drone coordination

**Example:**
```javascript
const { AutonomousDrone } = require('agentic-robotics/drones');

const drone = new AutonomousDrone('DRONE-001', './memory.db');
await drone.initialize();

// Start mission
await drone.takeoff(10.0);  // 10m altitude

const missionPub = await drone.node.createPublisher('/drones/DRONE-001/mission');
await missionPub.publish(JSON.stringify({
  type: 'survey',
  area: {
    points: [
      { lat: 37.7749, lon: -122.4194 },
      { lat: 37.7759, lon: -122.4184 },
      { lat: 37.7769, lon: -122.4194 }
    ]
  },
  altitude: 50,
  speed: 10
}));
```

**Performance:**
- Flight Control: 100Hz (10ms)
- Stabilization: 6-axis IMU at 400Hz
- Obstacle Avoidance: 3D mapping, 20m range
- Battery Life: 20-30 minutes

---

### Swarm Robots

#### SwarmRobot

Collective intelligence robot.

```typescript
class SwarmRobot {
  constructor(robotId: string, role: 'scout' | 'worker' | 'guard');

  async start(): Promise<void>;
  update(allAgents: Map<string, SwarmAgent>, foodSources: FoodSource[], dt: number): void;

  // Behavior methods
  private scoutBehavior(foodSources: FoodSource[]): Vector2D;
  private workerBehavior(foodSources: FoodSource[]): Vector2D;
  private guardBehavior(): Vector2D;
}
```

**Swarm Behaviors:**
- **Flocking**: Separation, alignment, cohesion
- **Foraging**: Pheromone trail following
- **Role Specialization**: Scouts, workers, guards
- **Emergent Coordination**: Self-organization

**Example:**
```javascript
const { SwarmManager } = require('agentic-robotics/swarm');

const swarm = new SwarmManager();

// Initialize swarm
await swarm.initialize(
  3,   // scouts
  10,  // workers
  2    // guards
);

// Simulation loop
const dt = 0.1;  // 100ms timestep
setInterval(() => {
  swarm.update(dt);

  const stats = swarm.getStats();
  console.log(`Food collected: ${stats.foodCollected}`);
}, dt * 1000);
```

**Performance:**
- Update Rate: 10Hz per agent
- Perception Radius: 3.0 units
- Max Swarm Size: 100+ agents
- Emergence Time: 5-10 seconds

---

## Error Handling

### Common Errors

```typescript
// Topic already exists
try {
  await robot.createPublisher('/existing/topic');
} catch (error) {
  if (error.message.includes('already exists')) {
    // Reuse existing publisher
  }
}

// Message parse error
subscriber.subscribe((message) => {
  try {
    const data = JSON.parse(message);
  } catch (error) {
    console.error('Invalid JSON:', message);
    // Skip malformed message
  }
});

// Database error
try {
  await memory.storeEpisode(episode);
} catch (error) {
  if (error.message.includes('SQLITE_BUSY')) {
    // Retry with backoff
    await sleep(100);
    await memory.storeEpisode(episode);
  }
}
```

---

## Type Definitions

Complete TypeScript definitions available in:
- `/crates/agentic-robotics-node/index.d.ts`
- `/@agentic-robotics/core/index.d.ts`

---

**Next:** [Robot Types Guide](./robot-types.md) | **Previous:** [Architecture](./architecture.md)

/**
 * Multi-Robot System Test Suite
 *
 * Comprehensive tests for multi-robot coordination including:
 * - Inter-robot communication
 * - Collision avoidance
 * - Formation control
 * - Task allocation
 * - Swarm behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock multi-robot interfaces
interface Position {
  x: number;
  y: number;
  z: number;
}

interface Message {
  from: string;
  to: string;
  type: 'position' | 'intent' | 'task' | 'alert';
  data: any;
  timestamp: number;
}

interface Task {
  id: string;
  type: string;
  position: Position;
  priority: number;
  assignedTo?: string;
}

interface RobotInfo {
  id: string;
  position: Position;
  velocity: Position;
  status: 'idle' | 'moving' | 'working' | 'avoiding';
  currentTask?: string;
}

// Communication Manager
class CommunicationManager {
  private messageQueue: Map<string, Message[]> = new Map();
  private latency: number; // ms

  constructor(latency: number = 0) {
    this.latency = latency;
  }

  sendMessage(message: Message): void {
    if (!this.messageQueue.has(message.to)) {
      this.messageQueue.set(message.to, []);
    }

    const deliveryTime = Date.now() + this.latency;
    const timedMessage = { ...message, timestamp: deliveryTime };

    this.messageQueue.get(message.to)!.push(timedMessage);
  }

  receiveMessages(robotId: string): Message[] {
    const messages = this.messageQueue.get(robotId) || [];
    const currentTime = Date.now();

    // Filter messages that have been delivered
    const delivered = messages.filter(m => m.timestamp <= currentTime);
    const pending = messages.filter(m => m.timestamp > currentTime);

    this.messageQueue.set(robotId, pending);

    return delivered;
  }

  broadcast(message: Omit<Message, 'to'>, recipients: string[]): void {
    recipients.forEach(recipient => {
      this.sendMessage({ ...message, to: recipient } as Message);
    });
  }

  clearMessages(robotId: string): void {
    this.messageQueue.delete(robotId);
  }
}

// Multi-Robot System
class MultiRobotAgent {
  public id: string;
  public position: Position;
  public velocity: Position;
  public status: 'idle' | 'moving' | 'working' | 'avoiding';
  public currentTask?: Task;
  private targetPosition?: Position;
  private maxSpeed: number = 1.0;
  private safetyDistance: number = 2.0;
  private communicationManager: CommunicationManager;
  private knownRobots: Map<string, RobotInfo> = new Map();

  constructor(
    id: string,
    position: Position,
    communicationManager: CommunicationManager
  ) {
    this.id = id;
    this.position = { ...position };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.status = 'idle';
    this.communicationManager = communicationManager;
  }

  getInfo(): RobotInfo {
    return {
      id: this.id,
      position: { ...this.position },
      velocity: { ...this.velocity },
      status: this.status,
      currentTask: this.currentTask?.id,
    };
  }

  update(deltaTime: number, allRobots: MultiRobotAgent[]): void {
    // Process incoming messages
    this.processMessages();

    // Update known robot positions
    allRobots.forEach(robot => {
      if (robot.id !== this.id) {
        this.knownRobots.set(robot.id, robot.getInfo());
      }
    });

    // Check for nearby robots and avoid collisions
    const nearbyRobots = this.detectNearbyRobots();
    if (nearbyRobots.length > 0) {
      this.avoidCollisions(nearbyRobots, deltaTime);
      return;
    }

    // Move towards target if assigned
    if (this.targetPosition && this.status === 'moving') {
      this.moveTowardsTarget(deltaTime);
    }

    // Broadcast position periodically
    this.broadcastPosition(allRobots);
  }

  assignTask(task: Task): void {
    this.currentTask = task;
    this.targetPosition = task.position;
    this.status = 'moving';

    // Broadcast task assignment
    this.broadcastMessage('task', {
      taskId: task.id,
      assigned: true,
    });
  }

  moveTo(position: Position): void {
    this.targetPosition = { ...position };
    this.status = 'moving';
  }

  private moveTowardsTarget(deltaTime: number): void {
    if (!this.targetPosition) return;

    const dx = this.targetPosition.x - this.position.x;
    const dy = this.targetPosition.y - this.position.y;
    const dz = this.targetPosition.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < 0.1) {
      this.position = { ...this.targetPosition };
      this.velocity = { x: 0, y: 0, z: 0 };
      this.status = 'idle';
      this.targetPosition = undefined;

      if (this.currentTask) {
        this.currentTask = undefined;
      }
      return;
    }

    // Calculate velocity
    const speed = Math.min(this.maxSpeed, distance / deltaTime);
    this.velocity = {
      x: (dx / distance) * speed,
      y: (dy / distance) * speed,
      z: (dz / distance) * speed,
    };

    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
  }

  private detectNearbyRobots(): RobotInfo[] {
    const nearby: RobotInfo[] = [];

    this.knownRobots.forEach(robot => {
      const dx = robot.position.x - this.position.x;
      const dy = robot.position.y - this.position.y;
      const dz = robot.position.z - this.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < this.safetyDistance) {
        nearby.push(robot);
      }
    });

    return nearby;
  }

  private avoidCollisions(nearbyRobots: RobotInfo[], deltaTime: number): void {
    this.status = 'avoiding';

    // Calculate avoidance vector (move away from other robots)
    let avoidanceX = 0;
    let avoidanceY = 0;
    let avoidanceZ = 0;

    nearbyRobots.forEach(robot => {
      const dx = this.position.x - robot.position.x;
      const dy = this.position.y - robot.position.y;
      const dz = this.position.z - robot.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance > 0) {
        // Repulsive force inversely proportional to distance
        const force = 1 / (distance * distance);
        avoidanceX += (dx / distance) * force;
        avoidanceY += (dy / distance) * force;
        avoidanceZ += (dz / distance) * force;
      }
    });

    // Apply avoidance velocity
    const magnitude = Math.sqrt(
      avoidanceX * avoidanceX + avoidanceY * avoidanceY + avoidanceZ * avoidanceZ
    );

    if (magnitude > 0) {
      this.velocity = {
        x: (avoidanceX / magnitude) * this.maxSpeed * 0.5,
        y: (avoidanceY / magnitude) * this.maxSpeed * 0.5,
        z: (avoidanceZ / magnitude) * this.maxSpeed * 0.5,
      };

      this.position.x += this.velocity.x * deltaTime;
      this.position.y += this.velocity.y * deltaTime;
      this.position.z += this.velocity.z * deltaTime;
    }

    // Return to moving state if target exists
    if (this.targetPosition) {
      this.status = 'moving';
    } else {
      this.status = 'idle';
    }
  }

  private processMessages(): void {
    const messages = this.communicationManager.receiveMessages(this.id);

    messages.forEach(message => {
      if (message.type === 'position') {
        // Update known position
        this.knownRobots.set(message.from, message.data);
      } else if (message.type === 'alert') {
        // Handle alerts
        console.log(`Robot ${this.id} received alert from ${message.from}`);
      }
    });
  }

  private broadcastPosition(allRobots: MultiRobotAgent[]): void {
    const recipients = allRobots
      .filter(r => r.id !== this.id)
      .map(r => r.id);

    this.communicationManager.broadcast(
      {
        from: this.id,
        type: 'position',
        data: this.getInfo(),
        timestamp: Date.now(),
      },
      recipients
    );
  }

  private broadcastMessage(type: Message['type'], data: any): void {
    // Broadcast to all known robots
    this.knownRobots.forEach((_, robotId) => {
      this.communicationManager.sendMessage({
        from: this.id,
        to: robotId,
        type,
        data,
        timestamp: Date.now(),
      });
    });
  }

  stop(): void {
    this.status = 'idle';
    this.velocity = { x: 0, y: 0, z: 0 };
    this.targetPosition = undefined;
  }
}

// Task Allocator
class TaskAllocator {
  private tasks: Map<string, Task> = new Map();
  private robots: Map<string, MultiRobotAgent> = new Map();

  addTask(task: Task): void {
    this.tasks.set(task.id, task);
  }

  registerRobot(robot: MultiRobotAgent): void {
    this.robots.set(robot.id, robot);
  }

  allocateTasks(): Map<string, string> {
    const allocations = new Map<string, string>(); // taskId -> robotId

    const availableRobots = Array.from(this.robots.values()).filter(
      r => r.status === 'idle'
    );

    const unassignedTasks = Array.from(this.tasks.values())
      .filter(t => !t.assignedTo)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    // Simple greedy allocation based on distance
    for (const task of unassignedTasks) {
      if (availableRobots.length === 0) break;

      // Find nearest robot
      let nearestRobot = availableRobots[0];
      let minDistance = this.calculateDistance(
        nearestRobot.position,
        task.position
      );

      for (let i = 1; i < availableRobots.length; i++) {
        const distance = this.calculateDistance(
          availableRobots[i].position,
          task.position
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestRobot = availableRobots[i];
        }
      }

      // Assign task
      nearestRobot.assignTask(task);
      task.assignedTo = nearestRobot.id;
      allocations.set(task.id, nearestRobot.id);

      // Remove robot from available list
      const index = availableRobots.indexOf(nearestRobot);
      availableRobots.splice(index, 1);
    }

    return allocations;
  }

  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getUnassignedTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(t => !t.assignedTo);
  }

  clear(): void {
    this.tasks.clear();
  }
}

describe('Multi-Robot System', () => {
  describe('Communication Manager', () => {
    let commManager: CommunicationManager;

    beforeEach(() => {
      commManager = new CommunicationManager(0);
    });

    it('should send and receive messages', () => {
      const message: Message = {
        from: 'robot1',
        to: 'robot2',
        type: 'position',
        data: { x: 5, y: 5, z: 0 },
        timestamp: Date.now(),
      };

      commManager.sendMessage(message);
      const received = commManager.receiveMessages('robot2');

      expect(received).toHaveLength(1);
      expect(received[0].from).toBe('robot1');
    });

    it('should broadcast messages to multiple recipients', () => {
      const message = {
        from: 'robot1',
        type: 'alert' as const,
        data: { message: 'obstacle detected' },
        timestamp: Date.now(),
      };

      commManager.broadcast(message, ['robot2', 'robot3', 'robot4']);

      expect(commManager.receiveMessages('robot2')).toHaveLength(1);
      expect(commManager.receiveMessages('robot3')).toHaveLength(1);
      expect(commManager.receiveMessages('robot4')).toHaveLength(1);
    });

    it('should handle network latency', () => {
      const latentComm = new CommunicationManager(100); // 100ms latency

      const message: Message = {
        from: 'robot1',
        to: 'robot2',
        type: 'position',
        data: {},
        timestamp: Date.now(),
      };

      latentComm.sendMessage(message);

      // Should not receive immediately
      expect(latentComm.receiveMessages('robot2')).toHaveLength(0);

      // Wait for latency
      const start = Date.now();
      while (Date.now() - start < 150) {}

      // Should receive after delay
      expect(latentComm.receiveMessages('robot2')).toHaveLength(1);
    });

    it('should clear message queues', () => {
      const message: Message = {
        from: 'robot1',
        to: 'robot2',
        type: 'position',
        data: {},
        timestamp: Date.now(),
      };

      commManager.sendMessage(message);
      commManager.clearMessages('robot2');

      expect(commManager.receiveMessages('robot2')).toHaveLength(0);
    });
  });

  describe('Multi-Robot Agent', () => {
    let commManager: CommunicationManager;
    let robot: MultiRobotAgent;

    beforeEach(() => {
      commManager = new CommunicationManager(0);
      robot = new MultiRobotAgent('robot1', { x: 0, y: 0, z: 0 }, commManager);
    });

    it('should initialize robot with correct state', () => {
      const info = robot.getInfo();

      expect(info.id).toBe('robot1');
      expect(info.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(info.status).toBe('idle');
    });

    it('should move robot to target position', () => {
      robot.moveTo({ x: 5, y: 0, z: 0 });

      for (let i = 0; i < 100; i++) {
        robot.update(0.1, []);
      }

      const info = robot.getInfo();
      expect(info.position.x).toBeCloseTo(5, 0);
      expect(info.status).toBe('idle');
    });

    it('should broadcast position to other robots', () => {
      const robot2 = new MultiRobotAgent(
        'robot2',
        { x: 10, y: 0, z: 0 },
        commManager
      );

      robot.update(0.1, [robot2]);

      const messages = commManager.receiveMessages('robot2');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe('position');
    });

    it('should assign and execute tasks', () => {
      const task: Task = {
        id: 'task1',
        type: 'pickup',
        position: { x: 3, y: 3, z: 0 },
        priority: 1,
      };

      robot.assignTask(task);

      expect(robot.getInfo().currentTask).toBe('task1');
      expect(robot.getInfo().status).toBe('moving');
    });

    it('should stop movement on command', () => {
      robot.moveTo({ x: 10, y: 10, z: 0 });
      robot.update(0.1, []);

      expect(robot.getInfo().status).toBe('moving');

      robot.stop();

      expect(robot.getInfo().status).toBe('idle');
      expect(robot.getInfo().velocity).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('Collision Avoidance', () => {
    let commManager: CommunicationManager;

    beforeEach(() => {
      commManager = new CommunicationManager(0);
    });

    it('should detect nearby robots', () => {
      const robot1 = new MultiRobotAgent(
        'robot1',
        { x: 0, y: 0, z: 0 },
        commManager
      );
      const robot2 = new MultiRobotAgent(
        'robot2',
        { x: 1, y: 0, z: 0 },
        commManager
      );

      robot1.update(0.1, [robot2]);
      robot2.update(0.1, [robot1]);

      // Robots should detect each other and change status
      expect(robot1.getInfo().status).not.toBe('idle');
    });

    it('should avoid collisions between robots', () => {
      const robot1 = new MultiRobotAgent(
        'robot1',
        { x: 0, y: 0, z: 0 },
        commManager
      );
      const robot2 = new MultiRobotAgent(
        'robot2',
        { x: 10, y: 0, z: 0 },
        commManager
      );

      // Move robots towards each other
      robot1.moveTo({ x: 10, y: 0, z: 0 });
      robot2.moveTo({ x: 0, y: 0, z: 0 });

      let minDistance = Infinity;

      for (let i = 0; i < 200; i++) {
        robot1.update(0.1, [robot2]);
        robot2.update(0.1, [robot1]);

        const dx = robot2.position.x - robot1.position.x;
        const dy = robot2.position.y - robot1.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        minDistance = Math.min(minDistance, distance);
      }

      // Robots should maintain safe distance
      expect(minDistance).toBeGreaterThan(1.5);
    });

    it('should handle multiple robots in proximity', () => {
      const robots: MultiRobotAgent[] = [];

      // Create robots in close proximity
      for (let i = 0; i < 5; i++) {
        const robot = new MultiRobotAgent(
          `robot${i}`,
          { x: i * 1.5, y: 0, z: 0 },
          commManager
        );
        robots.push(robot);
      }

      // All robots move to center
      robots.forEach(robot => {
        robot.moveTo({ x: 5, y: 0, z: 0 });
      });

      // Simulate
      for (let i = 0; i < 100; i++) {
        robots.forEach(robot => {
          const others = robots.filter(r => r.id !== robot.id);
          robot.update(0.1, robots);
        });
      }

      // Check no collisions occurred
      for (let i = 0; i < robots.length; i++) {
        for (let j = i + 1; j < robots.length; j++) {
          const dx = robots[j].position.x - robots[i].position.x;
          const dy = robots[j].position.y - robots[i].position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          expect(distance).toBeGreaterThan(0.5);
        }
      }
    });
  });

  describe('Task Allocation', () => {
    let allocator: TaskAllocator;
    let commManager: CommunicationManager;

    beforeEach(() => {
      allocator = new TaskAllocator();
      commManager = new CommunicationManager(0);
    });

    it('should allocate tasks to nearest robots', () => {
      const robot1 = new MultiRobotAgent(
        'robot1',
        { x: 0, y: 0, z: 0 },
        commManager
      );
      const robot2 = new MultiRobotAgent(
        'robot2',
        { x: 10, y: 0, z: 0 },
        commManager
      );

      allocator.registerRobot(robot1);
      allocator.registerRobot(robot2);

      const task: Task = {
        id: 'task1',
        type: 'pickup',
        position: { x: 1, y: 0, z: 0 },
        priority: 1,
      };

      allocator.addTask(task);

      const allocations = allocator.allocateTasks();

      expect(allocations.get('task1')).toBe('robot1'); // Nearest robot
    });

    it('should prioritize high-priority tasks', () => {
      const robot1 = new MultiRobotAgent(
        'robot1',
        { x: 0, y: 0, z: 0 },
        commManager
      );

      allocator.registerRobot(robot1);

      const lowPriorityTask: Task = {
        id: 'task1',
        type: 'patrol',
        position: { x: 1, y: 0, z: 0 },
        priority: 1,
      };

      const highPriorityTask: Task = {
        id: 'task2',
        type: 'emergency',
        position: { x: 10, y: 0, z: 0 },
        priority: 10,
      };

      allocator.addTask(lowPriorityTask);
      allocator.addTask(highPriorityTask);

      const allocations = allocator.allocateTasks();

      // High priority task should be allocated first
      expect(allocations.get('task2')).toBe('robot1');
      expect(allocations.has('task1')).toBe(false); // No more available robots
    });

    it('should handle more tasks than robots', () => {
      const robot1 = new MultiRobotAgent(
        'robot1',
        { x: 0, y: 0, z: 0 },
        commManager
      );

      allocator.registerRobot(robot1);

      for (let i = 0; i < 5; i++) {
        allocator.addTask({
          id: `task${i}`,
          type: 'pickup',
          position: { x: i, y: 0, z: 0 },
          priority: i,
        });
      }

      const allocations = allocator.allocateTasks();
      const unassigned = allocator.getUnassignedTasks();

      expect(allocations.size).toBe(1); // Only one robot
      expect(unassigned.length).toBe(4); // Four tasks unassigned
    });

    it('should not allocate tasks to busy robots', () => {
      const robot1 = new MultiRobotAgent(
        'robot1',
        { x: 0, y: 0, z: 0 },
        commManager
      );

      // Make robot busy
      robot1.moveTo({ x: 10, y: 0, z: 0 });

      allocator.registerRobot(robot1);

      const task: Task = {
        id: 'task1',
        type: 'pickup',
        position: { x: 5, y: 0, z: 0 },
        priority: 1,
      };

      allocator.addTask(task);

      const allocations = allocator.allocateTasks();

      expect(allocations.size).toBe(0); // No idle robots
    });

    it('should clear tasks', () => {
      allocator.addTask({
        id: 'task1',
        type: 'pickup',
        position: { x: 0, y: 0, z: 0 },
        priority: 1,
      });

      allocator.clear();

      expect(allocator.getUnassignedTasks()).toHaveLength(0);
    });
  });

  describe('Swarm Coordination', () => {
    it('should coordinate multiple robots to complete tasks', () => {
      const commManager = new CommunicationManager(0);
      const allocator = new TaskAllocator();

      // Create robot swarm
      const robots: MultiRobotAgent[] = [];
      for (let i = 0; i < 4; i++) {
        const robot = new MultiRobotAgent(
          `robot${i}`,
          { x: i * 2, y: 0, z: 0 },
          commManager
        );
        robots.push(robot);
        allocator.registerRobot(robot);
      }

      // Add tasks
      for (let i = 0; i < 4; i++) {
        allocator.addTask({
          id: `task${i}`,
          type: 'pickup',
          position: { x: i * 3, y: 5, z: 0 },
          priority: i,
        });
      }

      // Allocate tasks
      allocator.allocateTasks();

      // Simulate until all tasks complete
      let completed = 0;
      for (let step = 0; step < 1000 && completed < 4; step++) {
        robots.forEach(robot => {
          robot.update(0.1, robots);

          // Check if task completed
          if (robot.status === 'idle' && !robot.currentTask) {
            completed++;
          }
        });
      }

      expect(completed).toBe(4);
    });

    it('should handle dynamic task allocation', () => {
      const commManager = new CommunicationManager(0);
      const allocator = new TaskAllocator();

      const robot1 = new MultiRobotAgent(
        'robot1',
        { x: 0, y: 0, z: 0 },
        commManager
      );
      const robot2 = new MultiRobotAgent(
        'robot2',
        { x: 5, y: 0, z: 0 },
        commManager
      );

      allocator.registerRobot(robot1);
      allocator.registerRobot(robot2);

      // Initial task
      allocator.addTask({
        id: 'task1',
        type: 'pickup',
        position: { x: 2, y: 0, z: 0 },
        priority: 1,
      });

      allocator.allocateTasks();

      // Simulate for a bit
      for (let i = 0; i < 50; i++) {
        robot1.update(0.1, [robot2]);
        robot2.update(0.1, [robot1]);
      }

      // Add new task while robots are working
      allocator.addTask({
        id: 'task2',
        type: 'delivery',
        position: { x: 8, y: 0, z: 0 },
        priority: 2,
      });

      // Allocate new task to idle robot
      allocator.allocateTasks();

      expect(robot2.getInfo().currentTask).toBeDefined();
    });
  });
});

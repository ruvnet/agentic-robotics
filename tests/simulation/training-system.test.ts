/**
 * Training System Test Suite
 *
 * Comprehensive tests for robot learning and training including:
 * - Reinforcement learning algorithms
 * - Policy optimization
 * - Reward functions
 * - Experience replay
 * - Neural network training
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock training interfaces
interface State {
  position: number[];
  velocity: number[];
  observations: number[];
}

interface Action {
  type: 'move' | 'rotate' | 'stop';
  parameters: number[];
}

interface Experience {
  state: State;
  action: Action;
  reward: number;
  nextState: State;
  done: boolean;
}

interface TrainingMetrics {
  episode: number;
  totalReward: number;
  averageReward: number;
  loss: number;
  epsilon: number;
}

interface Policy {
  selectAction(state: State, epsilon?: number): Action;
  update(experiences: Experience[]): number;
  save(): string;
  load(data: string): void;
}

// Mock Q-Learning implementation
class QLearningAgent implements Policy {
  private qTable: Map<string, Map<string, number>> = new Map();
  private learningRate: number;
  private discountFactor: number;
  private epsilon: number;
  private actions: Action[];

  constructor(
    learningRate: number = 0.1,
    discountFactor: number = 0.95,
    epsilon: number = 0.1
  ) {
    this.learningRate = learningRate;
    this.discountFactor = discountFactor;
    this.epsilon = epsilon;
    this.actions = [
      { type: 'move', parameters: [1, 0] },
      { type: 'move', parameters: [0, 1] },
      { type: 'move', parameters: [-1, 0] },
      { type: 'move', parameters: [0, -1] },
      { type: 'stop', parameters: [] },
    ];
  }

  private stateToString(state: State): string {
    return JSON.stringify(state.position);
  }

  private actionToString(action: Action): string {
    return JSON.stringify(action);
  }

  selectAction(state: State, epsilon: number = this.epsilon): Action {
    // Epsilon-greedy policy
    if (Math.random() < epsilon) {
      // Random action
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    }

    // Greedy action
    const stateKey = this.stateToString(state);
    const actionValues = this.qTable.get(stateKey);

    if (!actionValues || actionValues.size === 0) {
      return this.actions[0];
    }

    let bestAction = this.actions[0];
    let bestValue = -Infinity;

    for (const action of this.actions) {
      const actionKey = this.actionToString(action);
      const value = actionValues.get(actionKey) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  update(experiences: Experience[]): number {
    let totalLoss = 0;

    for (const exp of experiences) {
      const stateKey = this.stateToString(exp.state);
      const actionKey = this.actionToString(exp.action);
      const nextStateKey = this.stateToString(exp.nextState);

      // Initialize Q-value storage if needed
      if (!this.qTable.has(stateKey)) {
        this.qTable.set(stateKey, new Map());
      }

      const stateActions = this.qTable.get(stateKey)!;
      const currentQ = stateActions.get(actionKey) || 0;

      // Get max Q-value for next state
      let maxNextQ = 0;
      if (!exp.done) {
        const nextStateActions = this.qTable.get(nextStateKey);
        if (nextStateActions) {
          maxNextQ = Math.max(...Array.from(nextStateActions.values()));
        }
      }

      // Q-learning update
      const targetQ = exp.reward + this.discountFactor * maxNextQ;
      const newQ = currentQ + this.learningRate * (targetQ - currentQ);
      stateActions.set(actionKey, newQ);

      totalLoss += Math.pow(targetQ - currentQ, 2);
    }

    return totalLoss / experiences.length;
  }

  save(): string {
    const data = {
      qTable: Array.from(this.qTable.entries()).map(([state, actions]) => ({
        state,
        actions: Array.from(actions.entries()),
      })),
      learningRate: this.learningRate,
      discountFactor: this.discountFactor,
      epsilon: this.epsilon,
    };
    return JSON.stringify(data);
  }

  load(data: string): void {
    const parsed = JSON.parse(data);
    this.learningRate = parsed.learningRate;
    this.discountFactor = parsed.discountFactor;
    this.epsilon = parsed.epsilon;
    this.qTable = new Map(
      parsed.qTable.map((entry: any) => [
        entry.state,
        new Map(entry.actions),
      ])
    );
  }

  getQTableSize(): number {
    return this.qTable.size;
  }

  setEpsilon(epsilon: number): void {
    this.epsilon = epsilon;
  }
}

// Experience Replay Buffer
class ReplayBuffer {
  private buffer: Experience[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  add(experience: Experience): void {
    this.buffer.push(experience);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  sample(batchSize: number): Experience[] {
    const samples: Experience[] = [];
    for (let i = 0; i < Math.min(batchSize, this.buffer.length); i++) {
      const index = Math.floor(Math.random() * this.buffer.length);
      samples.push(this.buffer[index]);
    }
    return samples;
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

// Training Environment
class GridWorld {
  private width: number;
  private height: number;
  private agentPosition: number[];
  private goalPosition: number[];
  private obstacles: Set<string>;

  constructor(width: number = 10, height: number = 10) {
    this.width = width;
    this.height = height;
    this.agentPosition = [0, 0];
    this.goalPosition = [width - 1, height - 1];
    this.obstacles = new Set();
  }

  reset(): State {
    this.agentPosition = [0, 0];
    return this.getState();
  }

  getState(): State {
    return {
      position: [...this.agentPosition],
      velocity: [0, 0],
      observations: [
        this.agentPosition[0] / this.width,
        this.agentPosition[1] / this.height,
        this.goalPosition[0] / this.width,
        this.goalPosition[1] / this.height,
      ],
    };
  }

  step(action: Action): { state: State; reward: number; done: boolean } {
    if (action.type === 'move') {
      const newX = this.agentPosition[0] + action.parameters[0];
      const newY = this.agentPosition[1] + action.parameters[1];

      // Check bounds
      if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
        const newPosKey = `${newX},${newY}`;
        if (!this.obstacles.has(newPosKey)) {
          this.agentPosition = [newX, newY];
        }
      }
    }

    const done =
      this.agentPosition[0] === this.goalPosition[0] &&
      this.agentPosition[1] === this.goalPosition[1];

    const reward = this.calculateReward(done);

    return { state: this.getState(), reward, done };
  }

  private calculateReward(reachedGoal: boolean): number {
    if (reachedGoal) {
      return 100; // Large reward for reaching goal
    }

    // Distance-based reward
    const dx = this.goalPosition[0] - this.agentPosition[0];
    const dy = this.goalPosition[1] - this.agentPosition[1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    return -0.1 - distance * 0.01; // Small negative reward for each step
  }

  addObstacle(x: number, y: number): void {
    this.obstacles.add(`${x},${y}`);
  }

  setGoal(x: number, y: number): void {
    this.goalPosition = [x, y];
  }
}

// Training Manager
class TrainingManager {
  private agent: Policy;
  private environment: GridWorld;
  private replayBuffer: ReplayBuffer;
  private metrics: TrainingMetrics[] = [];

  constructor(agent: Policy, environment: GridWorld, bufferSize: number = 1000) {
    this.agent = agent;
    this.environment = environment;
    this.replayBuffer = new ReplayBuffer(bufferSize);
  }

  trainEpisode(maxSteps: number = 100, epsilon: number = 0.1): TrainingMetrics {
    let state = this.environment.reset();
    let totalReward = 0;
    let steps = 0;
    let totalLoss = 0;

    for (let step = 0; step < maxSteps; step++) {
      const action = this.agent.selectAction(state, epsilon);
      const { state: nextState, reward, done } = this.environment.step(action);

      this.replayBuffer.add({ state, action, reward, nextState, done });

      totalReward += reward;
      steps++;

      // Train on batch
      if (this.replayBuffer.size() >= 32) {
        const batch = this.replayBuffer.sample(32);
        const loss = this.agent.update(batch);
        totalLoss += loss;
      }

      state = nextState;

      if (done) {
        break;
      }
    }

    const metrics: TrainingMetrics = {
      episode: this.metrics.length,
      totalReward,
      averageReward: totalReward / steps,
      loss: totalLoss / steps,
      epsilon,
    };

    this.metrics.push(metrics);
    return metrics;
  }

  train(numEpisodes: number, epsilonDecay: number = 0.995): TrainingMetrics[] {
    let epsilon = 1.0;

    for (let episode = 0; episode < numEpisodes; episode++) {
      this.trainEpisode(100, epsilon);
      epsilon = Math.max(0.01, epsilon * epsilonDecay);
    }

    return this.metrics;
  }

  getMetrics(): TrainingMetrics[] {
    return this.metrics;
  }

  test(numEpisodes: number = 10): number {
    let totalReward = 0;

    for (let episode = 0; episode < numEpisodes; episode++) {
      let state = this.environment.reset();
      let episodeReward = 0;

      for (let step = 0; step < 100; step++) {
        const action = this.agent.selectAction(state, 0); // No exploration
        const { state: nextState, reward, done } = this.environment.step(action);

        episodeReward += reward;
        state = nextState;

        if (done) {
          break;
        }
      }

      totalReward += episodeReward;
    }

    return totalReward / numEpisodes;
  }
}

describe('Training System', () => {
  describe('Q-Learning Agent', () => {
    let agent: QLearningAgent;

    beforeEach(() => {
      agent = new QLearningAgent(0.1, 0.95, 0.1);
    });

    it('should initialize agent with correct parameters', () => {
      expect(agent).toBeDefined();
      expect(agent.getQTableSize()).toBe(0);
    });

    it('should select random actions with high epsilon', () => {
      const state: State = {
        position: [0, 0],
        velocity: [0, 0],
        observations: [0, 0, 1, 1],
      };

      const actions = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const action = agent.selectAction(state, 1.0); // Always random
        actions.add(JSON.stringify(action));
      }

      expect(actions.size).toBeGreaterThan(1); // Should explore different actions
    });

    it('should select greedy actions with zero epsilon', () => {
      const state: State = {
        position: [0, 0],
        velocity: [0, 0],
        observations: [0, 0, 1, 1],
      };

      // Train with some experiences
      const experiences: Experience[] = [
        {
          state,
          action: { type: 'move', parameters: [1, 0] },
          reward: 10,
          nextState: { position: [1, 0], velocity: [0, 0], observations: [] },
          done: false,
        },
      ];

      agent.update(experiences);

      // Should consistently select the best action
      const actions: string[] = [];
      for (let i = 0; i < 10; i++) {
        const action = agent.selectAction(state, 0); // Always greedy
        actions.push(JSON.stringify(action));
      }

      // All actions should be the same
      expect(new Set(actions).size).toBe(1);
    });

    it('should update Q-values based on experiences', () => {
      const state: State = {
        position: [0, 0],
        velocity: [0, 0],
        observations: [0, 0, 1, 1],
      };

      const initialSize = agent.getQTableSize();

      const experiences: Experience[] = [
        {
          state,
          action: { type: 'move', parameters: [1, 0] },
          reward: 10,
          nextState: { position: [1, 0], velocity: [0, 0], observations: [] },
          done: false,
        },
      ];

      agent.update(experiences);

      expect(agent.getQTableSize()).toBeGreaterThan(initialSize);
    });

    it('should calculate loss during updates', () => {
      const state: State = {
        position: [0, 0],
        velocity: [0, 0],
        observations: [0, 0, 1, 1],
      };

      const experiences: Experience[] = [
        {
          state,
          action: { type: 'move', parameters: [1, 0] },
          reward: 10,
          nextState: { position: [1, 0], velocity: [0, 0], observations: [] },
          done: false,
        },
      ];

      const loss = agent.update(experiences);

      expect(loss).toBeGreaterThan(0);
      expect(loss).toBeLessThan(1000);
    });

    it('should save and load policy', () => {
      const state: State = {
        position: [0, 0],
        velocity: [0, 0],
        observations: [0, 0, 1, 1],
      };

      // Train agent
      const experiences: Experience[] = [
        {
          state,
          action: { type: 'move', parameters: [1, 0] },
          reward: 10,
          nextState: { position: [1, 0], velocity: [0, 0], observations: [] },
          done: false,
        },
      ];

      agent.update(experiences);
      const savedData = agent.save();

      // Create new agent and load
      const newAgent = new QLearningAgent();
      newAgent.load(savedData);

      expect(newAgent.getQTableSize()).toBe(agent.getQTableSize());
    });

    it('should allow epsilon modification', () => {
      agent.setEpsilon(0.5);

      // Test that exploration rate has changed
      const state: State = {
        position: [0, 0],
        velocity: [0, 0],
        observations: [0, 0, 1, 1],
      };

      const actions = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const action = agent.selectAction(state, 0.5);
        actions.add(JSON.stringify(action));
      }

      expect(actions.size).toBeGreaterThan(1);
    });
  });

  describe('Experience Replay Buffer', () => {
    let buffer: ReplayBuffer;

    beforeEach(() => {
      buffer = new ReplayBuffer(100);
    });

    it('should store experiences', () => {
      const experience: Experience = {
        state: { position: [0, 0], velocity: [0, 0], observations: [] },
        action: { type: 'move', parameters: [1, 0] },
        reward: 1,
        nextState: { position: [1, 0], velocity: [0, 0], observations: [] },
        done: false,
      };

      buffer.add(experience);

      expect(buffer.size()).toBe(1);
    });

    it('should respect maximum buffer size', () => {
      const smallBuffer = new ReplayBuffer(10);

      for (let i = 0; i < 20; i++) {
        const experience: Experience = {
          state: { position: [i, 0], velocity: [0, 0], observations: [] },
          action: { type: 'move', parameters: [1, 0] },
          reward: 1,
          nextState: { position: [i + 1, 0], velocity: [0, 0], observations: [] },
          done: false,
        };
        smallBuffer.add(experience);
      }

      expect(smallBuffer.size()).toBe(10);
    });

    it('should sample random batches', () => {
      // Add multiple experiences
      for (let i = 0; i < 50; i++) {
        const experience: Experience = {
          state: { position: [i, 0], velocity: [0, 0], observations: [] },
          action: { type: 'move', parameters: [1, 0] },
          reward: i,
          nextState: { position: [i + 1, 0], velocity: [0, 0], observations: [] },
          done: false,
        };
        buffer.add(experience);
      }

      const batch1 = buffer.sample(10);
      const batch2 = buffer.sample(10);

      expect(batch1.length).toBe(10);
      expect(batch2.length).toBe(10);

      // Batches should be different (with high probability)
      const batch1Rewards = batch1.map(e => e.reward).sort();
      const batch2Rewards = batch2.map(e => e.reward).sort();
      expect(JSON.stringify(batch1Rewards)).not.toBe(JSON.stringify(batch2Rewards));
    });

    it('should clear buffer', () => {
      for (let i = 0; i < 10; i++) {
        const experience: Experience = {
          state: { position: [i, 0], velocity: [0, 0], observations: [] },
          action: { type: 'move', parameters: [1, 0] },
          reward: 1,
          nextState: { position: [i + 1, 0], velocity: [0, 0], observations: [] },
          done: false,
        };
        buffer.add(experience);
      }

      buffer.clear();

      expect(buffer.size()).toBe(0);
    });

    it('should handle sampling when buffer is smaller than batch size', () => {
      for (let i = 0; i < 5; i++) {
        const experience: Experience = {
          state: { position: [i, 0], velocity: [0, 0], observations: [] },
          action: { type: 'move', parameters: [1, 0] },
          reward: 1,
          nextState: { position: [i + 1, 0], velocity: [0, 0], observations: [] },
          done: false,
        };
        buffer.add(experience);
      }

      const batch = buffer.sample(10);

      expect(batch.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Grid World Environment', () => {
    let env: GridWorld;

    beforeEach(() => {
      env = new GridWorld(10, 10);
    });

    it('should initialize with correct dimensions', () => {
      const state = env.getState();

      expect(state.position).toEqual([0, 0]);
    });

    it('should reset to initial state', () => {
      // Move agent
      env.step({ type: 'move', parameters: [1, 0] });
      const movedState = env.getState();
      expect(movedState.position).not.toEqual([0, 0]);

      // Reset
      const resetState = env.reset();
      expect(resetState.position).toEqual([0, 0]);
    });

    it('should move agent in valid directions', () => {
      env.step({ type: 'move', parameters: [1, 0] }); // Move right
      let state = env.getState();
      expect(state.position).toEqual([1, 0]);

      env.step({ type: 'move', parameters: [0, 1] }); // Move up
      state = env.getState();
      expect(state.position).toEqual([1, 1]);
    });

    it('should prevent movement outside bounds', () => {
      // Try to move left from origin
      env.step({ type: 'move', parameters: [-1, 0] });
      const state = env.getState();

      expect(state.position).toEqual([0, 0]); // Should stay at origin
    });

    it('should detect goal reached', () => {
      env.setGoal(2, 2);

      env.step({ type: 'move', parameters: [1, 0] });
      env.step({ type: 'move', parameters: [1, 0] });
      let result = env.step({ type: 'move', parameters: [0, 1] });
      expect(result.done).toBe(false);

      result = env.step({ type: 'move', parameters: [0, 1] });
      expect(result.done).toBe(true);
    });

    it('should provide positive reward for reaching goal', () => {
      env.setGoal(1, 0);

      const result = env.step({ type: 'move', parameters: [1, 0] });

      expect(result.reward).toBeGreaterThan(50);
      expect(result.done).toBe(true);
    });

    it('should provide negative reward for each step', () => {
      const result = env.step({ type: 'move', parameters: [1, 0] });

      expect(result.reward).toBeLessThan(0);
    });

    it('should handle obstacles', () => {
      env.addObstacle(1, 0);

      env.step({ type: 'move', parameters: [1, 0] });
      const state = env.getState();

      expect(state.position).toEqual([0, 0]); // Should not move into obstacle
    });
  });

  describe('Training Manager', () => {
    let agent: QLearningAgent;
    let environment: GridWorld;
    let trainer: TrainingManager;

    beforeEach(() => {
      agent = new QLearningAgent(0.1, 0.95, 0.1);
      environment = new GridWorld(5, 5);
      environment.setGoal(4, 4);
      trainer = new TrainingManager(agent, environment);
    });

    it('should train for single episode', () => {
      const metrics = trainer.trainEpisode(100, 0.1);

      expect(metrics.episode).toBe(0);
      expect(metrics.totalReward).toBeDefined();
      expect(metrics.averageReward).toBeDefined();
    });

    it('should improve performance over multiple episodes', () => {
      const metrics = trainer.train(50, 0.99);

      expect(metrics.length).toBe(50);

      // Average reward should generally improve (check last 10 vs first 10)
      const earlyRewards = metrics.slice(0, 10).map(m => m.totalReward);
      const lateRewards = metrics.slice(-10).map(m => m.totalReward);

      const earlyAvg = earlyRewards.reduce((a, b) => a + b, 0) / earlyRewards.length;
      const lateAvg = lateRewards.reduce((a, b) => a + b, 0) / lateRewards.length;

      expect(lateAvg).toBeGreaterThan(earlyAvg);
    });

    it('should decrease epsilon during training', () => {
      const metrics = trainer.train(20, 0.95);

      expect(metrics[0].epsilon).toBeGreaterThan(metrics[metrics.length - 1].epsilon);
    });

    it('should collect training metrics', () => {
      trainer.train(10);
      const metrics = trainer.getMetrics();

      expect(metrics.length).toBe(10);
      metrics.forEach(m => {
        expect(m.episode).toBeDefined();
        expect(m.totalReward).toBeDefined();
        expect(m.averageReward).toBeDefined();
        expect(m.loss).toBeDefined();
        expect(m.epsilon).toBeDefined();
      });
    });

    it('should test trained agent performance', () => {
      // Train agent
      trainer.train(100, 0.95);

      // Test performance (no exploration)
      const averageReward = trainer.test(10);

      expect(averageReward).toBeDefined();
      expect(averageReward).toBeGreaterThan(-100); // Should learn something
    });

    it('should handle training with obstacles', () => {
      environment.addObstacle(2, 2);
      environment.addObstacle(2, 3);

      trainer.train(50, 0.95);
      const averageReward = trainer.test(5);

      expect(averageReward).toBeDefined();
    });
  });

  describe('Learning Performance', () => {
    it('should train efficiently on simple tasks', () => {
      const agent = new QLearningAgent(0.2, 0.95, 0.2);
      const environment = new GridWorld(3, 3);
      environment.setGoal(2, 2);
      const trainer = new TrainingManager(agent, environment);

      const startTime = performance.now();
      trainer.train(100, 0.99);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete in 2 seconds
    });

    it('should handle complex environments', () => {
      const agent = new QLearningAgent(0.1, 0.95, 0.3);
      const environment = new GridWorld(10, 10);
      environment.setGoal(9, 9);

      // Add multiple obstacles
      for (let i = 0; i < 10; i++) {
        environment.addObstacle(
          Math.floor(Math.random() * 10),
          Math.floor(Math.random() * 10)
        );
      }

      const trainer = new TrainingManager(agent, environment);

      expect(() => {
        trainer.train(50, 0.95);
      }).not.toThrow();
    });

    it('should converge to optimal policy', () => {
      const agent = new QLearningAgent(0.3, 0.99, 0.5);
      const environment = new GridWorld(4, 4);
      environment.setGoal(3, 3);
      const trainer = new TrainingManager(agent, environment);

      // Train extensively
      trainer.train(200, 0.99);

      // Test performance
      const testReward = trainer.test(20);

      // Should consistently reach the goal (reward > 90)
      expect(testReward).toBeGreaterThan(80);
    });
  });
});

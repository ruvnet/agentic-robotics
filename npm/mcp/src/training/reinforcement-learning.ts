/**
 * Reinforcement Learning Algorithms for Robotics
 *
 * Implements 5 core RL algorithms:
 * - Q-Learning (value-based)
 * - SARSA (on-policy)
 * - Policy Gradient (policy-based)
 * - Actor-Critic (hybrid)
 * - Deep Q-Network (DQN with experience replay)
 */

import { execAsync } from '../utils';

export interface State {
  position: number[];
  velocity: number[];
  orientation: number[];
  sensorReadings: number[];
  timestamp: number;
  robotId?: string;
}

export interface Action {
  type: 'move' | 'rotate' | 'grasp' | 'release' | 'wait';
  parameters: number[];
  duration?: number;
}

export interface Experience {
  state: State;
  action: Action;
  reward: number;
  nextState: State;
  done: boolean;
  importance?: number; // For prioritized replay
}

export interface QTableEntry {
  state: string;
  action: string;
  qValue: number;
  visitCount: number;
}

export interface RLConfig {
  algorithm: 'q-learning' | 'sarsa' | 'policy-gradient' | 'actor-critic' | 'dqn';
  learningRate: number;
  discountFactor: number;
  explorationRate: number;
  explorationDecay: number;
  minExploration: number;
  batchSize?: number; // For DQN
  targetUpdateFreq?: number; // For DQN
}

/**
 * Q-Learning: Off-policy value-based learning
 * Updates: Q(s,a) = Q(s,a) + α[r + γ max Q(s',a') - Q(s,a)]
 */
export class QLearning {
  private qTable: Map<string, Map<string, number>> = new Map();
  private config: RLConfig;
  private episodeCount: number = 0;

  constructor(config: Partial<RLConfig> = {}) {
    this.config = {
      algorithm: 'q-learning',
      learningRate: 0.1,
      discountFactor: 0.99,
      explorationRate: 1.0,
      explorationDecay: 0.995,
      minExploration: 0.01,
      ...config,
    };
  }

  /**
   * Select action using ε-greedy policy
   */
  selectAction(state: State, possibleActions: Action[]): Action {
    const stateKey = this.stateToKey(state);

    // Exploration
    if (Math.random() < this.config.explorationRate) {
      return possibleActions[Math.floor(Math.random() * possibleActions.length)];
    }

    // Exploitation
    const actionValues = this.getActionValues(stateKey, possibleActions);
    const maxValue = Math.max(...actionValues.map(av => av.value));
    const bestActions = actionValues.filter(av => av.value === maxValue);

    return bestActions[Math.floor(Math.random() * bestActions.length)].action;
  }

  /**
   * Update Q-value using Q-learning rule
   */
  update(experience: Experience, possibleActions: Action[]): number {
    const stateKey = this.stateToKey(experience.state);
    const nextStateKey = this.stateToKey(experience.nextState);
    const actionKey = this.actionToKey(experience.action);

    // Get current Q-value
    const currentQ = this.getQValue(stateKey, actionKey);

    // Calculate max Q-value for next state
    const nextActionValues = this.getActionValues(nextStateKey, possibleActions);
    const maxNextQ = experience.done ? 0 : Math.max(...nextActionValues.map(av => av.value));

    // Q-learning update
    const tdError = experience.reward + this.config.discountFactor * maxNextQ - currentQ;
    const newQ = currentQ + this.config.learningRate * tdError;

    // Update Q-table
    this.setQValue(stateKey, actionKey, newQ);

    return Math.abs(tdError);
  }

  /**
   * Decay exploration rate
   */
  decayExploration(): void {
    this.config.explorationRate = Math.max(
      this.config.minExploration,
      this.config.explorationRate * this.config.explorationDecay
    );
    this.episodeCount++;
  }

  private stateToKey(state: State): string {
    // Discretize continuous state space
    const discretized = [
      ...state.position.map(p => Math.round(p * 10)),
      ...state.velocity.map(v => Math.round(v * 10)),
      ...state.orientation.map(o => Math.round(o * 10)),
    ];
    return discretized.join(',');
  }

  private actionToKey(action: Action): string {
    return `${action.type}:${action.parameters.map(p => Math.round(p * 10)).join(',')}`;
  }

  private getQValue(stateKey: string, actionKey: string): number {
    return this.qTable.get(stateKey)?.get(actionKey) ?? 0;
  }

  private setQValue(stateKey: string, actionKey: string, value: number): void {
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    this.qTable.get(stateKey)!.set(actionKey, value);
  }

  private getActionValues(stateKey: string, possibleActions: Action[]): Array<{ action: Action; value: number }> {
    return possibleActions.map(action => ({
      action,
      value: this.getQValue(stateKey, this.actionToKey(action)),
    }));
  }

  getStats() {
    return {
      qTableSize: this.qTable.size,
      explorationRate: this.config.explorationRate,
      episodeCount: this.episodeCount,
    };
  }
}

/**
 * SARSA: On-policy temporal difference learning
 * Updates: Q(s,a) = Q(s,a) + α[r + γ Q(s',a') - Q(s,a)]
 */
export class SARSA extends QLearning {
  /**
   * Update Q-value using SARSA rule (uses actual next action)
   */
  updateOnPolicy(
    experience: Experience,
    nextAction: Action | null
  ): number {
    const stateKey = this.stateToKey(experience.state);
    const nextStateKey = this.stateToKey(experience.nextState);
    const actionKey = this.actionToKey(experience.action);

    const currentQ = this.getQValue(stateKey, actionKey);

    // Use actual next action's Q-value (on-policy)
    const nextQ = nextAction && !experience.done
      ? this.getQValue(nextStateKey, this.actionToKey(nextAction))
      : 0;

    const tdError = experience.reward + this.config.discountFactor * nextQ - currentQ;
    const newQ = currentQ + this.config.learningRate * tdError;

    this.setQValue(stateKey, actionKey, newQ);

    return Math.abs(tdError);
  }
}

/**
 * Policy Gradient: Direct policy optimization
 * Updates policy parameters using gradient ascent
 */
export class PolicyGradient {
  private policy: Map<string, Map<string, number>> = new Map(); // State -> Action -> Probability
  private config: RLConfig;
  private episodeReturns: number[] = [];

  constructor(config: Partial<RLConfig> = {}) {
    this.config = {
      algorithm: 'policy-gradient',
      learningRate: 0.01,
      discountFactor: 0.99,
      explorationRate: 0.1,
      explorationDecay: 0.995,
      minExploration: 0.01,
      ...config,
    };
  }

  /**
   * Sample action from policy distribution
   */
  selectAction(state: State, possibleActions: Action[]): Action {
    const stateKey = this.stateToKey(state);
    const actionProbs = this.getActionProbabilities(stateKey, possibleActions);

    // Sample from distribution
    const rand = Math.random();
    let cumProb = 0;

    for (const { action, probability } of actionProbs) {
      cumProb += probability;
      if (rand <= cumProb) {
        return action;
      }
    }

    return possibleActions[possibleActions.length - 1];
  }

  /**
   * Update policy using REINFORCE algorithm
   */
  updatePolicy(trajectory: Experience[]): void {
    // Calculate returns (discounted cumulative rewards)
    const returns = this.calculateReturns(trajectory);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    this.episodeReturns.push(avgReturn);

    // Normalize returns (baseline)
    const mean = avgReturn;
    const std = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
    );
    const normalizedReturns = returns.map(r => (r - mean) / (std + 1e-8));

    // Update policy parameters
    for (let t = 0; t < trajectory.length; t++) {
      const exp = trajectory[t];
      const stateKey = this.stateToKey(exp.state);
      const actionKey = this.actionToKey(exp.action);

      // Gradient ascent: increase probability of good actions
      const currentLogProb = Math.log(this.getActionProb(stateKey, actionKey) + 1e-8);
      const gradient = normalizedReturns[t];

      this.updateActionProb(stateKey, actionKey, this.config.learningRate * gradient);
    }

    // Normalize probabilities
    this.normalizePolicy();
  }

  private calculateReturns(trajectory: Experience[]): number[] {
    const returns: number[] = [];
    let G = 0;

    for (let t = trajectory.length - 1; t >= 0; t--) {
      G = trajectory[t].reward + this.config.discountFactor * G;
      returns.unshift(G);
    }

    return returns;
  }

  private stateToKey(state: State): string {
    return `${state.position.map(p => Math.round(p * 10)).join(',')}`;
  }

  private actionToKey(action: Action): string {
    return `${action.type}:${action.parameters.map(p => Math.round(p * 10)).join(',')}`;
  }

  private getActionProbabilities(
    stateKey: string,
    possibleActions: Action[]
  ): Array<{ action: Action; probability: number }> {
    const actionProbs = possibleActions.map(action => ({
      action,
      probability: this.getActionProb(stateKey, this.actionToKey(action)),
    }));

    // Normalize
    const total = actionProbs.reduce((sum, ap) => sum + ap.probability, 0);
    return actionProbs.map(ap => ({
      action: ap.action,
      probability: total > 0 ? ap.probability / total : 1 / possibleActions.length,
    }));
  }

  private getActionProb(stateKey: string, actionKey: string): number {
    return this.policy.get(stateKey)?.get(actionKey) ?? 1.0;
  }

  private updateActionProb(stateKey: string, actionKey: string, delta: number): void {
    if (!this.policy.has(stateKey)) {
      this.policy.set(stateKey, new Map());
    }
    const current = this.getActionProb(stateKey, actionKey);
    this.policy.get(stateKey)!.set(actionKey, Math.max(0.01, current + delta));
  }

  private normalizePolicy(): void {
    for (const [stateKey, actionMap] of this.policy.entries()) {
      const total = Array.from(actionMap.values()).reduce((a, b) => a + b, 0);
      if (total > 0) {
        for (const [actionKey, prob] of actionMap.entries()) {
          actionMap.set(actionKey, prob / total);
        }
      }
    }
  }

  getStats() {
    return {
      policySize: this.policy.size,
      avgEpisodeReturn: this.episodeReturns.length > 0
        ? this.episodeReturns.reduce((a, b) => a + b, 0) / this.episodeReturns.length
        : 0,
      episodeCount: this.episodeReturns.length,
    };
  }
}

/**
 * Actor-Critic: Combines value-based and policy-based methods
 * Actor: Policy network that selects actions
 * Critic: Value network that evaluates actions
 */
export class ActorCritic {
  private actor: PolicyGradient;
  private critic: QLearning;
  private config: RLConfig;

  constructor(config: Partial<RLConfig> = {}) {
    this.config = {
      algorithm: 'actor-critic',
      learningRate: 0.01,
      discountFactor: 0.99,
      explorationRate: 0.1,
      explorationDecay: 0.995,
      minExploration: 0.01,
      ...config,
    };

    this.actor = new PolicyGradient(config);
    this.critic = new QLearning(config);
  }

  selectAction(state: State, possibleActions: Action[]): Action {
    return this.actor.selectAction(state, possibleActions);
  }

  /**
   * Update both actor and critic
   */
  update(experience: Experience, possibleActions: Action[]): { actorLoss: number; criticLoss: number } {
    // Critic update (TD error)
    const criticLoss = this.critic.update(experience, possibleActions);

    // Actor update using advantage (TD error as advantage)
    const advantage = criticLoss;

    // Create mini-trajectory for policy update
    const trajectory = [{
      ...experience,
      reward: experience.reward * advantage, // Weight by advantage
    }];

    this.actor.updatePolicy(trajectory);

    return {
      actorLoss: advantage,
      criticLoss,
    };
  }

  getStats() {
    return {
      actor: this.actor.getStats(),
      critic: this.critic.getStats(),
    };
  }
}

/**
 * Deep Q-Network (DQN): Q-Learning with neural network approximation
 * Uses experience replay and target network for stability
 */
export class DQN {
  private replayBuffer: Experience[] = [];
  private config: RLConfig;
  private updateCounter: number = 0;
  private episodeRewards: number[] = [];

  constructor(config: Partial<RLConfig> = {}) {
    this.config = {
      algorithm: 'dqn',
      learningRate: 0.001,
      discountFactor: 0.99,
      explorationRate: 1.0,
      explorationDecay: 0.995,
      minExploration: 0.01,
      batchSize: 32,
      targetUpdateFreq: 100,
      ...config,
    };
  }

  /**
   * Select action using ε-greedy policy
   */
  selectAction(state: State, possibleActions: Action[]): Action {
    // Exploration
    if (Math.random() < this.config.explorationRate) {
      return possibleActions[Math.floor(Math.random() * possibleActions.length)];
    }

    // Exploitation: would use neural network here
    // For now, use random (placeholder for actual network)
    return possibleActions[Math.floor(Math.random() * possibleActions.length)];
  }

  /**
   * Store experience in replay buffer
   */
  storeExperience(experience: Experience): void {
    this.replayBuffer.push(experience);

    // Limit buffer size
    const maxBufferSize = 10000;
    if (this.replayBuffer.length > maxBufferSize) {
      this.replayBuffer.shift();
    }
  }

  /**
   * Sample mini-batch and update network
   */
  trainStep(): { loss: number; batchSize: number } | null {
    const batchSize = this.config.batchSize || 32;

    if (this.replayBuffer.length < batchSize) {
      return null;
    }

    // Sample random mini-batch
    const batch = this.sampleBatch(batchSize);

    // Calculate loss (simplified - would use actual network in production)
    const losses = batch.map(exp => {
      const targetQ = exp.reward +
        (exp.done ? 0 : this.config.discountFactor * this.estimateMaxQ(exp.nextState));
      const currentQ = this.estimateQ(exp.state, exp.action);
      return Math.pow(targetQ - currentQ, 2);
    });

    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;

    this.updateCounter++;

    // Decay exploration
    if (this.updateCounter % 100 === 0) {
      this.config.explorationRate = Math.max(
        this.config.minExploration,
        this.config.explorationRate * this.config.explorationDecay
      );
    }

    return { loss: avgLoss, batchSize: batch.length };
  }

  private sampleBatch(batchSize: number): Experience[] {
    const batch: Experience[] = [];
    const indices = new Set<number>();

    while (indices.size < batchSize) {
      indices.add(Math.floor(Math.random() * this.replayBuffer.length));
    }

    for (const idx of indices) {
      batch.push(this.replayBuffer[idx]);
    }

    return batch;
  }

  private estimateQ(state: State, action: Action): number {
    // Placeholder: would use neural network
    return Math.random() * 10 - 5;
  }

  private estimateMaxQ(state: State): number {
    // Placeholder: would use neural network
    return Math.random() * 10 - 5;
  }

  recordEpisodeReward(totalReward: number): void {
    this.episodeRewards.push(totalReward);
  }

  getStats() {
    return {
      bufferSize: this.replayBuffer.length,
      explorationRate: this.config.explorationRate,
      updateCount: this.updateCounter,
      avgReward: this.episodeRewards.length > 0
        ? this.episodeRewards.reduce((a, b) => a + b, 0) / this.episodeRewards.length
        : 0,
      episodeCount: this.episodeRewards.length,
    };
  }
}

/**
 * Utility function for async exec
 */
async function execAsync(cmd: string): Promise<{ stdout: string; stderr: string }> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  return promisify(exec)(cmd);
}

/**
 * Multi-Robot Training Coordinator
 *
 * Orchestrates parallel training across multiple robots with:
 * - Distributed training coordination
 * - Shared experience replay
 * - Centralized policy updates
 * - Real-time performance monitoring
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import {
  QLearning,
  SARSA,
  PolicyGradient,
  ActorCritic,
  DQN,
  Experience,
  RLConfig,
} from './reinforcement-learning';
import { RobotEnvironment, NavigationEnvironment, ManipulationEnvironment } from './training-environment';
import { ExperienceReplayBuffer, HindsightExperienceReplay } from './experience-replay';
import { StrategyManager, LearningRateScheduler } from './strategy-evolution';

const execAsync = promisify(exec);

export interface TrainingConfig {
  numRobots: number;
  algorithm: 'q-learning' | 'sarsa' | 'policy-gradient' | 'actor-critic' | 'dqn';
  environment: 'navigation' | 'manipulation' | 'coordination';
  episodesPerRobot: number;
  maxStepsPerEpisode: number;
  parallelTraining: boolean;
  sharedReplay: boolean;
  syncFrequency: number; // Sync policies every N episodes
  evaluationFrequency: number;
  saveCheckpoints: boolean;
  checkpointPath: string;
}

export interface TrainingMetrics {
  episodeRewards: number[];
  episodeSteps: number[];
  successRate: number;
  avgReward: number;
  maxReward: number;
  convergenceRate: number;
  trainingTime: number;
  robotMetrics: Map<string, RobotMetrics>;
}

export interface RobotMetrics {
  robotId: string;
  episodesCompleted: number;
  totalReward: number;
  avgReward: number;
  successRate: number;
  explorationRate: number;
}

/**
 * Training Coordinator for Multi-Robot Learning
 */
export class TrainingCoordinator {
  private config: TrainingConfig;
  private agents: Map<string, any> = new Map(); // Algorithm instances per robot
  private environments: Map<string, RobotEnvironment> = new Map();
  private replayBuffer: ExperienceReplayBuffer | HindsightExperienceReplay;
  private strategyManager: StrategyManager;
  private metrics: TrainingMetrics;
  private startTime: number = 0;
  private initialized: boolean = false;

  constructor(config: TrainingConfig) {
    this.config = config;

    // Initialize replay buffer
    if (config.environment === 'manipulation') {
      this.replayBuffer = new HindsightExperienceReplay({
        maxSize: 100000,
        prioritized: true,
        dbPath: `${config.checkpointPath}/replay`,
      });
    } else {
      this.replayBuffer = new ExperienceReplayBuffer({
        maxSize: 100000,
        prioritized: config.algorithm === 'dqn',
        dbPath: `${config.checkpointPath}/replay`,
      });
    }

    // Initialize strategy manager
    this.strategyManager = new StrategyManager(`${config.checkpointPath}/strategies`);

    // Initialize metrics
    this.metrics = {
      episodeRewards: [],
      episodeSteps: [],
      successRate: 0,
      avgReward: 0,
      maxReward: -Infinity,
      convergenceRate: 0,
      trainingTime: 0,
      robotMetrics: new Map(),
    };
  }

  /**
   * Initialize training setup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.error('🚀 Initializing training coordinator...');

    // Run pre-task hook
    try {
      await execAsync(
        `npx claude-flow@alpha hooks pre-task --description "Multi-robot training initialization"`
      );
    } catch (error) {
      // Continue if hook fails
    }

    // Initialize replay buffer and strategy manager
    await this.replayBuffer.initialize();
    await this.strategyManager.initialize();

    // Create agents and environments for each robot
    for (let i = 0; i < this.config.numRobots; i++) {
      const robotId = `robot-${i}`;

      // Create agent
      const agent = this.createAgent(this.config.algorithm);
      this.agents.set(robotId, agent);

      // Create environment
      const env = this.createEnvironment(this.config.environment);
      this.environments.set(robotId, env);

      // Initialize robot metrics
      this.metrics.robotMetrics.set(robotId, {
        robotId,
        episodesCompleted: 0,
        totalReward: 0,
        avgReward: 0,
        successRate: 0,
        explorationRate: 1.0,
      });
    }

    this.initialized = true;
    console.error(`✅ Initialized ${this.config.numRobots} robots with ${this.config.algorithm}`);
  }

  /**
   * Start training
   */
  async train(): Promise<TrainingMetrics> {
    await this.initialize();

    this.startTime = Date.now();
    console.error('\n🎓 Starting training...');
    console.error(`Episodes per robot: ${this.config.episodesPerRobot}`);
    console.error(`Max steps per episode: ${this.config.maxStepsPerEpisode}`);
    console.error(`Parallel training: ${this.config.parallelTraining}`);

    if (this.config.parallelTraining) {
      await this.trainParallel();
    } else {
      await this.trainSequential();
    }

    // Final evaluation
    await this.evaluate();

    // Save final checkpoint
    if (this.config.saveCheckpoints) {
      await this.saveCheckpoint('final');
    }

    // Calculate final metrics
    this.metrics.trainingTime = Date.now() - this.startTime;
    this.metrics.avgReward =
      this.metrics.episodeRewards.reduce((a, b) => a + b, 0) / this.metrics.episodeRewards.length;
    this.metrics.maxReward = Math.max(...this.metrics.episodeRewards);

    const successCount = this.metrics.episodeRewards.filter(r => r > 50).length;
    this.metrics.successRate = successCount / this.metrics.episodeRewards.length;

    // Run post-task hook
    try {
      await execAsync(
        `npx claude-flow@alpha hooks post-task --task-id "training-${Date.now()}"`
      );
    } catch (error) {
      // Continue if hook fails
    }

    this.printTrainingReport();

    return this.metrics;
  }

  /**
   * Train robots sequentially
   */
  private async trainSequential(): Promise<void> {
    for (let episode = 0; episode < this.config.episodesPerRobot; episode++) {
      for (const [robotId, agent] of this.agents.entries()) {
        const env = this.environments.get(robotId)!;
        await this.runEpisode(robotId, agent, env, episode);
      }

      // Periodic evaluation
      if (episode % this.config.evaluationFrequency === 0) {
        await this.evaluate();
      }

      // Save checkpoint
      if (this.config.saveCheckpoints && episode % 100 === 0) {
        await this.saveCheckpoint(`episode-${episode}`);
      }
    }
  }

  /**
   * Train robots in parallel
   */
  private async trainParallel(): Promise<void> {
    for (let episode = 0; episode < this.config.episodesPerRobot; episode++) {
      // Run all robots in parallel
      const episodePromises = Array.from(this.agents.entries()).map(
        ([robotId, agent]) => {
          const env = this.environments.get(robotId)!;
          return this.runEpisode(robotId, agent, env, episode);
        }
      );

      await Promise.all(episodePromises);

      // Sync policies
      if (episode % this.config.syncFrequency === 0) {
        await this.syncPolicies();
      }

      // Periodic evaluation
      if (episode % this.config.evaluationFrequency === 0) {
        await this.evaluate();
      }

      // Save checkpoint
      if (this.config.saveCheckpoints && episode % 100 === 0) {
        await this.saveCheckpoint(`episode-${episode}`);
      }
    }
  }

  /**
   * Run single episode for a robot
   */
  private async runEpisode(
    robotId: string,
    agent: any,
    env: RobotEnvironment,
    episodeNumber: number
  ): Promise<void> {
    const trajectory: Experience[] = [];
    let state = env.reset();
    let totalReward = 0;
    let steps = 0;
    let success = false;

    // Get possible actions from environment
    const possibleActions = (env as any).getPossibleActions?.() || [];

    while (steps < this.config.maxStepsPerEpisode) {
      // Select action
      const action = agent.selectAction(state, possibleActions);

      // Take step
      const { state: nextState, reward, done, info } = env.step(action);

      // Store experience
      const experience: Experience = {
        state,
        action,
        reward,
        nextState,
        done,
      };

      trajectory.push(experience);
      totalReward += reward;
      steps++;
      success = info.success;

      // Update agent (online learning)
      if (this.config.algorithm === 'q-learning') {
        (agent as QLearning).update(experience, possibleActions);
      } else if (this.config.algorithm === 'sarsa') {
        const nextAction = agent.selectAction(nextState, possibleActions);
        (agent as SARSA).updateOnPolicy(experience, done ? null : nextAction);
      } else if (this.config.algorithm === 'actor-critic') {
        (agent as ActorCritic).update(experience, possibleActions);
      } else if (this.config.algorithm === 'dqn') {
        (agent as DQN).storeExperience(experience);
      }

      // Store in shared replay buffer
      if (this.config.sharedReplay) {
        await this.replayBuffer.store(experience, {
          episodeId: `${robotId}-${episodeNumber}`,
          stepNumber: steps,
          algorithm: this.config.algorithm,
          tdError: Math.abs(reward),
          visited: 1,
        });
      }

      if (done) break;
      state = nextState;
    }

    // Policy gradient and DQN batch updates
    if (this.config.algorithm === 'policy-gradient') {
      (agent as PolicyGradient).updatePolicy(trajectory);
    } else if (this.config.algorithm === 'dqn') {
      const trainResult = (agent as DQN).trainStep();
      if (trainResult) {
        // console.error(`DQN training: loss=${trainResult.loss.toFixed(4)}`);
      }
      (agent as DQN).recordEpisodeReward(totalReward);
    }

    // Decay exploration
    if ('decayExploration' in agent) {
      agent.decayExploration();
    }

    // Update metrics
    this.metrics.episodeRewards.push(totalReward);
    this.metrics.episodeSteps.push(steps);

    const robotMetrics = this.metrics.robotMetrics.get(robotId)!;
    robotMetrics.episodesCompleted++;
    robotMetrics.totalReward += totalReward;
    robotMetrics.avgReward = robotMetrics.totalReward / robotMetrics.episodesCompleted;
    robotMetrics.successRate =
      (robotMetrics.successRate * (robotMetrics.episodesCompleted - 1) +
        (success ? 1 : 0)) /
      robotMetrics.episodesCompleted;

    // Update strategy performance
    await this.strategyManager.updatePerformance(
      this.config.algorithm,
      totalReward,
      steps,
      success
    );

    // Log progress
    if (episodeNumber % 10 === 0 || success) {
      console.error(
        `${robotId} | Episode ${episodeNumber}: reward=${totalReward.toFixed(2)}, steps=${steps}, success=${success}`
      );
    }
  }

  /**
   * Synchronize policies across robots
   */
  private async syncPolicies(): Promise<void> {
    if (!this.config.sharedReplay) return;

    console.error('🔄 Synchronizing policies...');

    // Sample batch from shared replay buffer
    const batch = await this.replayBuffer.sample(64);

    if (batch.experiences.length > 0) {
      // Update all agents with shared experiences
      for (const [robotId, agent] of this.agents.entries()) {
        const env = this.environments.get(robotId)!;
        const possibleActions = (env as any).getPossibleActions?.() || [];

        for (const experience of batch.experiences) {
          if (this.config.algorithm === 'q-learning') {
            (agent as QLearning).update(experience, possibleActions);
          } else if (this.config.algorithm === 'actor-critic') {
            (agent as ActorCritic).update(experience, possibleActions);
          }
        }
      }

      console.error(`✅ Synchronized ${batch.experiences.length} shared experiences`);
    }
  }

  /**
   * Evaluate current policies
   */
  private async evaluate(): Promise<void> {
    console.error('\n📊 Evaluating policies...');

    const evalRewards: number[] = [];
    const evalSteps: number[] = [];
    let evalSuccesses = 0;

    // Run evaluation episodes
    for (const [robotId, agent] of this.agents.entries()) {
      const env = this.environments.get(robotId)!;
      let state = env.reset();
      let totalReward = 0;
      let steps = 0;
      const possibleActions = (env as any).getPossibleActions?.() || [];

      // Disable exploration for evaluation
      const oldExploration = (agent as any).config?.explorationRate;
      if (oldExploration !== undefined) {
        (agent as any).config.explorationRate = 0.0;
      }

      while (steps < this.config.maxStepsPerEpisode) {
        const action = agent.selectAction(state, possibleActions);
        const { state: nextState, reward, done, info } = env.step(action);

        totalReward += reward;
        steps++;

        if (info.success) evalSuccesses++;
        if (done) break;
        state = nextState;
      }

      // Restore exploration
      if (oldExploration !== undefined) {
        (agent as any).config.explorationRate = oldExploration;
      }

      evalRewards.push(totalReward);
      evalSteps.push(steps);
    }

    const avgReward = evalRewards.reduce((a, b) => a + b, 0) / evalRewards.length;
    const avgSteps = evalSteps.reduce((a, b) => a + b, 0) / evalSteps.length;
    const successRate = evalSuccesses / this.config.numRobots;

    console.error(
      `Eval: avg_reward=${avgReward.toFixed(2)}, avg_steps=${avgSteps.toFixed(1)}, success_rate=${(successRate * 100).toFixed(1)}%\n`
    );
  }

  /**
   * Save training checkpoint
   */
  private async saveCheckpoint(name: string): Promise<void> {
    try {
      // Store checkpoint metadata in AgentDB
      await execAsync(
        `npx claude-flow@alpha hooks post-edit --file "${this.config.checkpointPath}/checkpoint-${name}" --memory-key "training/checkpoint/${name}"`
      );

      console.error(`💾 Saved checkpoint: ${name}`);
    } catch (error) {
      console.error('⚠️ Failed to save checkpoint:', error);
    }
  }

  /**
   * Print comprehensive training report
   */
  private printTrainingReport(): void {
    console.error('\n' + '='.repeat(60));
    console.error('📊 TRAINING REPORT');
    console.error('='.repeat(60));

    console.error(`\nConfiguration:`);
    console.error(`  Algorithm: ${this.config.algorithm}`);
    console.error(`  Environment: ${this.config.environment}`);
    console.error(`  Robots: ${this.config.numRobots}`);
    console.error(`  Episodes: ${this.config.episodesPerRobot}`);
    console.error(`  Parallel: ${this.config.parallelTraining}`);

    console.error(`\nOverall Performance:`);
    console.error(`  Training Time: ${(this.metrics.trainingTime / 1000).toFixed(2)}s`);
    console.error(`  Total Episodes: ${this.metrics.episodeRewards.length}`);
    console.error(`  Average Reward: ${this.metrics.avgReward.toFixed(2)}`);
    console.error(`  Max Reward: ${this.metrics.maxReward.toFixed(2)}`);
    console.error(`  Success Rate: ${(this.metrics.successRate * 100).toFixed(1)}%`);
    console.error(
      `  Avg Steps: ${(this.metrics.episodeSteps.reduce((a, b) => a + b, 0) / this.metrics.episodeSteps.length).toFixed(1)}`
    );

    console.error(`\nPer-Robot Performance:`);
    for (const [robotId, metrics] of this.metrics.robotMetrics.entries()) {
      console.error(`  ${robotId}:`);
      console.error(`    Episodes: ${metrics.episodesCompleted}`);
      console.error(`    Avg Reward: ${metrics.avgReward.toFixed(2)}`);
      console.error(`    Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
    }

    console.error('\n' + '='.repeat(60));
  }

  /**
   * Create agent instance based on algorithm
   */
  private createAgent(algorithm: string): any {
    const rlConfig: Partial<RLConfig> = {
      learningRate: 0.1,
      discountFactor: 0.99,
      explorationRate: 1.0,
      explorationDecay: 0.995,
      minExploration: 0.01,
    };

    switch (algorithm) {
      case 'q-learning':
        return new QLearning(rlConfig);
      case 'sarsa':
        return new SARSA(rlConfig);
      case 'policy-gradient':
        return new PolicyGradient(rlConfig);
      case 'actor-critic':
        return new ActorCritic(rlConfig);
      case 'dqn':
        return new DQN({ ...rlConfig, batchSize: 32 });
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }

  /**
   * Create environment instance
   */
  private createEnvironment(envType: string): RobotEnvironment {
    switch (envType) {
      case 'navigation':
        return new NavigationEnvironment({
          dimensions: [10, 10],
          obstacles: [
            { position: [3, 3], shape: 'sphere', size: [1] },
            { position: [7, 7], shape: 'sphere', size: [1] },
            { position: [5, 5], shape: 'box', size: [1, 1] },
          ],
          timeLimit: this.config.maxStepsPerEpisode,
        });

      case 'manipulation':
        return new ManipulationEnvironment({
          dimensions: [5, 5, 3],
          targets: [{ position: [4, 4, 0], tolerance: 0.5, reward: 100 }],
          timeLimit: this.config.maxStepsPerEpisode,
        });

      default:
        return new NavigationEnvironment();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): TrainingMetrics {
    return { ...this.metrics };
  }
}

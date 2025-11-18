/**
 * Agentic Robotics Training System
 *
 * Comprehensive training and learning system with:
 * - 5 RL algorithms (Q-Learning, SARSA, Policy Gradient, Actor-Critic, DQN)
 * - Multiple training environments (Navigation, Manipulation, Coordination)
 * - Experience replay with AgentDB integration
 * - Strategy evolution and optimization
 * - Multi-robot training coordination
 *
 * @example
 * ```typescript
 * import { TrainingCoordinator } from '@agentic-robotics/mcp/training';
 *
 * const coordinator = new TrainingCoordinator({
 *   numRobots: 4,
 *   algorithm: 'dqn',
 *   environment: 'navigation',
 *   episodesPerRobot: 1000,
 *   maxStepsPerEpisode: 500,
 *   parallelTraining: true,
 *   sharedReplay: true,
 *   syncFrequency: 10,
 *   evaluationFrequency: 50,
 *   saveCheckpoints: true,
 *   checkpointPath: '.agentdb/training',
 * });
 *
 * await coordinator.initialize();
 * const metrics = await coordinator.train();
 *
 * console.log(`Training complete! Success rate: ${metrics.successRate * 100}%`);
 * ```
 *
 * @packageDocumentation
 */

// Reinforcement Learning Algorithms
export {
  QLearning,
  SARSA,
  PolicyGradient,
  ActorCritic,
  DQN,
  type State,
  type Action,
  type Experience,
  type QTableEntry,
  type RLConfig,
} from './reinforcement-learning';

// Training Environments
export {
  RobotEnvironment,
  NavigationEnvironment,
  ManipulationEnvironment,
  CoordinationEnvironment,
  type EnvironmentConfig,
  type Obstacle,
  type Target,
  type RewardShaping,
  type EnvironmentStep,
} from './training-environment';

// Experience Replay
export {
  ExperienceReplayBuffer,
  HindsightExperienceReplay,
  type ExperienceMetadata,
  type ReplayBufferConfig,
  type SampledBatch,
} from './experience-replay';

// Strategy Evolution
export {
  StrategyManager,
  LearningRateScheduler,
  HyperparameterOptimizer,
  type Strategy,
  type StrategyPerformance,
  type EvolutionConfig,
  type LearningSchedule,
} from './strategy-evolution';

// Training Coordinator
export {
  TrainingCoordinator,
  type TrainingConfig,
  type TrainingMetrics,
  type RobotMetrics,
} from './training-coordinator';

/**
 * Quick start function for training
 */
export async function quickTrain(options: {
  algorithm?: 'q-learning' | 'sarsa' | 'policy-gradient' | 'actor-critic' | 'dqn';
  environment?: 'navigation' | 'manipulation' | 'coordination';
  robots?: number;
  episodes?: number;
}): Promise<void> {
  const { TrainingCoordinator } = await import('./training-coordinator');

  const coordinator = new TrainingCoordinator({
    numRobots: options.robots || 2,
    algorithm: options.algorithm || 'dqn',
    environment: options.environment || 'navigation',
    episodesPerRobot: options.episodes || 500,
    maxStepsPerEpisode: 500,
    parallelTraining: true,
    sharedReplay: true,
    syncFrequency: 10,
    evaluationFrequency: 50,
    saveCheckpoints: true,
    checkpointPath: '.agentdb/training',
  });

  const metrics = await coordinator.train();

  console.log('\n✅ Training complete!');
  console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
  console.log(`Average reward: ${metrics.avgReward.toFixed(2)}`);
  console.log(`Training time: ${(metrics.trainingTime / 1000).toFixed(2)}s`);
}

/**
 * Create a training coordinator with default settings
 */
export function createTrainingCoordinator(
  algorithm: 'q-learning' | 'sarsa' | 'policy-gradient' | 'actor-critic' | 'dqn',
  environment: 'navigation' | 'manipulation' | 'coordination'
) {
  const { TrainingCoordinator } = require('./training-coordinator');

  return new TrainingCoordinator({
    numRobots: 2,
    algorithm,
    environment,
    episodesPerRobot: 500,
    maxStepsPerEpisode: 500,
    parallelTraining: true,
    sharedReplay: true,
    syncFrequency: 10,
    evaluationFrequency: 50,
    saveCheckpoints: true,
    checkpointPath: '.agentdb/training',
  });
}

/**
 * Training system version
 */
export const VERSION = '1.0.0';

/**
 * Supported algorithms
 */
export const ALGORITHMS = [
  'q-learning',
  'sarsa',
  'policy-gradient',
  'actor-critic',
  'dqn',
] as const;

/**
 * Supported environments
 */
export const ENVIRONMENTS = [
  'navigation',
  'manipulation',
  'coordination',
] as const;

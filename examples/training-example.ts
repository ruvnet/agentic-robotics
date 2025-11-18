/**
 * Training System Usage Example
 *
 * Demonstrates how to use the comprehensive training system
 * for robot learning with different algorithms and environments.
 */

import {
  TrainingCoordinator,
  quickTrain,
  NavigationEnvironment,
  QLearning,
  DQN,
  ExperienceReplayBuffer,
  StrategyManager,
} from '../npm/mcp/src/training';

/**
 * Example 1: Quick start training
 */
async function example1_QuickStart() {
  console.log('\n=== Example 1: Quick Start Training ===\n');

  await quickTrain({
    algorithm: 'dqn',
    environment: 'navigation',
    robots: 2,
    episodes: 100,
  });
}

/**
 * Example 2: Advanced training with full configuration
 */
async function example2_AdvancedTraining() {
  console.log('\n=== Example 2: Advanced Training Configuration ===\n');

  const coordinator = new TrainingCoordinator({
    numRobots: 4,
    algorithm: 'actor-critic',
    environment: 'navigation',
    episodesPerRobot: 500,
    maxStepsPerEpisode: 500,
    parallelTraining: true,
    sharedReplay: true,
    syncFrequency: 10,
    evaluationFrequency: 50,
    saveCheckpoints: true,
    checkpointPath: '.agentdb/training-example',
  });

  await coordinator.initialize();
  const metrics = await coordinator.train();

  console.log('\nTraining Results:');
  console.log(`  Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
  console.log(`  Average Reward: ${metrics.avgReward.toFixed(2)}`);
  console.log(`  Max Reward: ${metrics.maxReward.toFixed(2)}`);
  console.log(`  Training Time: ${(metrics.trainingTime / 1000).toFixed(2)}s`);
  console.log(`  Total Episodes: ${metrics.episodeRewards.length}`);

  // Per-robot metrics
  console.log('\nPer-Robot Performance:');
  for (const [robotId, robotMetrics] of metrics.robotMetrics.entries()) {
    console.log(`  ${robotId}:`);
    console.log(`    Episodes: ${robotMetrics.episodesCompleted}`);
    console.log(`    Avg Reward: ${robotMetrics.avgReward.toFixed(2)}`);
    console.log(`    Success Rate: ${(robotMetrics.successRate * 100).toFixed(1)}%`);
  }
}

/**
 * Example 3: Single robot training with Q-Learning
 */
async function example3_SingleRobotQLearning() {
  console.log('\n=== Example 3: Single Robot Q-Learning ===\n');

  // Create environment
  const env = new NavigationEnvironment({
    dimensions: [10, 10],
    obstacles: [
      { position: [3, 3], shape: 'sphere', size: [1] },
      { position: [7, 7], shape: 'sphere', size: [1] },
    ],
    timeLimit: 500,
  });

  // Create Q-Learning agent
  const agent = new QLearning({
    learningRate: 0.1,
    discountFactor: 0.99,
    explorationRate: 1.0,
    explorationDecay: 0.995,
    minExploration: 0.01,
  });

  const possibleActions = env.getPossibleActions();

  // Train for 200 episodes
  const rewards: number[] = [];

  for (let episode = 0; episode < 200; episode++) {
    let state = env.reset();
    let totalReward = 0;
    let steps = 0;

    while (steps < 500) {
      // Select and execute action
      const action = agent.selectAction(state, possibleActions);
      const { state: nextState, reward, done } = env.step(action);

      // Update Q-values
      agent.update({ state, action, reward, nextState, done }, possibleActions);

      totalReward += reward;
      steps++;

      if (done) break;
      state = nextState;
    }

    // Decay exploration
    agent.decayExploration();

    rewards.push(totalReward);

    // Log progress
    if (episode % 20 === 0) {
      const recentRewards = rewards.slice(-20);
      const avgRecent =
        recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length;
      console.log(
        `Episode ${episode}: reward=${totalReward.toFixed(2)}, avg_recent=${avgRecent.toFixed(2)}, exploration=${agent.getStats().explorationRate.toFixed(3)}`
      );
    }
  }

  // Final statistics
  const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  const maxReward = Math.max(...rewards);
  const successCount = rewards.filter(r => r > 50).length;
  const successRate = (successCount / rewards.length) * 100;

  console.log('\nTraining Complete!');
  console.log(`  Average Reward: ${avgReward.toFixed(2)}`);
  console.log(`  Max Reward: ${maxReward.toFixed(2)}`);
  console.log(`  Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`  Q-Table Size: ${agent.getStats().qTableSize}`);
}

/**
 * Example 4: Experience replay with AgentDB
 */
async function example4_ExperienceReplay() {
  console.log('\n=== Example 4: Experience Replay with AgentDB ===\n');

  // Create replay buffer
  const replayBuffer = new ExperienceReplayBuffer({
    maxSize: 10000,
    prioritized: true,
    alpha: 0.6,
    beta: 0.4,
    dbPath: '.agentdb/example-replay',
  });

  await replayBuffer.initialize();

  // Create environment and agent
  const env = new NavigationEnvironment();
  const agent = new DQN({
    learningRate: 0.001,
    discountFactor: 0.99,
    explorationRate: 1.0,
    batchSize: 32,
  });

  const possibleActions = env.getPossibleActions();

  // Collect experiences
  console.log('Collecting experiences...');
  for (let episode = 0; episode < 50; episode++) {
    let state = env.reset();
    let steps = 0;

    while (steps < 100) {
      const action = agent.selectAction(state, possibleActions);
      const { state: nextState, reward, done } = env.step(action);

      const experience = { state, action, reward, nextState, done };

      // Store in replay buffer
      await replayBuffer.store(experience, {
        episodeId: `episode-${episode}`,
        stepNumber: steps,
        algorithm: 'dqn',
        tdError: Math.abs(reward),
        visited: 1,
      });

      // Store in DQN
      agent.storeExperience(experience);

      // Train from replay buffer
      const trainResult = agent.trainStep();
      if (trainResult && steps % 10 === 0) {
        console.log(
          `  Episode ${episode}, Step ${steps}: loss=${trainResult.loss.toFixed(4)}`
        );
      }

      steps++;
      if (done) break;
      state = nextState;
    }
  }

  // Get buffer statistics
  const stats = await replayBuffer.getStats();
  console.log('\nReplay Buffer Statistics:');
  console.log(`  Size: ${stats.size}/${stats.maxSize}`);
  console.log(`  Prioritized: ${stats.prioritized}`);
  console.log(`  Max Priority: ${stats.maxPriority.toFixed(3)}`);

  // Sample similar experiences
  console.log('\nSampling similar experiences...');
  const queryState = {
    position: [5, 5],
    velocity: [0, 0],
    orientation: [0, 0, 0],
    sensorReadings: [2, 2, 2, 2, 2, 2, 2, 2],
    timestamp: Date.now(),
  };

  const similarExps = await replayBuffer.sampleSimilar(queryState, 5);
  console.log(`Found ${similarExps.length} similar experiences`);
}

/**
 * Example 5: Strategy evolution and optimization
 */
async function example5_StrategyEvolution() {
  console.log('\n=== Example 5: Strategy Evolution ===\n');

  const strategyManager = new StrategyManager('.agentdb/example-strategies');
  await strategyManager.initialize();

  // Register multiple strategies
  const strategies = [
    {
      id: 'strategy-1',
      name: 'Aggressive Q-Learning',
      algorithm: 'q-learning',
      hyperparameters: { learningRate: 0.3, explorationRate: 0.5 },
      performance: {
        episodesRun: 0,
        totalReward: 0,
        avgReward: 0,
        maxReward: 0,
        minReward: 0,
        successRate: 0,
        avgSteps: 0,
        convergenceRate: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: 'strategy-2',
      name: 'Conservative Q-Learning',
      algorithm: 'q-learning',
      hyperparameters: { learningRate: 0.05, explorationRate: 0.9 },
      performance: {
        episodesRun: 0,
        totalReward: 0,
        avgReward: 0,
        maxReward: 0,
        minReward: 0,
        successRate: 0,
        avgSteps: 0,
        convergenceRate: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: 'strategy-3',
      name: 'DQN with Replay',
      algorithm: 'dqn',
      hyperparameters: { learningRate: 0.001, batchSize: 64 },
      performance: {
        episodesRun: 0,
        totalReward: 0,
        avgReward: 0,
        maxReward: 0,
        minReward: 0,
        successRate: 0,
        avgSteps: 0,
        convergenceRate: 0,
        lastUpdated: Date.now(),
      },
    },
  ];

  for (const strategy of strategies) {
    await strategyManager.registerStrategy(strategy);
  }

  // Simulate strategy performance
  console.log('Evaluating strategies...');
  for (let i = 0; i < 20; i++) {
    for (const strategy of strategies) {
      const reward = Math.random() * 100 - 20 + i * 2; // Improving over time
      const steps = Math.floor(Math.random() * 100) + 50;
      const success = reward > 50;

      await strategyManager.updatePerformance(strategy.id, reward, steps, success);
    }
  }

  // Select best strategy
  const bestStrategy = await strategyManager.selectBestStrategy('reward');
  console.log('\nBest Strategy Selected:');
  console.log(`  Name: ${bestStrategy?.name}`);
  console.log(`  Algorithm: ${bestStrategy?.algorithm}`);
  console.log(`  Avg Reward: ${bestStrategy?.performance.avgReward.toFixed(2)}`);
  console.log(`  Success Rate: ${(bestStrategy?.performance.successRate * 100).toFixed(1)}%`);

  // Get top strategies
  const topStrategies = await strategyManager.getTopStrategies(3);
  console.log('\nTop 3 Strategies:');
  topStrategies.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name}: ${s.performance.avgReward.toFixed(2)} avg reward`);
  });

  // Get statistics
  const stats = await strategyManager.getStats();
  console.log('\nStrategy Manager Statistics:');
  console.log(`  Total Strategies: ${stats.totalStrategies}`);
  console.log(`  Active Strategies: ${stats.activeStrategies}`);
  console.log(`  Best Performance: ${stats.bestPerformance.toFixed(2)}`);
  console.log(`  Avg Performance: ${stats.avgPerformance.toFixed(2)}`);
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log('🤖 Agentic Robotics Training System Examples');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  try {
    if (example === 'all' || example === '1') {
      await example1_QuickStart();
    }

    if (example === 'all' || example === '2') {
      await example2_AdvancedTraining();
    }

    if (example === 'all' || example === '3') {
      await example3_SingleRobotQLearning();
    }

    if (example === 'all' || example === '4') {
      await example4_ExperienceReplay();
    }

    if (example === 'all' || example === '5') {
      await example5_StrategyEvolution();
    }

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run examples if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_QuickStart,
  example2_AdvancedTraining,
  example3_SingleRobotQLearning,
  example4_ExperienceReplay,
  example5_StrategyEvolution,
};

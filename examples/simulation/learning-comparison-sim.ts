#!/usr/bin/env node
/**
 * Learning Strategy Comparison Simulation
 *
 * Demonstrates:
 * - Comparison of different learning approaches
 * - Reinforcement learning vs. supervised learning
 * - Online learning vs. batch learning
 * - Exploration vs. exploitation trade-offs
 * - Transfer learning and meta-learning
 *
 * Compares learning strategies:
 * 1. Random exploration (baseline)
 * 2. Epsilon-greedy (classic RL)
 * 3. UCB (Upper Confidence Bound)
 * 4. Thompson Sampling
 * 5. Experience replay with AgentDB
 */

import { ROS3McpServer } from '../../npm/mcp/src/server.js';

interface Task {
  id: string;
  difficulty: number;
  optimalStrategy: string;
  rewards: Map<string, number>; // strategy -> reward
}

interface LearningStrategy {
  name: string;
  description: string;
  totalReward: number;
  actionCounts: Map<string, number>;
  actionRewards: Map<string, number>;
  confidenceScores: Map<string, number>;
  explorationRate: number;
}

interface PerformanceMetrics {
  strategy: string;
  episode: number;
  cumulativeReward: number;
  averageReward: number;
  regret: number; // Difference from optimal
  explorationRate: number;
  confidenceLevel: number;
}

class LearningComparisonSimulation {
  private server: ROS3McpServer;
  private robotId: string;
  private strategies: Map<string, LearningStrategy> = new Map();
  private actions: string[] = ['fast_approach', 'careful_approach', 'adaptive_approach', 'learned_approach'];
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private tasks: Task[] = [];
  private episode: number = 0;

  constructor(robotId: string = 'learner-1') {
    this.robotId = robotId;
    this.server = new ROS3McpServer({
      name: `learning-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/learning-${robotId}.db`,
    });

    this.initializeStrategies();
    this.generateTasks(50);
  }

  private initializeStrategies(): void {
    // Strategy 1: Random baseline
    this.strategies.set('random', {
      name: 'random',
      description: 'Random action selection (baseline)',
      totalReward: 0,
      actionCounts: new Map(this.actions.map(a => [a, 0])),
      actionRewards: new Map(this.actions.map(a => [a, 0])),
      confidenceScores: new Map(this.actions.map(a => [a, 0])),
      explorationRate: 1.0,
    });

    // Strategy 2: Epsilon-greedy
    this.strategies.set('epsilon_greedy', {
      name: 'epsilon_greedy',
      description: 'Epsilon-greedy with decaying exploration',
      totalReward: 0,
      actionCounts: new Map(this.actions.map(a => [a, 0])),
      actionRewards: new Map(this.actions.map(a => [a, 0])),
      confidenceScores: new Map(this.actions.map(a => [a, 0])),
      explorationRate: 0.3,
    });

    // Strategy 3: UCB (Upper Confidence Bound)
    this.strategies.set('ucb', {
      name: 'ucb',
      description: 'Upper Confidence Bound',
      totalReward: 0,
      actionCounts: new Map(this.actions.map(a => [a, 0])),
      actionRewards: new Map(this.actions.map(a => [a, 0])),
      confidenceScores: new Map(this.actions.map(a => [a, 0])),
      explorationRate: 0.0, // UCB doesn't use epsilon
    });

    // Strategy 4: Thompson Sampling
    this.strategies.set('thompson', {
      name: 'thompson',
      description: 'Thompson Sampling (Bayesian)',
      totalReward: 0,
      actionCounts: new Map(this.actions.map(a => [a, 0])),
      actionRewards: new Map(this.actions.map(a => [a, 1])), // Prior: alpha = 1
      confidenceScores: new Map(this.actions.map(a => [a, 1])), // Prior: beta = 1
      explorationRate: 0.0,
    });

    // Strategy 5: Experience Replay with AgentDB
    this.strategies.set('experience_replay', {
      name: 'experience_replay',
      description: 'Experience Replay with AgentDB memory',
      totalReward: 0,
      actionCounts: new Map(this.actions.map(a => [a, 0])),
      actionRewards: new Map(this.actions.map(a => [a, 0])),
      confidenceScores: new Map(this.actions.map(a => [a, 0])),
      explorationRate: 0.2,
    });

    // Initialize performance history
    for (const strategyName of this.strategies.keys()) {
      this.performanceHistory.set(strategyName, []);
    }
  }

  private generateTasks(count: number): void {
    for (let i = 0; i < count; i++) {
      const difficulty = Math.random();

      // Determine optimal strategy based on difficulty
      let optimalStrategy: string;
      if (difficulty < 0.3) {
        optimalStrategy = 'fast_approach';
      } else if (difficulty < 0.6) {
        optimalStrategy = 'adaptive_approach';
      } else if (difficulty < 0.8) {
        optimalStrategy = 'careful_approach';
      } else {
        optimalStrategy = 'learned_approach';
      }

      // Generate rewards for each action
      const rewards = new Map<string, number>();
      for (const action of this.actions) {
        let reward: number;
        if (action === optimalStrategy) {
          reward = 0.8 + Math.random() * 0.2; // 0.8-1.0 for optimal
        } else if (action === 'learned_approach') {
          reward = 0.6 + Math.random() * 0.2; // 0.6-0.8 for learned (usually good)
        } else {
          reward = Math.random() * 0.6; // 0-0.6 for others
        }

        // Add noise
        reward += (Math.random() - 0.5) * 0.1;
        reward = Math.max(0, Math.min(1, reward));

        rewards.set(action, reward);
      }

      this.tasks.push({
        id: `task-${i + 1}`,
        difficulty,
        optimalStrategy,
        rewards,
      });
    }
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🤖 Learning Comparison Robot ${this.robotId} initialized!`);
    console.log(`📚 Comparing ${this.strategies.size} learning strategies`);
    console.log(`🎯 Tasks generated: ${this.tasks.length}\n`);

    console.log(`Strategies:`);
    for (const [name, strategy] of this.strategies) {
      console.log(`  • ${name}: ${strategy.description}`);
    }
    console.log();

    await this.loadPriorKnowledge();
  }

  private async loadPriorKnowledge(): Promise<void> {
    try {
      const memories = await this.server['memory'].queryWithContext(
        'successful action selection',
        { k: 50, minConfidence: 0.6 }
      );

      if (memories.memories.length > 0) {
        console.log(`🧠 Loaded ${memories.memories.length} prior experiences`);
        console.log(`   Initializing experience replay with historical data\n`);

        // Initialize experience replay strategy with prior knowledge
        const experienceReplayStrategy = this.strategies.get('experience_replay')!;
        for (const memory of memories) {
          if (memory.metadata?.action && memory.metadata?.reward !== undefined) {
            const action = memory.metadata.action;
            const reward = memory.metadata.reward;

            const currentCount = experienceReplayStrategy.actionCounts.get(action) || 0;
            const currentReward = experienceReplayStrategy.actionRewards.get(action) || 0;

            experienceReplayStrategy.actionCounts.set(action, currentCount + 1);
            experienceReplayStrategy.actionRewards.set(action, currentReward + reward);
          }
        }
      }
    } catch (error) {
      console.log(`ℹ️  No prior knowledge (first learning session)\n`);
    }
  }

  // Random strategy: Select action uniformly at random
  private selectActionRandom(strategy: LearningStrategy): string {
    return this.actions[Math.floor(Math.random() * this.actions.length)];
  }

  // Epsilon-greedy: Exploit best action or explore randomly
  private selectActionEpsilonGreedy(strategy: LearningStrategy): string {
    // Decay exploration rate
    const epsilon = Math.max(0.01, strategy.explorationRate * 0.995);
    strategy.explorationRate = epsilon;

    if (Math.random() < epsilon) {
      // Explore
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    } else {
      // Exploit: select best action
      let bestAction = this.actions[0];
      let bestValue = -Infinity;

      for (const action of this.actions) {
        const count = strategy.actionCounts.get(action) || 0;
        const totalReward = strategy.actionRewards.get(action) || 0;
        const avgReward = count > 0 ? totalReward / count : 0;

        if (avgReward > bestValue) {
          bestValue = avgReward;
          bestAction = action;
        }
      }

      return bestAction;
    }
  }

  // UCB: Upper Confidence Bound
  private selectActionUCB(strategy: LearningStrategy, totalSteps: number): string {
    let bestAction = this.actions[0];
    let bestScore = -Infinity;

    for (const action of this.actions) {
      const count = strategy.actionCounts.get(action) || 0;

      if (count === 0) {
        // Always try unexplored actions first
        return action;
      }

      const totalReward = strategy.actionRewards.get(action) || 0;
      const avgReward = totalReward / count;

      // UCB score: average reward + exploration bonus
      const explorationBonus = Math.sqrt((2 * Math.log(totalSteps + 1)) / count);
      const score = avgReward + explorationBonus;

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }

  // Thompson Sampling: Bayesian approach
  private selectActionThompson(strategy: LearningStrategy): string {
    let bestAction = this.actions[0];
    let bestSample = -Infinity;

    for (const action of this.actions) {
      const successes = strategy.actionRewards.get(action) || 1; // alpha
      const failures = strategy.confidenceScores.get(action) || 1; // beta

      // Sample from Beta distribution (simplified)
      const sample = this.sampleBeta(successes, failures);

      if (sample > bestSample) {
        bestSample = sample;
        bestAction = action;
      }
    }

    return bestAction;
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simplified Beta sampling using mean + noise
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
    const noise = (Math.random() - 0.5) * Math.sqrt(variance) * 2;

    return Math.max(0, Math.min(1, mean + noise));
  }

  // Experience Replay with AgentDB
  private async selectActionExperienceReplay(strategy: LearningStrategy, task: Task): Promise<string> {
    try {
      // Query similar past experiences
      const memories = await this.server['memory'].queryWithContext(
        `task difficulty ${task.difficulty.toFixed(2)}`,
        { k: 5, minConfidence: 0.5 }
      );

      // Combine prior knowledge with exploration
      if (memories.memories.length > 0 && Math.random() > strategy.explorationRate) {
        // Use learned knowledge
        const actionScores = new Map<string, number>();

        for (const memory of memories.memories) {
          if (memory.metadata?.action && memory.metadata?.reward !== undefined) {
            const action = memory.metadata.action;
            const reward = memory.metadata.reward * memory.confidence;

            const currentScore = actionScores.get(action) || 0;
            actionScores.set(action, currentScore + reward);
          }
        }

        // Select best action from memory
        let bestAction = this.actions[0];
        let bestScore = -Infinity;

        for (const [action, score] of actionScores) {
          if (score > bestScore) {
            bestScore = score;
            bestAction = action;
          }
        }

        return bestAction;
      }
    } catch (error) {
      // Fallback to exploration
    }

    // Exploration or no memories: use epsilon-greedy
    return this.selectActionEpsilonGreedy(strategy);
  }

  private async executeTask(task: Task, strategyName: string, strategy: LearningStrategy): Promise<number> {
    // Select action based on strategy
    let action: string;

    switch (strategyName) {
      case 'random':
        action = this.selectActionRandom(strategy);
        break;
      case 'epsilon_greedy':
        action = this.selectActionEpsilonGreedy(strategy);
        break;
      case 'ucb':
        action = this.selectActionUCB(strategy, this.episode);
        break;
      case 'thompson':
        action = this.selectActionThompson(strategy);
        break;
      case 'experience_replay':
        action = await this.selectActionExperienceReplay(strategy, task);
        break;
      default:
        action = this.selectActionRandom(strategy);
    }

    // Get reward for selected action
    const reward = task.rewards.get(action) || 0;

    // Update strategy statistics
    const currentCount = strategy.actionCounts.get(action) || 0;
    const currentReward = strategy.actionRewards.get(action) || 0;

    strategy.actionCounts.set(action, currentCount + 1);
    strategy.actionRewards.set(action, currentReward + reward);

    // For Thompson Sampling: update Beta distribution parameters
    if (strategyName === 'thompson') {
      const successes = strategy.actionRewards.get(action) || 1;
      const failures = strategy.confidenceScores.get(action) || 1;

      strategy.actionRewards.set(action, successes + reward);
      strategy.confidenceScores.set(action, failures + (1 - reward));
    }

    strategy.totalReward += reward;

    // Store experience in AgentDB
    if (strategyName === 'experience_replay') {
      await this.server['memory'].storeEpisode({
        sessionId: `${strategyName}-episode-${this.episode}`,
        taskName: 'learning_task',
        confidence: reward,
        success: reward > 0.7,
        outcome: `Selected ${action} for difficulty ${task.difficulty.toFixed(2)}`,
        strategy: strategyName,
        metadata: {
          action,
          reward,
          taskDifficulty: task.difficulty,
          optimalStrategy: task.optimalStrategy,
        },
      });
    }

    return reward;
  }

  async runSimulation(): Promise<void> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧠 Learning Strategy Comparison Simulation`);
    console.log(`${'='.repeat(70)}\n`);

    for (const task of this.tasks) {
      this.episode++;

      if (this.episode % 10 === 0) {
        console.log(`\n📊 Episode ${this.episode}/${this.tasks.length}`);
        this.printProgress();
      }

      // Execute task with all strategies
      for (const [strategyName, strategy] of this.strategies) {
        await this.executeTask(task, strategyName, strategy);

        // Record performance metrics
        const optimalReward = task.rewards.get(task.optimalStrategy) || 0;
        const regret = optimalReward * this.episode - strategy.totalReward;
        const avgReward = strategy.totalReward / this.episode;

        const metrics: PerformanceMetrics = {
          strategy: strategyName,
          episode: this.episode,
          cumulativeReward: strategy.totalReward,
          averageReward: avgReward,
          regret,
          explorationRate: strategy.explorationRate,
          confidenceLevel: this.calculateConfidence(strategy),
        };

        this.performanceHistory.get(strategyName)!.push(metrics);
      }
    }

    this.printFinalResults();
    await this.consolidateKnowledge();
  }

  private calculateConfidence(strategy: LearningStrategy): number {
    // Calculate confidence as proportion of actions on best action
    let maxCount = 0;
    let totalCount = 0;

    for (const count of strategy.actionCounts.values()) {
      totalCount += count;
      if (count > maxCount) {
        maxCount = count;
      }
    }

    return totalCount > 0 ? maxCount / totalCount : 0;
  }

  private printProgress(): void {
    for (const [strategyName, strategy] of this.strategies) {
      const avgReward = strategy.totalReward / this.episode;
      console.log(`   ${strategyName.padEnd(20)}: Avg Reward = ${avgReward.toFixed(4)}, Exploration = ${(strategy.explorationRate * 100).toFixed(1)}%`);
    }
  }

  private printFinalResults(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Final Learning Comparison Results`);
    console.log(`${'='.repeat(70)}\n`);

    // Sort strategies by total reward
    const sortedStrategies = Array.from(this.strategies.entries())
      .sort(([, a], [, b]) => b.totalReward - a.totalReward);

    console.log(`Overall Performance (sorted by total reward):\n`);

    for (let i = 0; i < sortedStrategies.length; i++) {
      const [strategyName, strategy] = sortedStrategies[i];
      const avgReward = strategy.totalReward / this.episode;
      const confidence = this.calculateConfidence(strategy);

      console.log(`${i + 1}. ${strategyName.toUpperCase()}`);
      console.log(`   Total Reward: ${strategy.totalReward.toFixed(2)}`);
      console.log(`   Average Reward: ${avgReward.toFixed(4)}`);
      console.log(`   Final Confidence: ${(confidence * 100).toFixed(1)}%`);
      console.log(`   Final Exploration Rate: ${(strategy.explorationRate * 100).toFixed(1)}%\n`);
    }

    // Learning curves comparison
    console.log(`Learning Curves (Early vs Late Performance):\n`);

    const earlyEpisodes = Math.floor(this.episode * 0.2); // First 20%
    const lateStart = Math.floor(this.episode * 0.8); // Last 20%

    for (const [strategyName, history] of this.performanceHistory) {
      const earlyReward = history.slice(0, earlyEpisodes).reduce((sum, m) => sum + m.averageReward, 0) / earlyEpisodes;
      const lateReward = history.slice(lateStart).reduce((sum, m) => sum + m.averageReward, 0) / (this.episode - lateStart);
      const improvement = ((lateReward - earlyReward) / earlyReward) * 100;

      console.log(`   ${strategyName}:`);
      console.log(`     Early (first 20%): ${earlyReward.toFixed(4)}`);
      console.log(`     Late (last 20%): ${lateReward.toFixed(4)}`);
      console.log(`     Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%\n`);
    }

    console.log(`${'='.repeat(70)}\n`);
  }

  private async consolidateKnowledge(): Promise<void> {
    console.log(`🧠 Consolidating learning patterns...`);

    const result = await this.server.consolidateSkills('learning_strategies');

    console.log(`   Skills Consolidated: ${result.skillsConsolidated}`);
    console.log(`   Patterns Found: ${result.patternsFound}`);
    console.log(`   💾 Learning insights saved to AgentDB\n`);
  }

  exportMetrics(): any {
    return {
      robotId: this.robotId,
      totalEpisodes: this.episode,
      strategies: Array.from(this.strategies.entries()).map(([name, strategy]) => ({
        name,
        totalReward: strategy.totalReward,
        averageReward: strategy.totalReward / this.episode,
        actionCounts: Object.fromEntries(strategy.actionCounts),
      })),
      performanceHistory: Object.fromEntries(this.performanceHistory),
      timestamp: new Date().toISOString(),
    };
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'learner-1';

  const sim = new LearningComparisonSimulation(robotId);

  await sim.start();
  await sim.runSimulation();

  const metrics = sim.exportMetrics();
  console.log(`📈 Exported metrics:`, JSON.stringify(metrics, null, 2));

  console.log(`\n✨ Learning comparison simulation complete!\n`);
  process.exit(0);
}

main().catch(console.error);

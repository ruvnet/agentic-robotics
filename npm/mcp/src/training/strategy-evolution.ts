/**
 * Strategy Evolution and Optimization
 *
 * Features:
 * - Strategy selection and evaluation
 * - Performance tracking across episodes
 * - Adaptive learning rate scheduling
 * - Strategy consolidation with AgentDB
 */

import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface Strategy {
  id: string;
  name: string;
  algorithm: string;
  hyperparameters: Record<string, number>;
  performance: StrategyPerformance;
  metadata?: Record<string, any>;
}

export interface StrategyPerformance {
  episodesRun: number;
  totalReward: number;
  avgReward: number;
  maxReward: number;
  minReward: number;
  successRate: number;
  avgSteps: number;
  convergenceRate: number;
  lastUpdated: number;
}

export interface EvolutionConfig {
  populationSize: number;
  mutationRate: number;
  eliteRatio: number;
  tournamentSize: number;
  dbPath: string;
}

export interface LearningSchedule {
  initialRate: number;
  finalRate: number;
  decayType: 'linear' | 'exponential' | 'cosine' | 'adaptive';
  warmupSteps?: number;
  decaySteps: number;
}

/**
 * Strategy Manager using AgentDB for persistent storage
 */
export class StrategyManager {
  private strategies: Map<string, Strategy> = new Map();
  private currentStrategy: Strategy | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string = '.agentdb/strategies') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize AgentDB for strategy storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await execAsync(
        `npx agentdb init "${this.dbPath}" --dimension 128 --preset high-performance`
      );

      console.error(`✅ Strategy manager initialized: ${this.dbPath}`);
      this.initialized = true;

      // Load existing strategies
      await this.loadStrategies();
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.error('⚠️ Strategy manager initialization warning:', error.message);
      }
      this.initialized = true;
      await this.loadStrategies();
    }
  }

  /**
   * Register new strategy
   */
  async registerStrategy(strategy: Strategy): Promise<void> {
    await this.initialize();

    this.strategies.set(strategy.id, strategy);

    // Store in AgentDB
    await this.storeStrategy(strategy);

    console.error(`📝 Registered strategy: ${strategy.name} (${strategy.algorithm})`);
  }

  /**
   * Update strategy performance
   */
  async updatePerformance(
    strategyId: string,
    episodeReward: number,
    episodeSteps: number,
    success: boolean
  ): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      console.error(`⚠️ Strategy not found: ${strategyId}`);
      return;
    }

    const perf = strategy.performance;
    perf.episodesRun++;
    perf.totalReward += episodeReward;
    perf.avgReward = perf.totalReward / perf.episodesRun;
    perf.maxReward = Math.max(perf.maxReward, episodeReward);
    perf.minReward = Math.min(perf.minReward, episodeReward);
    perf.successRate =
      (perf.successRate * (perf.episodesRun - 1) + (success ? 1 : 0)) / perf.episodesRun;
    perf.avgSteps =
      (perf.avgSteps * (perf.episodesRun - 1) + episodeSteps) / perf.episodesRun;
    perf.lastUpdated = Date.now();

    // Update in storage
    await this.storeStrategy(strategy);

    console.error(
      `📊 Updated ${strategy.name}: reward=${episodeReward.toFixed(2)}, avg=${perf.avgReward.toFixed(2)}, success=${(perf.successRate * 100).toFixed(1)}%`
    );
  }

  /**
   * Select best performing strategy
   */
  async selectBestStrategy(metric: 'reward' | 'success' | 'efficiency' = 'reward'): Promise<Strategy | null> {
    await this.initialize();

    if (this.strategies.size === 0) return null;

    const strategies = Array.from(this.strategies.values());

    let best = strategies[0];

    for (const strategy of strategies) {
      if (strategy.performance.episodesRun < 5) continue; // Need minimum episodes

      let isBetter = false;

      switch (metric) {
        case 'reward':
          isBetter = strategy.performance.avgReward > best.performance.avgReward;
          break;
        case 'success':
          isBetter = strategy.performance.successRate > best.performance.successRate;
          break;
        case 'efficiency':
          const efficiency = strategy.performance.avgReward / strategy.performance.avgSteps;
          const bestEfficiency = best.performance.avgReward / best.performance.avgSteps;
          isBetter = efficiency > bestEfficiency;
          break;
      }

      if (isBetter) {
        best = strategy;
      }
    }

    this.currentStrategy = best;
    console.error(`🏆 Selected strategy: ${best.name} (${metric}=${this.getMetricValue(best, metric).toFixed(3)})`);

    return best;
  }

  /**
   * Get top N strategies
   */
  async getTopStrategies(n: number = 5, metric: 'reward' | 'success' | 'efficiency' = 'reward'): Promise<Strategy[]> {
    await this.initialize();

    const strategies = Array.from(this.strategies.values())
      .filter(s => s.performance.episodesRun >= 5);

    strategies.sort((a, b) => {
      const aValue = this.getMetricValue(a, metric);
      const bValue = this.getMetricValue(b, metric);
      return bValue - aValue;
    });

    return strategies.slice(0, n);
  }

  /**
   * Consolidate strategies using skill library
   */
  async consolidateStrategies(minEpisodes: number = 10): Promise<number> {
    await this.initialize();

    try {
      const { stdout } = await execAsync(
        `AGENTDB_PATH="${this.dbPath}" npx agentdb skill consolidate ${minEpisodes} 0.5 7`
      );

      const match = stdout.match(/(\d+)\s+skills?\s+consolidated/i);
      const consolidated = match ? parseInt(match[1]) : 0;

      console.error(`🎯 Consolidated ${consolidated} strategies`);
      return consolidated;
    } catch (error: any) {
      console.error('❌ Error consolidating strategies:', error.message);
      return 0;
    }
  }

  /**
   * Search for similar strategies
   */
  async searchSimilarStrategies(
    description: string,
    k: number = 5
  ): Promise<Strategy[]> {
    await this.initialize();

    try {
      const { stdout } = await execAsync(
        `AGENTDB_PATH="${this.dbPath}" npx agentdb skill search "${description}" --k ${k} --format json`
      );

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const results = JSON.parse(jsonLine);
        const strategies: Strategy[] = [];

        for (const result of Array.isArray(results) ? results : [results]) {
          try {
            const strategy: Strategy = {
              id: result.name || `strategy-${Date.now()}`,
              name: result.name || 'Unknown',
              algorithm: result.best_strategy || 'unknown',
              hyperparameters: {},
              performance: {
                episodesRun: result.num_attempts || 0,
                totalReward: result.avg_reward * (result.num_attempts || 0),
                avgReward: result.avg_reward || 0,
                maxReward: result.avg_reward || 0,
                minReward: result.avg_reward || 0,
                successRate: result.success_rate || 0,
                avgSteps: 100,
                convergenceRate: 0,
                lastUpdated: result.last_used || Date.now(),
              },
            };
            strategies.push(strategy);
          } catch (e) {
            // Skip malformed entries
          }
        }

        return strategies;
      }

      return [];
    } catch (error: any) {
      console.error('❌ Error searching strategies:', error.message);
      return [];
    }
  }

  /**
   * Get strategy statistics
   */
  async getStats(): Promise<{
    totalStrategies: number;
    activeStrategies: number;
    bestPerformance: number;
    avgPerformance: number;
  }> {
    const strategies = Array.from(this.strategies.values());
    const active = strategies.filter(s => s.performance.episodesRun > 0);

    const rewards = active.map(s => s.performance.avgReward);
    const bestPerformance = rewards.length > 0 ? Math.max(...rewards) : 0;
    const avgPerformance =
      rewards.length > 0 ? rewards.reduce((a, b) => a + b, 0) / rewards.length : 0;

    return {
      totalStrategies: strategies.length,
      activeStrategies: active.length,
      bestPerformance,
      avgPerformance,
    };
  }

  /**
   * Store strategy in AgentDB
   */
  private async storeStrategy(strategy: Strategy): Promise<void> {
    const cmd = [
      'npx agentdb reflexion store',
      `"${strategy.id}"`,
      `"${strategy.name}"`,
      strategy.performance.avgReward.toString(),
      strategy.performance.successRate.toString(),
      `"${JSON.stringify(strategy)}"`,
      `--strategy "${strategy.algorithm}"`,
    ].join(' ');

    try {
      await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);
    } catch (error: any) {
      console.error('⚠️ Error storing strategy:', error.message);
    }
  }

  /**
   * Load strategies from AgentDB
   */
  private async loadStrategies(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `AGENTDB_PATH="${this.dbPath}" npx agentdb reflexion retrieve "strategies" --k 100 --format json`
      );

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const results = JSON.parse(jsonLine);

        for (const result of Array.isArray(results) ? results : [results]) {
          try {
            const strategy: Strategy = JSON.parse(result.outcome || '{}');
            if (strategy.id && strategy.name) {
              this.strategies.set(strategy.id, strategy);
            }
          } catch (e) {
            // Skip malformed entries
          }
        }

        console.error(`📚 Loaded ${this.strategies.size} strategies from storage`);
      }
    } catch (error: any) {
      // No strategies stored yet
    }
  }

  private getMetricValue(strategy: Strategy, metric: string): number {
    switch (metric) {
      case 'reward':
        return strategy.performance.avgReward;
      case 'success':
        return strategy.performance.successRate;
      case 'efficiency':
        return strategy.performance.avgReward / Math.max(strategy.performance.avgSteps, 1);
      default:
        return strategy.performance.avgReward;
    }
  }
}

/**
 * Learning Rate Scheduler
 */
export class LearningRateScheduler {
  private schedule: LearningSchedule;
  private currentStep: number = 0;
  private currentRate: number;

  constructor(schedule: LearningSchedule) {
    this.schedule = schedule;
    this.currentRate = schedule.initialRate;
  }

  /**
   * Get learning rate for current step
   */
  getRate(step?: number): number {
    if (step !== undefined) {
      this.currentStep = step;
    }

    const effectiveStep = Math.max(0, this.currentStep - (this.schedule.warmupSteps || 0));
    const progress = Math.min(1, effectiveStep / this.schedule.decaySteps);

    switch (this.schedule.decayType) {
      case 'linear':
        this.currentRate =
          this.schedule.initialRate -
          progress * (this.schedule.initialRate - this.schedule.finalRate);
        break;

      case 'exponential':
        this.currentRate =
          this.schedule.initialRate *
          Math.pow(this.schedule.finalRate / this.schedule.initialRate, progress);
        break;

      case 'cosine':
        this.currentRate =
          this.schedule.finalRate +
          0.5 *
            (this.schedule.initialRate - this.schedule.finalRate) *
            (1 + Math.cos(Math.PI * progress));
        break;

      case 'adaptive':
        // Adaptive scheduling would adjust based on performance
        // For now, use cosine
        this.currentRate =
          this.schedule.finalRate +
          0.5 *
            (this.schedule.initialRate - this.schedule.finalRate) *
            (1 + Math.cos(Math.PI * progress));
        break;
    }

    // Apply warmup
    if (this.schedule.warmupSteps && this.currentStep < this.schedule.warmupSteps) {
      const warmupProgress = this.currentStep / this.schedule.warmupSteps;
      this.currentRate *= warmupProgress;
    }

    return this.currentRate;
  }

  /**
   * Step scheduler forward
   */
  step(): number {
    this.currentStep++;
    return this.getRate();
  }

  /**
   * Reset scheduler
   */
  reset(): void {
    this.currentStep = 0;
    this.currentRate = this.schedule.initialRate;
  }

  /**
   * Get current step
   */
  getCurrentStep(): number {
    return this.currentStep;
  }
}

/**
 * Adaptive Hyperparameter Optimizer
 */
export class HyperparameterOptimizer {
  private searchSpace: Map<string, { min: number; max: number; scale: 'linear' | 'log' }>;
  private bestParams: Map<string, number>;
  private bestScore: number = -Infinity;
  private trials: Array<{ params: Map<string, number>; score: number }> = [];

  constructor() {
    this.searchSpace = new Map();
    this.bestParams = new Map();
  }

  /**
   * Define search space for hyperparameter
   */
  defineParameter(
    name: string,
    min: number,
    max: number,
    scale: 'linear' | 'log' = 'linear'
  ): void {
    this.searchSpace.set(name, { min, max, scale });
  }

  /**
   * Suggest next hyperparameter configuration
   */
  suggest(): Record<string, number> {
    const params: Record<string, number> = {};

    for (const [name, space] of this.searchSpace.entries()) {
      if (this.trials.length < 10) {
        // Random search for first trials
        params[name] = this.sampleFromSpace(space);
      } else {
        // Use best params with small perturbation
        const best = this.bestParams.get(name) || this.sampleFromSpace(space);
        const perturbation = (Math.random() - 0.5) * (space.max - space.min) * 0.1;
        params[name] = Math.max(space.min, Math.min(space.max, best + perturbation));
      }
    }

    return params;
  }

  /**
   * Report result for configuration
   */
  report(params: Record<string, number>, score: number): void {
    const paramMap = new Map(Object.entries(params));
    this.trials.push({ params: paramMap, score });

    if (score > this.bestScore) {
      this.bestScore = score;
      this.bestParams = paramMap;
      console.error(`🎯 New best hyperparameters: score=${score.toFixed(3)}`);
      console.error(params);
    }
  }

  /**
   * Get best parameters found
   */
  getBest(): { params: Record<string, number>; score: number } {
    const params: Record<string, number> = {};
    for (const [name, value] of this.bestParams.entries()) {
      params[name] = value;
    }
    return { params, score: this.bestScore };
  }

  private sampleFromSpace(space: { min: number; max: number; scale: 'linear' | 'log' }): number {
    const rand = Math.random();

    if (space.scale === 'log') {
      const logMin = Math.log(space.min);
      const logMax = Math.log(space.max);
      return Math.exp(logMin + rand * (logMax - logMin));
    } else {
      return space.min + rand * (space.max - space.min);
    }
  }
}

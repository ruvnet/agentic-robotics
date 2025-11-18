/**
 * Experience Replay Buffer with AgentDB Integration
 *
 * Features:
 * - Store experiences efficiently in AgentDB
 * - Sample batches for training
 * - Prioritized experience replay
 * - Vector similarity search for relevant experiences
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { Experience, State, Action } from './reinforcement-learning';

const execAsync = promisify(exec);

export interface ExperienceMetadata {
  episodeId: string;
  stepNumber: number;
  algorithm: string;
  importance?: number;
  tdError?: number;
  visited: number;
}

export interface ReplayBufferConfig {
  maxSize: number;
  prioritized: boolean;
  alpha: number; // Priority exponent
  beta: number; // Importance sampling exponent
  epsilon: number; // Small constant for numerical stability
  dbPath: string;
}

export interface SampledBatch {
  experiences: Experience[];
  weights: number[]; // Importance sampling weights
  indices: number[];
}

/**
 * Experience Replay Buffer using AgentDB for persistent storage
 */
export class ExperienceReplayBuffer {
  private config: ReplayBufferConfig;
  private initialized: boolean = false;
  private totalExperiences: number = 0;
  private maxPriority: number = 1.0;

  constructor(config: Partial<ReplayBufferConfig> = {}) {
    this.config = {
      maxSize: 100000,
      prioritized: true,
      alpha: 0.6, // How much prioritization is used
      beta: 0.4, // Importance sampling correction
      epsilon: 1e-6,
      dbPath: '.agentdb/experience-replay',
      ...config,
    };
  }

  /**
   * Initialize AgentDB for experience storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize AgentDB with high-performance preset
      await execAsync(
        `npx agentdb init "${this.config.dbPath}" --dimension 256 --preset high-performance --enable-cache`
      );

      console.error(`✅ Experience replay buffer initialized: ${this.config.dbPath}`);
      this.initialized = true;
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.error('⚠️ Buffer initialization warning:', error.message);
      }
      this.initialized = true;
    }
  }

  /**
   * Store experience with priority
   */
  async store(
    experience: Experience,
    metadata: ExperienceMetadata
  ): Promise<void> {
    await this.initialize();

    // Calculate priority
    const priority = this.calculatePriority(experience, metadata);

    // Create embedding from state-action pair
    const embedding = this.createEmbedding(experience.state, experience.action);

    // Store in AgentDB using reflexion store
    const cmd = [
      'npx agentdb reflexion store',
      `"${metadata.episodeId}"`,
      `"step-${metadata.stepNumber}"`,
      priority.toString(),
      experience.reward.toString(),
      `"${JSON.stringify({
        state: experience.state,
        action: experience.action,
        nextState: experience.nextState,
        done: experience.done,
        importance: experience.importance,
        metadata,
      })}"`,
      `--strategy "${metadata.algorithm}"`,
      metadata.tdError ? `--reasoning "TD Error: ${metadata.tdError}"` : '',
    ].join(' ');

    try {
      await execAsync(`AGENTDB_PATH="${this.config.dbPath}" ${cmd}`);
      this.totalExperiences++;

      // Update max priority for new experiences
      this.maxPriority = Math.max(this.maxPriority, priority);

      console.error(
        `💾 Stored experience: ${metadata.episodeId}-${metadata.stepNumber} (priority: ${priority.toFixed(3)})`
      );
    } catch (error: any) {
      console.error('❌ Error storing experience:', error.message);
      throw error;
    }

    // Prune if buffer is full
    if (this.totalExperiences > this.config.maxSize) {
      await this.pruneOldest();
    }
  }

  /**
   * Sample batch of experiences (uniform or prioritized)
   */
  async sample(batchSize: number): Promise<SampledBatch> {
    await this.initialize();

    if (this.config.prioritized) {
      return this.samplePrioritized(batchSize);
    } else {
      return this.sampleUniform(batchSize);
    }
  }

  /**
   * Sample experiences similar to given state
   */
  async sampleSimilar(
    state: State,
    k: number = 10
  ): Promise<Experience[]> {
    await this.initialize();

    // Create query embedding from state
    const queryEmbedding = this.createStateEmbedding(state);
    const query = `State similar to position ${state.position.join(',')}`;

    try {
      const { stdout } = await execAsync(
        `AGENTDB_PATH="${this.config.dbPath}" npx agentdb reflexion retrieve "${query}" --k ${k} --synthesize-context --format json`
      );

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const results = JSON.parse(jsonLine);
        const experiences: Experience[] = [];

        for (const result of Array.isArray(results) ? results : [results]) {
          try {
            const data = JSON.parse(result.outcome || result.data || '{}');
            if (data.state && data.action) {
              experiences.push({
                state: data.state,
                action: data.action,
                reward: parseFloat(result.confidence) || 0,
                nextState: data.nextState,
                done: data.done || false,
                importance: data.importance,
              });
            }
          } catch (e) {
            // Skip malformed entries
          }
        }

        console.error(`🔍 Found ${experiences.length} similar experiences`);
        return experiences;
      }

      return [];
    } catch (error: any) {
      console.error('❌ Error sampling similar experiences:', error.message);
      return [];
    }
  }

  /**
   * Update priority of experiences based on TD error
   */
  async updatePriorities(
    indices: number[],
    tdErrors: number[]
  ): Promise<void> {
    if (!this.config.prioritized) return;

    // In a full implementation, would update priorities in AgentDB
    // For now, new experiences will have updated priorities
    for (let i = 0; i < indices.length; i++) {
      const priority = Math.pow(Math.abs(tdErrors[i]) + this.config.epsilon, this.config.alpha);
      this.maxPriority = Math.max(this.maxPriority, priority);
    }
  }

  /**
   * Get buffer statistics
   */
  async getStats(): Promise<{
    size: number;
    maxSize: number;
    prioritized: boolean;
    maxPriority: number;
  }> {
    try {
      const { stdout } = await execAsync(
        `AGENTDB_PATH="${this.config.dbPath}" npx agentdb db stats --format json`
      );

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('{'));
      const stats = jsonLine ? JSON.parse(jsonLine) : {};

      return {
        size: stats.total_episodes || this.totalExperiences,
        maxSize: this.config.maxSize,
        prioritized: this.config.prioritized,
        maxPriority: this.maxPriority,
      };
    } catch (error: any) {
      return {
        size: this.totalExperiences,
        maxSize: this.config.maxSize,
        prioritized: this.config.prioritized,
        maxPriority: this.maxPriority,
      };
    }
  }

  /**
   * Clear all experiences
   */
  async clear(): Promise<void> {
    try {
      await execAsync(`rm -rf "${this.config.dbPath}"`);
      this.totalExperiences = 0;
      this.maxPriority = 1.0;
      this.initialized = false;
      console.error('🗑️  Experience buffer cleared');
    } catch (error: any) {
      console.error('❌ Error clearing buffer:', error.message);
    }
  }

  /**
   * Calculate priority for experience
   */
  private calculatePriority(
    experience: Experience,
    metadata: ExperienceMetadata
  ): number {
    if (!this.config.prioritized) return 1.0;

    // Use TD error if available, otherwise use max priority
    const tdError = metadata.tdError ?? this.maxPriority;
    const priority = Math.pow(Math.abs(tdError) + this.config.epsilon, this.config.alpha);

    return priority;
  }

  /**
   * Create embedding from state and action
   */
  private createEmbedding(state: State, action: Action): number[] {
    // Simple embedding: concatenate state and action vectors
    const embedding: number[] = [
      ...state.position,
      ...state.velocity,
      ...state.orientation,
      ...state.sensorReadings.slice(0, 8), // Limit sensor readings
      action.type === 'move' ? 0 : action.type === 'rotate' ? 1 : action.type === 'grasp' ? 2 : 3,
      ...action.parameters.slice(0, 3),
    ];

    // Pad to 256 dimensions
    while (embedding.length < 256) {
      embedding.push(0);
    }

    return embedding.slice(0, 256);
  }

  /**
   * Create embedding from state only
   */
  private createStateEmbedding(state: State): number[] {
    const embedding: number[] = [
      ...state.position,
      ...state.velocity,
      ...state.orientation,
      ...state.sensorReadings.slice(0, 8),
    ];

    while (embedding.length < 256) {
      embedding.push(0);
    }

    return embedding.slice(0, 256);
  }

  /**
   * Sample uniform batch
   */
  private async sampleUniform(batchSize: number): Promise<SampledBatch> {
    const query = `random experiences`;
    const k = Math.min(batchSize, this.totalExperiences);

    try {
      const { stdout } = await execAsync(
        `AGENTDB_PATH="${this.config.dbPath}" npx agentdb reflexion retrieve "${query}" --k ${k} --format json`
      );

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const results = JSON.parse(jsonLine);
        const experiences: Experience[] = [];

        for (const result of Array.isArray(results) ? results : [results]) {
          try {
            const data = JSON.parse(result.outcome || '{}');
            if (data.state && data.action) {
              experiences.push({
                state: data.state,
                action: data.action,
                reward: parseFloat(result.confidence) || 0,
                nextState: data.nextState,
                done: data.done || false,
              });
            }
          } catch (e) {
            // Skip malformed entries
          }
        }

        return {
          experiences,
          weights: Array(experiences.length).fill(1.0),
          indices: Array.from({ length: experiences.length }, (_, i) => i),
        };
      }

      return { experiences: [], weights: [], indices: [] };
    } catch (error: any) {
      console.error('❌ Error sampling batch:', error.message);
      return { experiences: [], weights: [], indices: [] };
    }
  }

  /**
   * Sample prioritized batch
   */
  private async samplePrioritized(batchSize: number): Promise<SampledBatch> {
    // Use min-reward to prioritize high-priority experiences
    const query = `high priority experiences`;
    const k = Math.min(batchSize, this.totalExperiences);

    try {
      const { stdout } = await execAsync(
        `AGENTDB_PATH="${this.config.dbPath}" npx agentdb reflexion retrieve "${query}" --k ${k} --min-reward 0.1 --format json`
      );

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const results = JSON.parse(jsonLine);
        const experiences: Experience[] = [];
        const priorities: number[] = [];

        for (const result of Array.isArray(results) ? results : [results]) {
          try {
            const data = JSON.parse(result.outcome || '{}');
            if (data.state && data.action) {
              experiences.push({
                state: data.state,
                action: data.action,
                reward: parseFloat(result.confidence) || 0,
                nextState: data.nextState,
                done: data.done || false,
              });
              priorities.push(parseFloat(result.confidence) || 1.0);
            }
          } catch (e) {
            // Skip malformed entries
          }
        }

        // Calculate importance sampling weights
        const weights = this.calculateImportanceSamplingWeights(priorities);

        return {
          experiences,
          weights,
          indices: Array.from({ length: experiences.length }, (_, i) => i),
        };
      }

      return { experiences: [], weights: [], indices: [] };
    } catch (error: any) {
      console.error('❌ Error sampling prioritized batch:', error.message);
      return { experiences: [], weights: [], indices: [] };
    }
  }

  /**
   * Calculate importance sampling weights to correct for prioritized sampling bias
   */
  private calculateImportanceSamplingWeights(priorities: number[]): number[] {
    if (priorities.length === 0) return [];

    const totalPriority = priorities.reduce((a, b) => a + b, 0);
    const probabilities = priorities.map(p => p / totalPriority);

    // Calculate weights: (N * P(i))^(-beta)
    const N = this.totalExperiences;
    const weights = probabilities.map(p =>
      Math.pow(N * p, -this.config.beta)
    );

    // Normalize weights
    const maxWeight = Math.max(...weights);
    return weights.map(w => w / maxWeight);
  }

  /**
   * Prune oldest experiences when buffer is full
   */
  private async pruneOldest(): Promise<void> {
    // In production, would implement LRU or priority-based pruning
    // For now, just track count
    this.totalExperiences = Math.min(this.totalExperiences, this.config.maxSize);
  }
}

/**
 * Hindsight Experience Replay (HER)
 * Generates additional training data by relabeling goals
 */
export class HindsightExperienceReplay extends ExperienceReplayBuffer {
  private strategy: 'final' | 'future' | 'episode' | 'random';

  constructor(config: Partial<ReplayBufferConfig & { strategy: string }> = {}) {
    super(config);
    this.strategy = (config.strategy as any) || 'future';
  }

  /**
   * Store experience with hindsight goal relabeling
   */
  async storeWithHindsight(
    trajectory: Experience[],
    metadata: ExperienceMetadata
  ): Promise<void> {
    // Store original trajectory
    for (let i = 0; i < trajectory.length; i++) {
      await this.store(trajectory[i], {
        ...metadata,
        stepNumber: i,
      });
    }

    // Generate hindsight experiences
    const hindsightExperiences = this.generateHindsightGoals(trajectory);

    // Store hindsight experiences
    for (let i = 0; i < hindsightExperiences.length; i++) {
      await this.store(hindsightExperiences[i], {
        ...metadata,
        episodeId: `${metadata.episodeId}-hindsight`,
        stepNumber: i,
      });
    }

    console.error(
      `💡 Generated ${hindsightExperiences.length} hindsight experiences`
    );
  }

  /**
   * Generate hindsight goals based on strategy
   */
  private generateHindsightGoals(trajectory: Experience[]): Experience[] {
    const hindsightExperiences: Experience[] = [];

    switch (this.strategy) {
      case 'final':
        // Use final state as goal
        const finalState = trajectory[trajectory.length - 1].nextState;
        hindsightExperiences.push(
          ...this.relabelGoals(trajectory, finalState)
        );
        break;

      case 'future':
        // Use random future states as goals
        for (let i = 0; i < trajectory.length; i++) {
          const futureIdx = Math.floor(Math.random() * (trajectory.length - i)) + i;
          const goalState = trajectory[futureIdx].nextState;
          hindsightExperiences.push(
            ...this.relabelGoals([trajectory[i]], goalState)
          );
        }
        break;

      case 'episode':
        // Use all future states as goals
        for (let i = 0; i < trajectory.length; i++) {
          for (let j = i + 1; j < trajectory.length; j++) {
            const goalState = trajectory[j].nextState;
            hindsightExperiences.push(
              ...this.relabelGoals([trajectory[i]], goalState)
            );
          }
        }
        break;

      case 'random':
        // Use random states from trajectory as goals
        for (let i = 0; i < trajectory.length; i++) {
          const randomIdx = Math.floor(Math.random() * trajectory.length);
          const goalState = trajectory[randomIdx].nextState;
          hindsightExperiences.push(
            ...this.relabelGoals([trajectory[i]], goalState)
          );
        }
        break;
    }

    return hindsightExperiences;
  }

  /**
   * Relabel trajectory with new goal
   */
  private relabelGoals(
    trajectory: Experience[],
    goalState: State
  ): Experience[] {
    return trajectory.map(exp => {
      // Check if achieved goal
      const achieved = this.isGoalAchieved(exp.nextState, goalState);
      const reward = achieved ? 1 : -1;

      return {
        ...exp,
        reward,
        done: achieved,
      };
    });
  }

  /**
   * Check if goal state is achieved
   */
  private isGoalAchieved(state: State, goal: State, threshold: number = 0.5): boolean {
    const distance = Math.sqrt(
      state.position.reduce(
        (sum, p, i) => sum + Math.pow(p - goal.position[i], 2),
        0
      )
    );
    return distance < threshold;
  }
}

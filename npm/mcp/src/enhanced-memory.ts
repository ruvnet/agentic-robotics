/**
 * Enhanced AgentDB Memory Integration
 *
 * Reflexion memory with self-critique, a skill library with semantic search,
 * context synthesis and performance metrics.
 *
 * The optional `agentdb` package is imported lazily and driven in-process
 * (see agentdb-engine.ts). Only when it cannot be imported does this class
 * fall back to spawning the agentdb CLI (see enhanced-memory-cli.ts).
 */

import { statSync } from 'fs';
import { InProcessAgentDB, type StoredEpisode } from './agentdb-engine.js';
import {
  cliConsolidate,
  cliCounts,
  cliInit,
  cliOptimize,
  cliQuery,
  cliRetrieve,
  cliSearchSkills,
  cliStoreEpisode,
} from './enhanced-memory-cli.js';

export interface Episode {
  sessionId: string;
  taskName: string;
  confidence: number;
  success: boolean;
  outcome: string;
  strategy?: string;
  metadata?: Record<string, any>;
  reasoning?: string;  // Causal reasoning
  critique?: string;   // Self-critique
}

export interface Memory {
  task: string;
  confidence: number;
  success: boolean;
  outcome: string;
  strategy?: string;
  timestamp: number;
  reasoning?: string;
  critique?: string;
  similarity?: number;
}

export interface Skill {
  name: string;
  description: string;
  successRate: number;
  avgReward: number;
  numAttempts: number;
  lastUsed: number;
  bestStrategy?: string;
}

export interface MemoryStats {
  totalEpisodes: number;
  totalSkills: number;
  avgRetrievalTime: number;
  cacheHitRate: number;
  dbSize: number;
}

type SortBy = 'success_rate' | 'avg_reward' | 'num_attempts' | 'last_used';

const SORT_KEYS: Record<SortBy, keyof Skill> = {
  success_rate: 'successRate',
  avg_reward: 'avgReward',
  num_attempts: 'numAttempts',
  last_used: 'lastUsed',
};

function toMemory(e: StoredEpisode): Memory {
  return {
    task: e.task,
    confidence: e.reward,
    success: e.success,
    outcome: e.critique,
    strategy: e.metadata.strategy,
    timestamp: e.ts,
    reasoning: e.metadata.reasoning,
    critique: e.metadata.selfCritique,
    similarity: e.similarity,
  };
}

export class EnhancedAgentDBMemory {
  private dbPath: string;
  private initialized: boolean = false;
  /** In-process agentdb; null means the CLI fallback is in use. */
  private engine: InProcessAgentDB | null = null;
  private performanceMetrics = {
    retrievalTimes: [] as number[],
    storeTimes: [] as number[],
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /** True when agentdb runs in this process, false when the CLI fallback is in use. */
  get inProcess(): boolean {
    return this.engine !== null;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();
    this.engine = await InProcessAgentDB.open(this.dbPath);
    if (!this.engine) {
      await cliInit(this.dbPath);
    }
    console.error(`✅ AgentDB initialized (${this.engine ? 'in-process' : 'CLI'}):`, this.dbPath);
    console.error(`⚡ Initialization time: ${Date.now() - startTime}ms`);
    this.initialized = true;
  }

  /**
   * Store episode with full context and self-critique.
   *
   * In-process, `outcome` is stored as agentdb's critique (as AgentDBMemory
   * does, so both classes read one database the same way); strategy,
   * reasoning and the self-critique go into the episode metadata.
   */
  async storeEpisode(episode: Episode): Promise<void> {
    const startTime = Date.now();

    let critique = episode.critique;
    if (episode.success && !critique) {
      critique = this.generateCritique(episode);
    }

    try {
      if (this.engine) {
        const metadata: Record<string, any> = { ...episode.metadata };
        if (episode.reasoning) metadata.reasoning = episode.reasoning;
        if (critique) metadata.selfCritique = critique;
        await this.engine.storeEpisode({ ...episode, metadata });
      } else {
        await cliStoreEpisode(this.dbPath, episode, critique);
      }

      const storeTime = Date.now() - startTime;
      this.performanceMetrics.storeTimes.push(storeTime);
      console.error(`💾 Stored episode: ${episode.taskName} (${storeTime}ms)`);
    } catch (error: any) {
      console.error('❌ Error storing episode:', error.message);
      throw error;
    }
  }

  /**
   * Retrieve memories with semantic search.
   * `synthesizeContext` and `enableReasoning` only affect the CLI fallback.
   */
  async retrieveMemories(
    query: string,
    k: number = 5,
    options: {
      minReward?: number;
      onlySuccesses?: boolean;
      onlyFailures?: boolean;
      synthesizeContext?: boolean;
      enableReasoning?: boolean;
      timeWindow?: number;        // in days
    } = {}
  ): Promise<Memory[]> {
    const startTime = performance.now();

    try {
      const memories = this.engine
        ? (await this.engine.retrieveEpisodes(query, k, {
            minReward: options.minReward,
            onlySuccesses: options.onlySuccesses,
            onlyFailures: options.onlyFailures,
            timeWindowDays: options.timeWindow,
          })).map(toMemory)
        : await cliRetrieve(this.dbPath, query, k, options);

      const retrievalTime = performance.now() - startTime;
      this.performanceMetrics.retrievalTimes.push(retrievalTime);
      // Sub-millisecond retrievals are counted as cache hits.
      if (retrievalTime < 1) {
        this.performanceMetrics.cacheHits++;
      } else {
        this.performanceMetrics.cacheMisses++;
      }

      console.error(`⚡ Retrieved ${memories.length} memories in ${retrievalTime.toFixed(2)}ms`);
      return memories;
    } catch (error: any) {
      console.error('❌ Error retrieving memories:', error.message);
      return [];
    }
  }

  /**
   * Query with context synthesis. In-process, `context` is agentdb's
   * ContextSynthesizer summary and `reasoning` its key insights and
   * recommendations. `domain` has no in-process equivalent.
   */
  async queryWithContext(
    query: string,
    options: {
      k?: number;
      minConfidence?: number;
      domain?: string;
      synthesizeReasoning?: boolean;
    } = {}
  ): Promise<{ memories: Memory[]; context?: string; reasoning?: string }> {
    const startTime = performance.now();
    const { k = 5, minConfidence = 0.0, domain, synthesizeReasoning = true } = options;

    try {
      let result: { memories: Memory[]; context?: string; reasoning?: string };
      if (this.engine) {
        const episodes = await this.engine.retrieveEpisodes(query, k, { minReward: minConfidence });
        result = { memories: episodes.map(toMemory) };
        if (episodes.length > 0) {
          const ctx = await this.engine.synthesize(episodes);
          result.context = ctx.summary;
          if (synthesizeReasoning) {
            result.reasoning = [...ctx.keyInsights, ...ctx.recommendations].join('\n');
          }
        }
      } else {
        result = await cliQuery(this.dbPath, query, { k, minConfidence, domain, synthesizeReasoning });
      }

      const retrievalTime = performance.now() - startTime;
      this.performanceMetrics.retrievalTimes.push(retrievalTime);
      console.error(`🧠 Query with context: ${retrievalTime.toFixed(2)}ms`);
      return result;
    } catch (error: any) {
      console.error('❌ Error querying with context:', error.message);
      return { memories: [] };
    }
  }

  /**
   * Consolidate successful episodes into skills. Returns the number of skills
   * created. `enablePruning` is accepted for compatibility; agentdb has no
   * skill pruning step in consolidation.
   */
  async consolidateSkills(options: {
    minAttempts?: number;
    minReward?: number;
    timeWindowDays?: number;
    enablePruning?: boolean;
  } = {}): Promise<number> {
    const startTime = Date.now();
    const { minAttempts = 3, minReward = 0.7, timeWindowDays = 7 } = options;

    try {
      const created = this.engine
        ? (await this.engine.consolidateSkills({ minAttempts, minReward, timeWindowDays })).created
        : await cliConsolidate(this.dbPath, { minAttempts, minReward, timeWindowDays });

      console.error(`🎯 Consolidated ${created} skills in ${Date.now() - startTime}ms`);
      return created;
    } catch (error: any) {
      console.error('❌ Error consolidating skills:', error.message);
      return 0;
    }
  }

  /** Search the skill library semantically, then order by `sortBy`. */
  async searchSkills(
    query: string,
    options: {
      k?: number;
      minSuccessRate?: number;
      sortBy?: SortBy;
    } = {}
  ): Promise<Skill[]> {
    const startTime = performance.now();
    const { k = 10, minSuccessRate = 0.5, sortBy = 'success_rate' } = options;

    try {
      let skills: Skill[];
      if (this.engine) {
        const key = SORT_KEYS[sortBy] ?? 'successRate';
        skills = (await this.engine.searchSkills(query, k, minSuccessRate))
          .map((s) => ({
            name: s.name,
            description: s.description,
            successRate: s.successRate,
            avgReward: s.avgReward,
            numAttempts: s.uses,
            lastUsed: s.lastUsed,
            bestStrategy: s.metadata.strategy,
          }))
          .sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
      } else {
        skills = await cliSearchSkills(this.dbPath, query, { k, minSuccessRate, sortBy });
      }

      console.error(`🔍 Found ${skills.length} skills in ${(performance.now() - startTime).toFixed(2)}ms`);
      return skills;
    } catch (error: any) {
      console.error('❌ Error searching skills:', error.message);
      return [];
    }
  }

  /**
   * Generate self-critique for an episode
   */
  private generateCritique(episode: Episode): string {
    if (!episode.success) {
      return `Failed to complete ${episode.taskName}: ${episode.outcome}. Need to analyze failure modes.`;
    }

    return [
      `Successfully completed ${episode.taskName} with ${(episode.confidence * 100).toFixed(1)}% confidence. `,
      episode.strategy ? `Strategy "${episode.strategy}" was effective. ` : '',
      episode.metadata?.latency
        ? `Latency: ${episode.metadata.latency}ms. ${episode.metadata.latency < 100 ? 'Excellent response time.' : 'Consider optimization.'} `
        : '',
      'Could explore alternative approaches for comparison.',
    ].join('');
  }

  /**
   * Get comprehensive statistics with performance metrics
   */
  async getStats(): Promise<MemoryStats> {
    const { retrievalTimes, cacheHits, cacheMisses } = this.performanceMetrics;
    const avgRetrievalTime = retrievalTimes.length > 0
      ? retrievalTimes.reduce((a, b) => a + b, 0) / retrievalTimes.length
      : 0;
    const totalCacheRequests = cacheHits + cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0;

    let counts = { episodes: 0, skills: 0 };
    try {
      counts = this.engine ? this.engine.counts() : await cliCounts(this.dbPath);
    } catch (error: any) {
      console.error('❌ Error getting stats:', error.message);
    }

    let dbSize = 0;
    try {
      dbSize = statSync(this.dbPath).size;
    } catch {
      // Not written to disk yet.
    }

    return {
      totalEpisodes: counts.episodes,
      totalSkills: counts.skills,
      avgRetrievalTime: parseFloat(avgRetrievalTime.toFixed(3)),
      cacheHitRate: parseFloat((cacheHitRate * 100).toFixed(2)),
      dbSize,
    };
  }

  /**
   * Optimize database performance: REINDEX and VACUUM in-process; the CLI
   * fallback also runs agentdb's optimize-vectors.
   */
  async optimize(): Promise<void> {
    const startTime = Date.now();

    try {
      if (this.engine) {
        this.engine.optimize();
      } else {
        await cliOptimize(this.dbPath);
      }
      console.error(`⚙️ Database optimized in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      console.error('⚠️ Optimization warning:', error.message);
    }
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.performanceMetrics = {
      retrievalTimes: [],
      storeTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  async close(): Promise<void> {
    if (this.engine) {
      await this.engine.close();
      this.engine = null;
    }
    this.initialized = false;
  }
}

/**
 * In-process AgentDB engine.
 *
 * Loads the optional `agentdb` package lazily and drives its ReflexionMemory and
 * SkillLibrary controllers directly, instead of spawning `npx agentdb` per call.
 * It writes the same `episodes` tables the agentdb CLI uses, so a database is
 * readable from either side.
 */

import type { Episode, Memory } from './memory.js';

type AgentDBModule = typeof import('agentdb');
type AgentDBInstance = InstanceType<AgentDBModule['AgentDB']>;

export interface RetrieveOptions {
  minReward?: number;
  onlySuccesses?: boolean;
  onlyFailures?: boolean;
}

export interface ConsolidateOptions {
  minAttempts: number;
  minReward: number;
  timeWindowDays: number;
}

/** Embedding size used by agentdb's default model (Xenova/all-MiniLM-L6-v2). */
const VECTOR_DIMENSION = 384;

export class InProcessAgentDB {
  private constructor(
    private readonly db: AgentDBInstance,
    private readonly reflexion: any,
    private readonly skills: any
  ) {}

  /**
   * Open `dbPath` with the agentdb library. Returns null when the optional
   * `agentdb` package cannot be imported, so callers can fall back.
   */
  static async open(dbPath: string): Promise<InProcessAgentDB | null> {
    let mod: AgentDBModule;
    try {
      mod = await import('agentdb');
    } catch {
      return null;
    }
    const db = new mod.AgentDB({ dbPath, vectorDimension: VECTOR_DIMENSION });
    await db.initialize();
    return new InProcessAgentDB(db, db.getController('reflexion'), db.getController('skills'));
  }

  async storeEpisode(episode: Episode): Promise<number> {
    return this.reflexion.storeEpisode({
      sessionId: episode.sessionId,
      task: episode.taskName,
      reward: episode.confidence,
      success: episode.success,
      critique: episode.outcome || '',
      metadata: episode.strategy
        ? { ...episode.metadata, strategy: episode.strategy }
        : episode.metadata,
    });
  }

  async retrieve(query: string, k: number, options: RetrieveOptions = {}): Promise<Memory[]> {
    const episodes: any[] = await this.reflexion.retrieveRelevant({
      task: query,
      k,
      minReward: options.minReward,
      onlySuccesses: options.onlySuccesses,
      onlyFailures: options.onlyFailures,
    });
    return episodes.map((e) => ({
      task: e.task,
      confidence: e.reward,
      success: Boolean(e.success),
      outcome: e.critique ?? '',
      strategy: e.metadata?.strategy,
      timestamp: e.ts ?? 0,
    }));
  }

  async consolidateSkills(options: ConsolidateOptions): Promise<{ created: number; updated: number }> {
    const result = await this.skills.consolidateEpisodesIntoSkills({
      ...options,
      extractPatterns: true,
    });
    return { created: result.created, updated: result.updated };
  }

  /** Row counts in the same `name: N records` shape the agentdb CLI prints. */
  stats(): string {
    const tables = ['episodes', 'skills', 'causal_edges'];
    return tables
      .map((table) => {
        try {
          const row = this.db.database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
          return `${table}: ${row.n} records`;
        } catch {
          return `${table}: N/A`;
        }
      })
      .join('\n');
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

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
  timeWindowDays?: number;
}

/** An episode as agentdb stores it, with the similarity of the match. */
export interface StoredEpisode {
  task: string;
  reward: number;
  success: boolean;
  critique: string;
  metadata: Record<string, any>;
  ts: number;
  similarity?: number;
}

/** A skill as agentdb's SkillLibrary returns it, plus when it was last used. */
export interface StoredSkill {
  id?: number;
  name: string;
  description: string;
  successRate: number;
  avgReward: number;
  uses: number;
  lastUsed: number;
  metadata: Record<string, any>;
}

export interface SynthesizedContext {
  summary: string;
  keyInsights: string[];
  recommendations: string[];
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
    const episodes = await this.retrieveEpisodes(query, k, options);
    return episodes.map((e) => ({
      task: e.task,
      confidence: e.reward,
      success: e.success,
      outcome: e.critique,
      strategy: e.metadata.strategy,
      timestamp: e.ts,
    }));
  }

  async retrieveEpisodes(query: string, k: number, options: RetrieveOptions = {}): Promise<StoredEpisode[]> {
    const episodes: any[] = await this.reflexion.retrieveRelevant({
      task: query,
      k,
      minReward: options.minReward,
      onlySuccesses: options.onlySuccesses,
      onlyFailures: options.onlyFailures,
      timeWindowDays: options.timeWindowDays,
    });
    return episodes.map((e) => ({
      task: e.task,
      reward: e.reward,
      success: Boolean(e.success),
      critique: e.critique ?? '',
      metadata: e.metadata ?? {},
      ts: e.ts ?? 0,
      similarity: e.similarity,
    }));
  }

  /** Summarise retrieved episodes with agentdb's ContextSynthesizer. */
  async synthesize(episodes: StoredEpisode[]): Promise<SynthesizedContext> {
    // A subpath export; the package's moduleResolution cannot see its types.
    const spec = 'agentdb/controllers/ContextSynthesizer';
    const { ContextSynthesizer } = await import(spec);
    const ctx = ContextSynthesizer.synthesize(
      episodes.map((e: StoredEpisode) => ({ task: e.task, reward: e.reward, success: e.success, critique: e.critique, similarity: e.similarity }))
    );
    return { summary: ctx.summary, keyInsights: ctx.keyInsights, recommendations: ctx.recommendations };
  }

  async searchSkills(query: string, k: number, minSuccessRate: number): Promise<StoredSkill[]> {
    const skills: any[] = await this.skills.searchSkills({ task: query, k, minSuccessRate });
    const lastUsed = this.db.database.prepare('SELECT last_used_at AS t FROM skills WHERE id = ?');
    return skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      successRate: s.successRate ?? 0,
      avgReward: s.avgReward ?? 0,
      uses: s.uses ?? 0,
      lastUsed: s.id === undefined ? 0 : ((lastUsed.get(s.id) as { t: number | null } | undefined)?.t ?? 0),
      metadata: s.metadata ?? {},
    }));
  }

  async consolidateSkills(options: ConsolidateOptions): Promise<{ created: number; updated: number }> {
    const result = await this.skills.consolidateEpisodesIntoSkills({
      ...options,
      extractPatterns: true,
    });
    return { created: result.created, updated: result.updated };
  }

  /** Number of stored episodes and skills. */
  counts(): { episodes: number; skills: number } {
    const count = (table: string) =>
      (this.db.database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    return { episodes: count('episodes'), skills: count('skills') };
  }

  /** Rebuild indexes and reclaim free pages. */
  optimize(): void {
    this.db.database.exec('REINDEX');
    this.db.database.exec('VACUUM');
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

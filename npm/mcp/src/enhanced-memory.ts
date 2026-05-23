/**
 * Enhanced AgentDB Memory Integration
 *
 * Uses ALL AgentDB features:
 * - Reflexion memory with self-critique
 * - Skill library with semantic search
 * - Causal reasoning
 * - Automated learning
 * - Performance optimization
 */

import { spawn } from 'child_process';

/**
 * SECURITY: Replaces exec/execAsync (shell=true) with a spawn-based helper
 * that passes arguments as an array, preventing command injection through
 * user-supplied strings such as query, taskName, outcome, strategy, etc.
 */
function spawnAsync(
  cmd: string,
  args: string[],
  env?: Record<string, string>
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        const err = new Error(stderr || `Process exited with code ${code}`);
        (err as any).code = code;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
    child.on('error', reject);
  });
}

const AGENTDB_ENV = (dbPath: string): Record<string, string> => ({ AGENTDB_PATH: dbPath });

export interface Episode {
  sessionId: string;
  taskName: string;
  confidence: number;
  success: boolean;
  outcome: string;
  strategy?: string;
  metadata?: Record<string, any>;
  reasoning?: string;  // NEW: Causal reasoning
  critique?: string;   // NEW: Self-critique
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

export class EnhancedAgentDBMemory {
  private dbPath: string;
  private initialized: boolean = false;
  private performanceMetrics: {
    retrievalTimes: number[];
    storeTimes: number[];
    cacheHits: number;
    cacheMisses: number;
  } = {
    retrievalTimes: [],
    storeTimes: [],
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();

    try {
      // Initialize with optimized settings.
      // SECURITY: dbPath passed as argument, not interpolated into shell string.
      const { stdout, stderr } = await spawnAsync(
        'npx',
        ['agentdb', 'init', this.dbPath, '--dimension', '768', '--preset', 'high-performance', '--enable-cache']
      );

      console.error('✅ AgentDB initialized:', this.dbPath);
      console.error(`⚡ Initialization time: ${Date.now() - startTime}ms`);
      this.initialized = true;
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.error('⚠️ AgentDB initialization warning:', error.message);
      }
      this.initialized = true;
    }
  }

  /**
   * Store episode with full context and self-critique
   */
  async storeEpisode(episode: Episode): Promise<void> {
    const startTime = Date.now();

    // Generate self-critique if success
    let critique = episode.critique;
    if (episode.success && !critique) {
      critique = await this.generateCritique(episode);
    }

    // SECURITY: Build an argument array — no shell interpolation of user data.
    const args = [
      'agentdb', 'reflexion', 'store',
      episode.sessionId,
      episode.taskName,
      episode.confidence.toString(),
      episode.success.toString(),
      episode.outcome || '',
    ];
    if (episode.strategy) { args.push('--strategy', episode.strategy); }
    if (episode.reasoning) { args.push('--reasoning', episode.reasoning); }
    if (critique) { args.push('--critique', critique); }

    try {
      await spawnAsync('npx', args, AGENTDB_ENV(this.dbPath));

      const storeTime = Date.now() - startTime;
      this.performanceMetrics.storeTimes.push(storeTime);

      console.error(`💾 Stored episode: ${episode.taskName} (${storeTime}ms)`);
    } catch (error: any) {
      console.error('❌ Error storing episode:', error.message);
      throw error;
    }
  }

  /**
   * Retrieve memories with semantic search and causal reasoning
   */
  async retrieveMemories(
    query: string,
    k: number = 5,
    options: {
      minReward?: number;
      onlySuccesses?: boolean;
      onlyFailures?: boolean;
      synthesizeContext?: boolean;
      enableReasoning?: boolean;  // NEW
      timeWindow?: number;        // NEW: in days
    } = {}
  ): Promise<Memory[]> {
    const startTime = Date.now();

    // SECURITY: Build argument array — query and option values not shell-interpolated.
    const args = ['agentdb', 'reflexion', 'retrieve', query, '--k', String(k)];
    if (options.minReward !== undefined) { args.push('--min-reward', String(options.minReward)); }
    if (options.onlySuccesses) { args.push('--only-successes'); }
    if (options.onlyFailures) { args.push('--only-failures'); }
    if (options.synthesizeContext) { args.push('--synthesize-context'); }
    if (options.enableReasoning) { args.push('--enable-causal-reasoning'); }
    if (options.timeWindow) { args.push('--time-window', String(options.timeWindow)); }

    try {
      const { stdout } = await spawnAsync('npx', args, AGENTDB_ENV(this.dbPath));

      const retrievalTime = Date.now() - startTime;
      this.performanceMetrics.retrievalTimes.push(retrievalTime);

      // Check if sub-millisecond (cache hit)
      if (retrievalTime < 1) {
        this.performanceMetrics.cacheHits++;
      } else {
        this.performanceMetrics.cacheMisses++;
      }

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        const memories = Array.isArray(data) ? data : [data];

        console.error(`⚡ Retrieved ${memories.length} memories in ${retrievalTime}ms`);
        return memories;
      }

      return [];
    } catch (error: any) {
      console.error('❌ Error retrieving memories:', error.message);
      return [];
    }
  }

  /**
   * Query with full context synthesis and reasoning
   */
  async queryWithContext(
    query: string,
    options: {
      k?: number;
      minConfidence?: number;
      domain?: string;
      synthesizeReasoning?: boolean;  // NEW
    } = {}
  ): Promise<{ memories: Memory[]; context?: string; reasoning?: string }> {
    const startTime = Date.now();
    const { k = 5, minConfidence = 0.0, domain, synthesizeReasoning = true } = options;

    // SECURITY: Argument array — query, domain, and numeric options not shell-interpolated.
    const args = [
      'agentdb', 'query',
      '--query', query,
      '--k', String(k),
      '--min-confidence', String(minConfidence),
      '--synthesize-context',
      '--format', 'json',
    ];
    if (domain) { args.push('--domain', domain); }
    if (synthesizeReasoning) { args.push('--enable-causal-reasoning'); }

    try {
      const { stdout } = await spawnAsync('npx', args, AGENTDB_ENV(this.dbPath));

      const retrievalTime = Date.now() - startTime;
      this.performanceMetrics.retrievalTimes.push(retrievalTime);

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        console.error(`🧠 Query with reasoning: ${retrievalTime}ms`);

        return {
          memories: Array.isArray(data) ? data : [data],
          context: data.context || data.summary,
          reasoning: data.reasoning || data.causal_chain,
        };
      }

      return { memories: [] };
    } catch (error: any) {
      console.error('❌ Error querying with context:', error.message);
      return { memories: [] };
    }
  }

  /**
   * Consolidate skills with advanced filtering
   */
  async consolidateSkills(options: {
    minAttempts?: number;
    minReward?: number;
    timeWindowDays?: number;
    enablePruning?: boolean;  // NEW: Remove low-quality skills
  } = {}): Promise<number> {
    const startTime = Date.now();
    const {
      minAttempts = 3,
      minReward = 0.7,
      timeWindowDays = 7,
      enablePruning = true,
    } = options;

    // SECURITY: Numeric values passed as separate args, not interpolated into a shell string.
    const args = [
      'agentdb', 'skill', 'consolidate',
      String(minAttempts),
      String(minReward),
      String(timeWindowDays),
      String(enablePruning),
    ];

    try {
      const { stdout } = await spawnAsync('npx', args, AGENTDB_ENV(this.dbPath));

      const consolidationTime = Date.now() - startTime;

      // Parse number of skills consolidated
      const match = stdout.match(/(\d+)\s+skills?\s+consolidated/i);
      const skillsConsolidated = match ? parseInt(match[1]) : 0;

      console.error(`🎯 Consolidated ${skillsConsolidated} skills in ${consolidationTime}ms`);
      return skillsConsolidated;
    } catch (error: any) {
      console.error('❌ Error consolidating skills:', error.message);
      return 0;
    }
  }

  /**
   * Get skill library with semantic search
   */
  async searchSkills(
    query: string,
    options: {
      k?: number;
      minSuccessRate?: number;
      sortBy?: 'success_rate' | 'avg_reward' | 'num_attempts' | 'last_used';
    } = {}
  ): Promise<Skill[]> {
    const startTime = Date.now();
    const { k = 10, minSuccessRate = 0.5, sortBy = 'success_rate' } = options;

    // SECURITY: query and sortBy passed as separate args.
    const args = [
      'agentdb', 'skill', 'search', query,
      '--k', String(k),
      '--min-success-rate', String(minSuccessRate),
      '--sort-by', sortBy,
      '--format', 'json',
    ];

    try {
      const { stdout } = await spawnAsync('npx', args, AGENTDB_ENV(this.dbPath));

      const searchTime = Date.now() - startTime;

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        const skills = Array.isArray(data) ? data : [data];

        console.error(`🔍 Found ${skills.length} skills in ${searchTime}ms`);
        return skills;
      }

      return [];
    } catch (error: any) {
      console.error('❌ Error searching skills:', error.message);
      return [];
    }
  }

  /**
   * Generate self-critique for an episode
   */
  private async generateCritique(episode: Episode): Promise<string> {
    if (!episode.success) {
      return `Failed to complete ${episode.taskName}: ${episode.outcome}. Need to analyze failure modes.`;
    }

    const critiques = [
      `Successfully completed ${episode.taskName} with ${(episode.confidence * 100).toFixed(1)}% confidence. `,
      episode.strategy ? `Strategy "${episode.strategy}" was effective. ` : '',
      episode.metadata?.latency
        ? `Latency: ${episode.metadata.latency}ms. ${episode.metadata.latency < 100 ? 'Excellent response time.' : 'Consider optimization.'} `
        : '',
      'Could explore alternative approaches for comparison.',
    ].join('');

    return critiques;
  }

  /**
   * Get comprehensive statistics with performance metrics
   */
  async getStats(): Promise<MemoryStats> {
    try {
      const { stdout } = await spawnAsync('npx', ['agentdb', 'db', 'stats', '--format', 'json'], AGENTDB_ENV(this.dbPath));

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('{'));

      const dbStats = jsonLine ? JSON.parse(jsonLine) : {};

      // Calculate performance metrics
      const avgRetrievalTime = this.performanceMetrics.retrievalTimes.length > 0
        ? this.performanceMetrics.retrievalTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.retrievalTimes.length
        : 0;

      const totalCacheRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
      const cacheHitRate = totalCacheRequests > 0
        ? this.performanceMetrics.cacheHits / totalCacheRequests
        : 0;

      return {
        totalEpisodes: dbStats.total_episodes || 0,
        totalSkills: dbStats.total_skills || 0,
        avgRetrievalTime: parseFloat(avgRetrievalTime.toFixed(3)),
        cacheHitRate: parseFloat((cacheHitRate * 100).toFixed(2)),
        dbSize: dbStats.db_size_bytes || 0,
      };
    } catch (error: any) {
      console.error('❌ Error getting stats:', error.message);
      return {
        totalEpisodes: 0,
        totalSkills: 0,
        avgRetrievalTime: 0,
        cacheHitRate: 0,
        dbSize: 0,
      };
    }
  }

  /**
   * Optimize database performance
   */
  async optimize(): Promise<void> {
    const startTime = Date.now();

    try {
      // SECURITY: All three maintenance commands use spawnAsync with argument arrays.
      await spawnAsync('npx', ['agentdb', 'db', 'vacuum'], AGENTDB_ENV(this.dbPath));
      await spawnAsync('npx', ['agentdb', 'db', 'reindex'], AGENTDB_ENV(this.dbPath));
      await spawnAsync('npx', ['agentdb', 'db', 'optimize-vectors'], AGENTDB_ENV(this.dbPath));

      const optimizeTime = Date.now() - startTime;
      console.error(`⚙️ Database optimized in ${optimizeTime}ms`);
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
    this.initialized = false;
  }
}

/**
 * AgentDB Reflexion Memory Integration
 *
 * Enables robot learning from past experiences with secure command execution
 * SECURITY: Uses spawn() with argument arrays to prevent command injection
 */

import { spawn } from 'child_process';

export interface Episode {
  sessionId: string;
  taskName: string;
  confidence: number;
  success: boolean;
  outcome: string;
  strategy?: string;
  metadata?: Record<string, any>;
}

export interface Memory {
  task: string;
  confidence: number;
  success: boolean;
  outcome: string;
  strategy?: string;
  timestamp: number;
}

/**
 * Helper to safely spawn a command and capture output
 * Prevents command injection by using spawn with argument array
 */
function spawnAsync(
  command: string,
  args: string[],
  env?: Record<string, string>
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      shell: false, // Critical: disable shell interpretation
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

export class AgentDBMemory {
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    // Validate dbPath to prevent path traversal
    if (!dbPath || dbPath.includes('..') || dbPath.includes(';') || dbPath.includes('|')) {
      throw new Error('Invalid database path');
    }
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize AgentDB database - use spawn with argument array for security
      const { stdout, stderr, code } = await spawnAsync('npx', [
        'agentdb',
        'init',
        this.dbPath,
        '--dimension',
        '768',
        '--preset',
        'medium',
      ]);

      if (code === 0 || stderr.includes('already exists')) {
        console.error('AgentDB initialized:', this.dbPath);
        this.initialized = true;
      } else {
        throw new Error(`Initialization failed: ${stderr}`);
      }
    } catch (error: any) {
      // Database might already exist
      if (error.message?.includes('already exists')) {
        this.initialized = true;
      } else {
        throw new Error(`Failed to initialize AgentDB: ${error.message}`);
      }
    }
  }

  async storeEpisode(episode: Episode): Promise<void> {
    if (!this.initialized) {
      throw new Error('AgentDB not initialized. Call initialize() first.');
    }

    try {
      // Use spawn with argument array to prevent command injection
      const { code, stderr } = await spawnAsync(
        'npx',
        [
          'agentdb',
          'reflexion',
          'store',
          episode.sessionId,
          episode.taskName,
          episode.confidence.toString(),
          episode.success.toString(),
          episode.outcome || '',
        ],
        { AGENTDB_PATH: this.dbPath }
      );

      if (code !== 0) {
        throw new Error(`Command failed: ${stderr}`);
      }

      console.error(`Stored episode: ${episode.taskName} (success: ${episode.success})`);
    } catch (error: any) {
      const errorMsg = `Failed to store episode "${episode.taskName}": ${error.message}`;
      console.error('Error storing episode:', errorMsg);
      throw new Error(errorMsg); // Throw instead of silently failing
    }
  }

  async retrieveMemories(
    query: string,
    k: number = 5,
    options: {
      minReward?: number;
      onlySuccesses?: boolean;
      onlyFailures?: boolean;
      synthesizeContext?: boolean;
    } = {}
  ): Promise<Memory[]> {
    if (!this.initialized) {
      throw new Error('AgentDB not initialized. Call initialize() first.');
    }

    // Build safe argument array
    const args = ['agentdb', 'reflexion', 'retrieve', query, '--k', k.toString()];

    if (options.minReward !== undefined) {
      args.push('--min-reward', options.minReward.toString());
    }
    if (options.onlySuccesses) {
      args.push('--only-successes');
    }
    if (options.onlyFailures) {
      args.push('--only-failures');
    }
    if (options.synthesizeContext) {
      args.push('--synthesize-context');
    }

    try {
      const { stdout, code, stderr } = await spawnAsync('npx', args, {
        AGENTDB_PATH: this.dbPath,
      });

      if (code !== 0) {
        throw new Error(`Command failed: ${stderr}`);
      }

      // Parse JSON output
      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find((line) => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        return Array.isArray(data) ? data : [data];
      }

      return [];
    } catch (error: any) {
      // Throw error instead of silently returning empty array
      throw new Error(`Failed to retrieve memories for query "${query}": ${error.message}`);
    }
  }

  async queryWithContext(
    query: string,
    options: {
      k?: number;
      minConfidence?: number;
      domain?: string;
    } = {}
  ): Promise<{ memories: Memory[]; context?: string }> {
    if (!this.initialized) {
      throw new Error('AgentDB not initialized. Call initialize() first.');
    }

    const { k = 5, minConfidence = 0.0, domain } = options;

    // Build safe argument array
    const args = [
      'agentdb',
      'query',
      '--query',
      query,
      '--k',
      k.toString(),
      '--min-confidence',
      minConfidence.toString(),
    ];

    if (domain) {
      args.push('--domain', domain);
    }

    args.push('--synthesize-context', '--format', 'json');

    try {
      const { stdout, code, stderr } = await spawnAsync('npx', args, {
        AGENTDB_PATH: this.dbPath,
      });

      if (code !== 0) {
        throw new Error(`Command failed: ${stderr}`);
      }

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find((line) => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        return {
          memories: Array.isArray(data) ? data : [data],
          context: data.context || data.summary,
        };
      }

      return { memories: [] };
    } catch (error: any) {
      // Throw error instead of silently returning empty array
      throw new Error(`Failed to query with context "${query}": ${error.message}`);
    }
  }

  async consolidateSkills(options: {
    minAttempts?: number;
    minReward?: number;
    timeWindowDays?: number;
  } = {}): Promise<void> {
    if (!this.initialized) {
      throw new Error('AgentDB not initialized. Call initialize() first.');
    }

    const { minAttempts = 3, minReward = 0.7, timeWindowDays = 7 } = options;

    try {
      const { code, stderr } = await spawnAsync(
        'npx',
        [
          'agentdb',
          'skill',
          'consolidate',
          minAttempts.toString(),
          minReward.toString(),
          timeWindowDays.toString(),
          'true',
        ],
        { AGENTDB_PATH: this.dbPath }
      );

      if (code !== 0) {
        throw new Error(`Command failed: ${stderr}`);
      }

      console.error('Skills consolidated from successful episodes');
    } catch (error: any) {
      throw new Error(`Failed to consolidate skills: ${error.message}`);
    }
  }

  async getStats(): Promise<any> {
    if (!this.initialized) {
      throw new Error('AgentDB not initialized. Call initialize() first.');
    }

    try {
      const { stdout, code, stderr } = await spawnAsync('npx', ['agentdb', 'db', 'stats'], {
        AGENTDB_PATH: this.dbPath,
      });

      if (code !== 0) {
        throw new Error(`Command failed: ${stderr}`);
      }

      return { stats: stdout.trim() };
    } catch (error: any) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}

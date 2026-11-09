/**
 * CLI fallback for EnhancedAgentDBMemory.
 *
 * Used only when the optional `agentdb` package cannot be imported in-process.
 * Every call spawns `npx agentdb ...` (roughly 300 ms each).
 *
 * SECURITY: commands are spawned with argument arrays (no shell), so query,
 * taskName, outcome, strategy and the like are never shell-interpolated.
 *
 * agentdb 3.x prints human-readable text, not JSON, for `reflexion retrieve`,
 * `query` and `skill search`, so those lookups are best-effort and usually
 * return nothing here. Stores, consolidation and the episode/skill counts work.
 */

import { spawn } from 'child_process';
import type { Episode, Memory, Skill } from './enhanced-memory.js';

// The sql.js backend rewrites the whole file and refuses to save over a
// concurrent change, so CLI calls against one database are run one at a time.
const dbQueues = new Map<string, Promise<unknown>>();

// agentdb 3.x CLI calls `db.save()`, which only the sql.js backend implements;
// with native better-sqlite3 the write lands but the command exits 1. Force the
// sql.js backend so every CLI call reports its real status.
const agentdbEnv = (dbPath: string): Record<string, string> => ({
  AGENTDB_PATH: dbPath,
  AGENTDB_FORCE_SQLJS: '1',
});

function run(dbPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const next = (dbQueues.get(dbPath) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => spawnOnce('npx', ['agentdb', ...args], agentdbEnv(dbPath)));
  dbQueues.set(dbPath, next);
  return next;
}

function spawnOnce(
  cmd: string,
  args: string[],
  env: Record<string, string>
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
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

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

function firstJson(stdout: string): any {
  const line = stdout.trim().split('\n').find((l) => l.startsWith('[') || l.startsWith('{'));
  return line ? JSON.parse(line) : undefined;
}

/** Reads `<table>: N records` from `agentdb db stats` output. */
function recordCount(text: string, table: string): number {
  const match = stripAnsi(text).match(new RegExp(`^\\s*${table}:\\s*(\\d+)\\s+records`, 'm'));
  return match ? parseInt(match[1], 10) : 0;
}

export async function cliInit(dbPath: string): Promise<void> {
  try {
    await run(dbPath, ['init', dbPath, '--dimension', '768', '--preset', 'high-performance', '--enable-cache']);
  } catch (error: any) {
    if (!error.message.includes('already exists')) {
      console.error('⚠️ AgentDB initialization warning:', error.message);
    }
  }
}

export async function cliStoreEpisode(dbPath: string, episode: Episode, critique?: string): Promise<void> {
  const args = [
    'reflexion', 'store',
    episode.sessionId,
    episode.taskName,
    episode.confidence.toString(),
    episode.success.toString(),
    episode.outcome || '',
  ];
  if (episode.strategy) args.push('--strategy', episode.strategy);
  if (episode.reasoning) args.push('--reasoning', episode.reasoning);
  if (critique) args.push('--critique', critique);
  await run(dbPath, args);
}

export async function cliRetrieve(
  dbPath: string,
  query: string,
  k: number,
  options: {
    minReward?: number;
    onlySuccesses?: boolean;
    onlyFailures?: boolean;
    synthesizeContext?: boolean;
    enableReasoning?: boolean;
    timeWindow?: number;
  }
): Promise<Memory[]> {
  const args = ['reflexion', 'retrieve', query, '--k', String(k)];
  if (options.minReward !== undefined) args.push('--min-reward', String(options.minReward));
  if (options.onlySuccesses) args.push('--only-successes');
  if (options.onlyFailures) args.push('--only-failures');
  if (options.synthesizeContext) args.push('--synthesize-context');
  if (options.enableReasoning) args.push('--enable-causal-reasoning');
  if (options.timeWindow) args.push('--time-window', String(options.timeWindow));
  const data = firstJson((await run(dbPath, args)).stdout);
  return data === undefined ? [] : Array.isArray(data) ? data : [data];
}

export async function cliQuery(
  dbPath: string,
  query: string,
  options: { k: number; minConfidence: number; domain?: string; synthesizeReasoning: boolean }
): Promise<{ memories: Memory[]; context?: string; reasoning?: string }> {
  const args = [
    'query',
    '--query', query,
    '--k', String(options.k),
    '--min-confidence', String(options.minConfidence),
    '--synthesize-context',
    '--format', 'json',
  ];
  if (options.domain) args.push('--domain', options.domain);
  if (options.synthesizeReasoning) args.push('--enable-causal-reasoning');
  const data = firstJson((await run(dbPath, args)).stdout);
  if (data === undefined) return { memories: [] };
  return {
    memories: Array.isArray(data) ? data : [data],
    context: data.context || data.summary,
    reasoning: data.reasoning || data.causal_chain,
  };
}

export async function cliConsolidate(
  dbPath: string,
  options: { minAttempts: number; minReward: number; timeWindowDays: number }
): Promise<number> {
  // The fourth positional is agentdb's extract-patterns flag.
  const { stdout } = await run(dbPath, [
    'skill', 'consolidate',
    String(options.minAttempts),
    String(options.minReward),
    String(options.timeWindowDays),
    'true',
  ]);
  const text = stripAnsi(stdout);
  const created = text.match(/Created\s+(\d+)/i) ?? text.match(/(\d+)\s+skills?\s+(?:created|consolidated)/i);
  return created ? parseInt(created[1], 10) : 0;
}

export async function cliSearchSkills(
  dbPath: string,
  query: string,
  options: { k: number; minSuccessRate: number; sortBy: string }
): Promise<Skill[]> {
  const data = firstJson(
    (await run(dbPath, [
      'skill', 'search', query,
      '--k', String(options.k),
      '--min-success-rate', String(options.minSuccessRate),
      '--sort-by', options.sortBy,
      '--format', 'json',
    ])).stdout
  );
  return data === undefined ? [] : Array.isArray(data) ? data : [data];
}

/**
 * Episode and skill counts. `agentdb db stats` does not list skills, so the
 * file is read directly with better-sqlite3 (a dependency of this package);
 * if that fails, the episode count comes from the CLI output.
 */
export async function cliCounts(dbPath: string): Promise<{ episodes: number; skills: number }> {
  await (dbQueues.get(dbPath) ?? Promise.resolve()).catch(() => undefined);
  try {
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
      return { episodes: count('episodes'), skills: count('skills') };
    } finally {
      db.close();
    }
  } catch {
    const { stdout } = await run(dbPath, ['db', 'stats']);
    return { episodes: recordCount(stdout, 'episodes'), skills: 0 };
  }
}

export async function cliOptimize(dbPath: string): Promise<void> {
  await run(dbPath, ['db', 'vacuum']);
  await run(dbPath, ['db', 'reindex']);
  await run(dbPath, ['db', 'optimize-vectors']);
}

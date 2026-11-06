import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HybridAgentDBMemory } from '../src/hybrid-memory.js';

describe('HybridAgentDBMemory (real better-sqlite3)', () => {
  let dir: string;
  let memory: HybridAgentDBMemory;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'hybrid-memory-'));
    memory = new HybridAgentDBMemory(join(dir, 'test.db'));
    await memory.initialize();
    await memory.bulkStoreEpisodes([
      { sessionId: 's', taskName: 'grasp cup', confidence: 0.9, success: true, outcome: 'picked up' },
      { sessionId: 's', taskName: 'grasp cup', confidence: 0.2, success: false, outcome: 'dropped' },
      { sessionId: 's', taskName: 'navigate', confidence: 0.8, success: true, outcome: 'cup reached' },
    ]);
  });

  afterEach(async () => {
    await memory.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns stored episodes when the agentdb CLI has nothing for them', async () => {
    const results = await memory.retrieveMemories('grasp', 5);
    expect(results.map(r => r.outcome).sort()).toEqual(['dropped', 'picked up']);
  }, 60_000);

  it('keeps success and reward filters when the keyword matches outcome', async () => {
    const successes = await memory.retrieveMemories('cup', 5, { onlySuccesses: true });
    expect(successes.every(r => r.success)).toBe(true);
    expect(successes).toHaveLength(2);

    const confident = await memory.retrieveMemories('cup', 5, { minReward: 0.85 });
    expect(confident.map(r => r.outcome)).toEqual(['picked up']);
  }, 60_000);

  it('does not pass the query through a shell', async () => {
    const marker = join(dir, 'pwned');
    await memory.retrieveMemories(`x"; touch ${marker}; echo "`, 1);
    await memory.retrieveMemories(`$(touch ${marker})`, 1);
    expect(existsSync(marker)).toBe(false);
  }, 60_000);
});

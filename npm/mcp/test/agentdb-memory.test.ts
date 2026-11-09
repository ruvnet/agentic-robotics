import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AgentDBMemory } from '../src/memory.js';

// Runs the real `agentdb` CLI that this package depends on. agentdb 3.x exits 1
// from `reflexion store` and `skill consolidate` on the native better-sqlite3
// backend (it calls `db.save()`), so this guards the AGENTDB_FORCE_SQLJS env.
describe('AgentDBMemory (real agentdb CLI)', () => {
  let dir: string;
  let memory: AgentDBMemory;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'agentdb-memory-'));
    memory = new AgentDBMemory(join(dir, 'test.db'));
    await memory.initialize();
  }, 120_000);

  afterEach(async () => {
    await memory.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('stores episodes, consolidates skills and reports stats without CLI errors', async () => {
    await memory.storeEpisode({
      sessionId: 's1',
      taskName: 'grasp cup',
      confidence: 0.9,
      success: true,
      outcome: 'picked up',
    });
    await memory.storeEpisode({
      sessionId: 's1',
      taskName: 'navigate',
      confidence: 0.8,
      success: true,
      outcome: 'arrived',
    });

    await expect(
      memory.consolidateSkills({ minAttempts: 1, minReward: 0.5, timeWindowDays: 7 })
    ).resolves.toBeUndefined();

    const stats = await memory.getStats();
    const text = String(stats.stats).replace(/\x1b\[[0-9;]*m/g, '');
    expect(text).toMatch(/episodes:\s*2 records/);
  }, 180_000);
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Simulate the optional `agentdb` package failing to import in this process.
// The CLI fallback runs `npx agentdb` in a child process, which is unaffected.
vi.mock('agentdb', () => {
  throw new Error('agentdb not installed');
});

const { AgentDBMemory } = await import('../src/memory.js');

const strip = (s: unknown) => String(s).replace(/\x1b\[[0-9;]*m/g, '');

// agentdb 3.x exits 1 from `reflexion store` and `skill consolidate` on the
// native better-sqlite3 backend (it calls `db.save()`), so this also guards
// the AGENTDB_FORCE_SQLJS env and the per-database call queue.
describe('AgentDBMemory CLI fallback (agentdb import fails)', () => {
  let dir: string;
  let memory: InstanceType<typeof AgentDBMemory>;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'agentdb-cli-'));
    memory = new AgentDBMemory(join(dir, 'test.db'));
    await memory.initialize();
  }, 120_000);

  afterEach(async () => {
    await memory.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('stores concurrently, consolidates and reports stats through the CLI', async () => {
    await Promise.all(
      [1, 2, 3].map((i) =>
        memory.storeEpisode({ sessionId: 's', taskName: `task ${i}`, confidence: 0.9, success: true, outcome: `o${i}` })
      )
    );
    await expect(
      memory.consolidateSkills({ minAttempts: 1, minReward: 0.5, timeWindowDays: 7 })
    ).resolves.toBeUndefined();

    const stats = await memory.getStats();
    const text = strip(stats.stats);
    expect(text).toMatch(/Database Statistics/); // printed by the CLI, not the in-process engine
    expect(text).toMatch(/episodes:\s*3 records/);
  }, 300_000);
});

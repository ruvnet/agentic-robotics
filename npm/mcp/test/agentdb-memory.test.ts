import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AgentDBMemory } from '../src/memory.js';

const strip = (s: unknown) => String(s).replace(/\x1b\[[0-9;]*m/g, '');

// Imports the real `agentdb` package and drives it in-process.
describe('AgentDBMemory (real agentdb import, in-process)', () => {
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

  it('stores, filters, consolidates and counts episodes', async () => {
    await memory.storeEpisode({ sessionId: 's1', taskName: 'grasp cup', confidence: 0.9, success: true, outcome: 'picked up' });
    await memory.storeEpisode({ sessionId: 's1', taskName: 'grasp cup', confidence: 0.2, success: false, outcome: 'dropped' });

    const all = await memory.retrieveMemories('grasp cup', 5);
    expect(all.map((m) => m.outcome).sort()).toEqual(['dropped', 'picked up']);

    const successes = await memory.retrieveMemories('grasp cup', 5, { onlySuccesses: true });
    expect(successes.map((m) => m.outcome)).toEqual(['picked up']);
    expect(successes[0]).toMatchObject({ task: 'grasp cup', confidence: 0.9, success: true });

    const confident = await memory.queryWithContext('grasp cup', { minConfidence: 0.5 });
    expect(confident.memories.map((m) => m.outcome)).toEqual(['picked up']);

    await expect(
      memory.consolidateSkills({ minAttempts: 1, minReward: 0.5, timeWindowDays: 7 })
    ).resolves.toBeUndefined();

    const stats = await memory.getStats();
    expect(strip(stats.stats)).toMatch(/episodes:\s*2 records/);
    // The CLI prints a "Database Statistics" banner; the in-process engine does not.
    expect(strip(stats.stats)).not.toMatch(/Database Statistics/);
  }, 180_000);

  it('keeps every episode when stores run concurrently', async () => {
    await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        memory.storeEpisode({
          sessionId: 's2',
          taskName: `task ${i}`,
          confidence: 0.9,
          success: true,
          outcome: `outcome ${i}`,
        })
      )
    );

    const stats = await memory.getStats();
    expect(strip(stats.stats)).toMatch(/episodes:\s*5 records/);
  }, 300_000);
});

// Imports `agentdb` directly: guards the exact pin and the library API the
// in-process engine depends on, so an agentdb release that drops it fails here.
describe('agentdb library (direct import)', () => {
  it('is the pinned version and stores then retrieves an episode in-process', async () => {
    const { readFileSync } = await import('fs');
    const agentdb = await import('agentdb');
    const { InProcessAgentDB } = await import('../src/agentdb-engine.js');

    const pinned = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
      .optionalDependencies.agentdb;
    const installed = (await import('agentdb/package.json', { with: { type: 'json' } })).default.version;
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    expect(installed).toBe(pinned);
    expect(typeof agentdb.AgentDB).toBe('function');

    const dir = mkdtempSync(join(tmpdir(), 'agentdb-direct-'));
    const engine = await InProcessAgentDB.open(join(dir, 'direct.db'));
    try {
      expect(engine).not.toBeNull();
      await engine!.storeEpisode({ sessionId: 'd', taskName: 'dock to charger', confidence: 0.85, success: true, outcome: 'docked', strategy: 'slow approach' });
      const got = await engine!.retrieve('dock to charger', 3);
      expect(got[0]).toMatchObject({ task: 'dock to charger', outcome: 'docked', strategy: 'slow approach', success: true });
    } finally {
      await engine?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

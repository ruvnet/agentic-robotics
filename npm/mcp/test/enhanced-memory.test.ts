import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EnhancedAgentDBMemory } from '../src/enhanced-memory.js';

// Imports the real `agentdb` package and drives it in-process.
describe('EnhancedAgentDBMemory (real agentdb import, in-process)', () => {
  let dir: string;
  let memory: EnhancedAgentDBMemory;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'enhanced-memory-'));
    memory = new EnhancedAgentDBMemory(join(dir, 'test.db'));
    await memory.initialize();
  }, 120_000);

  afterEach(async () => {
    await memory.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('runs in-process', () => {
    expect(memory.inProcess).toBe(true);
  });

  it('stores, retrieves, synthesizes, consolidates and counts', async () => {
    await memory.storeEpisode({
      sessionId: 's1', taskName: 'grasp cup', confidence: 0.9, success: true,
      outcome: 'picked up', strategy: 'top grasp', reasoning: 'handle faced the gripper',
    });
    await memory.storeEpisode({ sessionId: 's1', taskName: 'grasp cup', confidence: 0.2, success: false, outcome: 'dropped' });

    const all = await memory.retrieveMemories('grasp cup', 5);
    expect(all.map((m) => m.outcome).sort()).toEqual(['dropped', 'picked up']);

    const [success] = await memory.retrieveMemories('grasp cup', 5, { onlySuccesses: true });
    expect(success).toMatchObject({
      task: 'grasp cup', confidence: 0.9, success: true, outcome: 'picked up',
      strategy: 'top grasp', reasoning: 'handle faced the gripper',
    });
    expect(success.critique).toMatch(/Successfully completed grasp cup/);
    expect(typeof success.similarity).toBe('number');

    const ctx = await memory.queryWithContext('grasp cup', { minConfidence: 0.5 });
    expect(ctx.memories.map((m) => m.outcome)).toEqual(['picked up']);
    expect(ctx.context).toMatch(/1 similar past experience/);
    expect(ctx.reasoning).toBeTruthy();

    expect(await memory.consolidateSkills({ minAttempts: 1, minReward: 0.5, timeWindowDays: 7 })).toBe(1);
    const skills = await memory.searchSkills('grasp cup', { k: 5, minSuccessRate: 0 });
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ numAttempts: expect.any(Number), successRate: expect.any(Number) });

    const stats = await memory.getStats();
    expect(stats.totalEpisodes).toBe(2);
    expect(stats.totalSkills).toBe(1);

    await memory.optimize();
    expect((await memory.getStats()).totalEpisodes).toBe(2);
  }, 180_000);

  it('keeps every episode when stores run concurrently', async () => {
    await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        memory.storeEpisode({ sessionId: 's2', taskName: `task ${i}`, confidence: 0.9, success: true, outcome: `o${i}` })
      )
    );
    expect((await memory.getStats()).totalEpisodes).toBe(5);
  }, 300_000);
});

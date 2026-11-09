import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Simulate the optional `agentdb` package failing to import in this process.
// The CLI fallback runs `npx agentdb` in a child process, which is unaffected.
vi.mock('agentdb', () => {
  throw new Error('agentdb not installed');
});

const { EnhancedAgentDBMemory } = await import('../src/enhanced-memory.js');

describe('EnhancedAgentDBMemory CLI fallback (agentdb import fails)', () => {
  let dir: string;
  let memory: InstanceType<typeof EnhancedAgentDBMemory>;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'enhanced-cli-'));
    memory = new EnhancedAgentDBMemory(join(dir, 'test.db'));
    await memory.initialize();
  }, 120_000);

  afterEach(async () => {
    await memory.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('falls back to the CLI and still stores, consolidates and counts', async () => {
    expect(memory.inProcess).toBe(false);
    await Promise.all(
      [1, 2, 3].map((i) =>
        memory.storeEpisode({ sessionId: 's', taskName: 'task', confidence: 0.9, success: true, outcome: `o${i}` })
      )
    );
    expect(await memory.consolidateSkills({ minAttempts: 1, minReward: 0.5, timeWindowDays: 7 })).toBe(1);

    const stats = await memory.getStats();
    expect(stats.totalEpisodes).toBe(3);
    expect(stats.totalSkills).toBe(1);
  }, 300_000);
});

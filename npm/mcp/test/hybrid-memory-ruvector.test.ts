import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { HybridAgentDBMemory, loadRuvectorEmbedder, SEMANTIC_MIN_SIMILARITY } from '../src/hybrid-memory.js';

// Imports the real optional `ruvector` package (no mocks) and checks that it
// gives retrieveMemories a semantic path the keyword SQL fallback cannot match.
describe('HybridAgentDBMemory semantic search (real ruvector)', () => {
  let dir: string;
  let memory: HybridAgentDBMemory;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'hybrid-ruvector-'));
    memory = new HybridAgentDBMemory(join(dir, 'test.db'));
    await memory.initialize();
    await memory.bulkStoreEpisodes([
      { sessionId: 's', taskName: 'pick up box', confidence: 0.9, success: true, outcome: 'lifted it with the gripper' },
      { sessionId: 's', taskName: 'battery telemetry', confidence: 0.8, success: true, outcome: 'voltage nominal' },
      { sessionId: 's', taskName: 'avoid obstacle', confidence: 0.7, success: true, outcome: 'detoured around the crate' },
    ]);
  }, 120_000);

  afterAll(async () => {
    await memory?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads ruvector and its ONNX embedder', async () => {
    const mod: any = await import('ruvector');
    expect(typeof mod.embed).toBe('function');
    const rv = await loadRuvectorEmbedder();
    expect(rv).not.toBeNull();
    expect(rv!.getActiveModelId()).toMatch(/MiniLM/i);
  }, 120_000);

  it('finds a related episode that shares no keyword with the query', async () => {
    const query = 'grab the item using the claw';
    // The keyword fallback matches the whole query as a substring: nothing here.
    const results = await memory.retrieveMemories(query, 3);
    expect(results.map(r => r.task)).toEqual(['pick up box']);
    expect(results[0].similarity).toBeGreaterThanOrEqual(SEMANTIC_MIN_SIMILARITY);
  }, 120_000);

  it('caches embeddings in the episode rows', () => {
    const db = new Database(join(dir, 'test.db'), { readonly: true });
    const rows = db.prepare('SELECT embedding, embedding_model FROM reflexion_episodes').all() as any[];
    db.close();
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.embedding.byteLength).toBe(384 * 4);
      expect(row.embedding_model).toMatch(/MiniLM/i);
    }
  });

  it('applies success filters before ranking', async () => {
    await memory.storeEpisode({ sessionId: 's', taskName: 'pick up box', confidence: 0.1, success: false, outcome: 'gripper slipped' });
    const failures = await memory.retrieveMemories('grab the item using the claw', 3, { onlyFailures: true });
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.every(r => !r.success)).toBe(true);
  }, 120_000);
});

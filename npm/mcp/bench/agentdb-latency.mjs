// Per-operation latency of AgentDBMemory: in-process agentdb vs the `npx agentdb` CLI fallback.
// Run after `npm run build`: node bench/agentdb-latency.mjs [cliIterations] [inProcessIterations]
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir, cpus } from 'os';
import { join } from 'path';
import { AgentDBMemory } from '../dist/memory.js';
import { InProcessAgentDB } from '../dist/agentdb-engine.js';

const cliN = Number(process.argv[2] ?? 10);
const inN = Number(process.argv[3] ?? 200);

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, median: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3) };
};

async function time(fn) {
  const t = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - t) / 1e6;
}

async function run(label, n, forceCli) {
  const dir = mkdtempSync(join(tmpdir(), 'agentdb-bench-'));
  const realOpen = InProcessAgentDB.open;
  if (forceCli) InProcessAgentDB.open = async () => null;
  const mem = new AgentDBMemory(join(dir, 'bench.db'));
  const quiet = console.error;
  console.error = () => {};
  try {
    await mem.initialize();
    // Warm-up: loads the embedding model and fills caches before timing.
    await mem.storeEpisode({ sessionId: 'w', taskName: 'warm up', confidence: 0.5, success: true, outcome: 'w' });
    await mem.retrieveMemories('warm up', 5);
    const store = [], retrieve = [], stat = [];
    for (let i = 0; i < n; i++) {
      store.push(await time(() => mem.storeEpisode({ sessionId: 's', taskName: `grasp object ${i}`, confidence: 0.8, success: i % 3 !== 0, outcome: `run ${i}` })));
    }
    for (let i = 0; i < n; i++) retrieve.push(await time(() => mem.retrieveMemories(`grasp object ${i}`, 5)));
    for (let i = 0; i < n; i++) stat.push(await time(() => mem.getStats()));
    return { label, store: stats(store), retrieve: stats(retrieve), stats: stats(stat) };
  } finally {
    console.error = quiet;
    await mem.close();
    InProcessAgentDB.open = realOpen;
    rmSync(dir, { recursive: true, force: true });
  }
}

const agentdbVersion = (await import('agentdb/package.json', { with: { type: 'json' } })).default.version;
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0].model, agentdb: agentdbVersion }));
console.log(JSON.stringify(await run('cli (npx agentdb)', cliN, true)));
console.log(JSON.stringify(await run('in-process', inN, false)));

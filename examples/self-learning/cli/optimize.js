#!/usr/bin/env node
/**
 * Optimize CLI - Quick access to optimization commands
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const swarmSize = args[0] || '12';
const iterations = args[1] || '10';

console.log('🎯 Running Benchmark Optimization');
console.log(`   Swarm Size: ${swarmSize}`);
console.log(`   Iterations: ${iterations}\n`);

const scriptPath = join(__dirname, '..', 'benchmark-optimizer.ts');

const child = spawn('npx', ['tsx', scriptPath, swarmSize, iterations], {
  stdio: 'inherit',
  cwd: join(__dirname, '..'),
});

child.on('close', (code) => {
  process.exit(code || 0);
});

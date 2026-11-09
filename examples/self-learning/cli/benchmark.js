#!/usr/bin/env node
/**
 * Benchmark CLI - Quick benchmark command
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const type = args[0] || 'quick';

let swarmSize, iterations;

switch (type) {
  case 'quick':
    swarmSize = '6';
    iterations = '3';
    console.log('⚡ Quick Benchmark (6 agents, 3 iterations)\n');
    break;
  case 'standard':
    swarmSize = '12';
    iterations = '10';
    console.log('📊 Standard Benchmark (12 agents, 10 iterations)\n');
    break;
  case 'thorough':
    swarmSize = '24';
    iterations = '20';
    console.log('🔬 Thorough Benchmark (24 agents, 20 iterations)\n');
    break;
  default:
    swarmSize = args[0];
    iterations = args[1] || '10';
    console.log(`🎯 Custom Benchmark (${swarmSize} agents, ${iterations} iterations)\n`);
}

const scriptPath = join(__dirname, '..', 'benchmark-optimizer.ts');

const child = spawn('npx', ['tsx', scriptPath, swarmSize, iterations], {
  stdio: 'inherit',
  cwd: join(__dirname, '..'),
});

child.on('close', (code) => {
  process.exit(code || 0);
});

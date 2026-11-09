#!/usr/bin/env node
/**
 * Validate CLI - Quick validation command
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Running System Validation\n');

const scriptPath = join(__dirname, '..', 'metrics-validator.ts');

const child = spawn('npx', ['tsx', scriptPath], {
  stdio: 'inherit',
  cwd: join(__dirname, '..'),
});

child.on('close', (code) => {
  process.exit(code || 0);
});

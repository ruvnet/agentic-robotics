#!/usr/bin/env node
/**
 * Pre-Execution Hook for Claude Code
 * Validates environment, initializes memory bank, and sets up metrics collection
 */

import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function validateEnvironment() {
  log(colors.cyan, '[PRE-EXEC]', 'Validating environment...');

  const checks = {
    node_version: process.version,
    memory_available: process.memoryUsage().heapTotal / 1024 / 1024,
    openrouter_key: process.env.OPENROUTER_API_KEY ? 'configured' : 'missing'
  };

  log(colors.green, '[PRE-EXEC]', `✓ Node.js ${checks.node_version}`);
  log(colors.green, '[PRE-EXEC]', `✓ Memory: ${checks.memory_available.toFixed(0)}MB`);

  if (checks.openrouter_key === 'missing') {
    log(colors.yellow, '[PRE-EXEC]', '⚠ OPENROUTER_API_KEY not set (using mock mode)');
  } else {
    log(colors.green, '[PRE-EXEC]', '✓ OpenRouter API key configured');
  }

  return checks;
}

async function initializeMemoryBank() {
  log(colors.cyan, '[PRE-EXEC]', 'Initializing memory bank...');

  const memoryBankPath = './examples/data';

  if (!existsSync(memoryBankPath)) {
    mkdirSync(memoryBankPath, { recursive: true });
    log(colors.green, '[PRE-EXEC]', '✓ Created memory bank directory');
  } else {
    log(colors.green, '[PRE-EXEC]', '✓ Memory bank directory exists');
  }

  // Create optimization data directory
  const optimizationPath = join(memoryBankPath, 'optimization');
  if (!existsSync(optimizationPath)) {
    mkdirSync(optimizationPath, { recursive: true });
  }

  return { path: memoryBankPath, initialized: true };
}

async function loadSettings() {
  log(colors.cyan, '[PRE-EXEC]', 'Loading settings...');

  try {
    const settingsPath = './.claude/settings.json';
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));

    log(colors.green, '[PRE-EXEC]', `✓ Settings loaded`);
    log(colors.cyan, '[PRE-EXEC]', `  - Swarm config: ${settings.swarm_config.max_concurrent_swarms} concurrent swarms`);
    log(colors.cyan, '[PRE-EXEC]', `  - Memory bank: ${settings.memory_bank.enabled ? 'enabled' : 'disabled'}`);
    log(colors.cyan, '[PRE-EXEC]', `  - Metrics tracking: ${settings.metrics.track_performance ? 'enabled' : 'disabled'}`);

    return settings;
  } catch (error) {
    log(colors.red, '[PRE-EXEC]', `✗ Failed to load settings: ${error.message}`);
    return null;
  }
}

async function initializeMetrics() {
  log(colors.cyan, '[PRE-EXEC]', 'Initializing metrics collection...');

  const metricsPath = './examples/data/metrics';
  if (!existsSync(metricsPath)) {
    mkdirSync(metricsPath, { recursive: true });
  }

  const sessionId = `session-${Date.now()}`;
  const metricsFile = join(metricsPath, `${sessionId}.json`);

  const initialMetrics = {
    sessionId,
    startTime: new Date().toISOString(),
    validations: [],
    executions: [],
    optimizations: []
  };

  log(colors.green, '[PRE-EXEC]', `✓ Metrics session: ${sessionId}`);

  return { sessionId, metricsFile, initialMetrics };
}

async function validateDependencies() {
  log(colors.cyan, '[PRE-EXEC]', 'Validating dependencies...');

  try {
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    const deps = packageJson.dependencies || {};

    const requiredDeps = ['agentdb', 'agentic-flow', '@modelcontextprotocol/sdk'];
    const missingDeps = requiredDeps.filter(dep => !deps[dep]);

    if (missingDeps.length > 0) {
      log(colors.yellow, '[PRE-EXEC]', `⚠ Missing dependencies: ${missingDeps.join(', ')}`);
    } else {
      log(colors.green, '[PRE-EXEC]', '✓ All required dependencies present');
    }

    return { deps, missingDeps };
  } catch (error) {
    log(colors.red, '[PRE-EXEC]', `✗ Dependency validation failed: ${error.message}`);
    return { deps: {}, missingDeps: [] };
  }
}

async function main() {
  log(colors.bright + colors.green, '[PRE-EXEC]', '═══════════════════════════════════════════');
  log(colors.bright + colors.green, '[PRE-EXEC]', 'Pre-Execution Validation Started');
  log(colors.bright + colors.green, '[PRE-EXEC]', '═══════════════════════════════════════════');
  console.log('');

  try {
    const env = await validateEnvironment();
    const settings = await loadSettings();
    const memoryBank = await initializeMemoryBank();
    const metrics = await initializeMetrics();
    const deps = await validateDependencies();

    console.log('');
    log(colors.bright + colors.green, '[PRE-EXEC]', '═══════════════════════════════════════════');
    log(colors.bright + colors.green, '[PRE-EXEC]', '✓ Pre-Execution Validation Complete');
    log(colors.bright + colors.green, '[PRE-EXEC]', '═══════════════════════════════════════════');
    console.log('');

    // Export validation results for use by main execution
    const validationResults = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: env,
      settings,
      memoryBank,
      metrics,
      dependencies: deps
    };

    // Store validation results
    const validationPath = './examples/data/last-validation.json';
    const fs = await import('fs/promises');
    await fs.writeFile(validationPath, JSON.stringify(validationResults, null, 2));

    process.exit(0);
  } catch (error) {
    log(colors.red, '[PRE-EXEC]', `✗ Validation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main().catch(err => {
  log(colors.red, '[PRE-EXEC]', `Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

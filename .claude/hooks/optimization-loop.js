#!/usr/bin/env node
/**
 * Optimization Loop Hook for Claude Code
 * Continuous optimization feedback loop with swarm intelligence
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bright: '\x1b[1m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function loadMemoryBank() {
  const memoryBankPath = './examples/data/memory-bank.json';

  if (!existsSync(memoryBankPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(memoryBankPath, 'utf8'));
  } catch (error) {
    log(colors.yellow, '[OPT-LOOP]', `⚠ Failed to load memory bank: ${error.message}`);
    return null;
  }
}

async function analyzePerformanceTrends(memoryBank) {
  if (!memoryBank || memoryBank.learnings.length < 2) {
    return {
      trend: 'insufficient_data',
      recommendation: 'continue_exploration'
    };
  }

  const recentLearnings = memoryBank.learnings.slice(-5);
  const successRates = recentLearnings.map(l => l.successRate);
  const improvements = recentLearnings.map(l => l.averageImprovement);

  const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
  const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;

  // Detect trend
  let trend = 'stable';
  if (successRates[successRates.length - 1] > successRates[0] * 1.1) {
    trend = 'improving';
  } else if (successRates[successRates.length - 1] < successRates[0] * 0.9) {
    trend = 'declining';
  }

  // Calculate variance (exploration vs exploitation indicator)
  const variance = improvements.reduce((sum, val) => {
    return sum + Math.pow(val - avgImprovement, 2);
  }, 0) / improvements.length;

  let recommendation = 'continue_current';
  if (trend === 'declining') {
    recommendation = 'increase_exploration';
  } else if (trend === 'improving') {
    recommendation = 'focus_exploitation';
  } else if (variance < 0.001) {
    recommendation = 'inject_variation';
  }

  return {
    trend,
    avgSuccessRate,
    avgImprovement,
    variance,
    recommendation
  };
}

async function generateOptimizationStrategy(analysis) {
  log(colors.cyan, '[OPT-LOOP]', 'Generating optimization strategy...');

  const strategy = {
    timestamp: new Date().toISOString(),
    trend: analysis.trend,
    parameters: {}
  };

  switch (analysis.recommendation) {
    case 'increase_exploration':
      strategy.parameters = {
        explorationRate: 0.5,
        exploitationRate: 0.5,
        mutationRate: 0.3,
        populationDiversity: 'high'
      };
      log(colors.yellow, '[OPT-LOOP]', '→ Strategy: Increase exploration (declining performance)');
      break;

    case 'focus_exploitation':
      strategy.parameters = {
        explorationRate: 0.2,
        exploitationRate: 0.8,
        mutationRate: 0.1,
        populationDiversity: 'low'
      };
      log(colors.green, '[OPT-LOOP]', '→ Strategy: Focus on exploitation (improving performance)');
      break;

    case 'inject_variation':
      strategy.parameters = {
        explorationRate: 0.4,
        exploitationRate: 0.6,
        mutationRate: 0.5,
        populationDiversity: 'mixed'
      };
      log(colors.cyan, '[OPT-LOOP]', '→ Strategy: Inject variation (performance plateaued)');
      break;

    default:
      strategy.parameters = {
        explorationRate: 0.3,
        exploitationRate: 0.7,
        mutationRate: 0.2,
        populationDiversity: 'medium'
      };
      log(colors.cyan, '[OPT-LOOP]', '→ Strategy: Continue current (stable performance)');
  }

  return strategy;
}

async function applyOptimizationFeedback(strategy) {
  log(colors.cyan, '[OPT-LOOP]', 'Applying optimization feedback...');

  // Update settings with new strategy parameters
  const settingsPath = './.claude/settings.json';
  let settings;

  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (error) {
    log(colors.red, '[OPT-LOOP]', `✗ Failed to load settings: ${error.message}`);
    return false;
  }

  // Update swarm config
  settings.swarm_config.exploration_rate = strategy.parameters.explorationRate;
  settings.swarm_config.exploitation_rate = strategy.parameters.exploitationRate;
  settings.swarm_config.adaptive_learning = true;

  // Add optimization metadata
  settings.optimization_metadata = {
    lastUpdate: strategy.timestamp,
    trend: strategy.trend,
    parameters: strategy.parameters
  };

  // Save updated settings
  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    log(colors.green, '[OPT-LOOP]', '✓ Settings updated with optimization feedback');
    return true;
  } catch (error) {
    log(colors.red, '[OPT-LOOP]', `✗ Failed to save settings: ${error.message}`);
    return false;
  }
}

async function scheduleNextOptimization() {
  log(colors.cyan, '[OPT-LOOP]', 'Scheduling next optimization cycle...');

  const scheduleData = {
    nextRun: new Date(Date.now() + 300000).toISOString(), // 5 minutes
    type: 'continuous_optimization',
    status: 'scheduled'
  };

  const schedulePath = './examples/data/optimization-schedule.json';
  writeFileSync(schedulePath, JSON.stringify(scheduleData, null, 2));

  log(colors.green, '[OPT-LOOP]', `✓ Next optimization: ${scheduleData.nextRun}`);
}

async function main() {
  log(colors.bright + colors.magenta, '[OPT-LOOP]', '═══════════════════════════════════════════');
  log(colors.bright + colors.magenta, '[OPT-LOOP]', 'Optimization Loop Started');
  log(colors.bright + colors.magenta, '[OPT-LOOP]', '═══════════════════════════════════════════');
  console.log('');

  try {
    // Load memory bank
    const memoryBank = await loadMemoryBank();

    if (!memoryBank) {
      log(colors.yellow, '[OPT-LOOP]', 'No memory bank found - first run initialization');
      process.exit(0);
    }

    log(colors.cyan, '[OPT-LOOP]', `Analyzing ${memoryBank.learnings.length} learning sessions...`);

    // Analyze performance trends
    const analysis = await analyzePerformanceTrends(memoryBank);

    log(colors.cyan, '[OPT-LOOP]', `Performance trend: ${analysis.trend}`);
    log(colors.cyan, '[OPT-LOOP]', `Average success rate: ${(analysis.avgSuccessRate * 100).toFixed(1)}%`);
    log(colors.cyan, '[OPT-LOOP]', `Average improvement: ${(analysis.avgImprovement * 100).toFixed(2)}%`);

    // Generate optimization strategy
    const strategy = await generateOptimizationStrategy(analysis);

    // Apply optimization feedback
    const applied = await applyOptimizationFeedback(strategy);

    if (applied) {
      // Schedule next optimization
      await scheduleNextOptimization();
    }

    console.log('');
    log(colors.bright + colors.magenta, '[OPT-LOOP]', '═══════════════════════════════════════════');
    log(colors.bright + colors.magenta, '[OPT-LOOP]', '✓ Optimization Loop Complete');
    log(colors.bright + colors.magenta, '[OPT-LOOP]', '═══════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (error) {
    log(colors.red, '[OPT-LOOP]', `✗ Optimization loop failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main().catch(err => {
  log(colors.red, '[OPT-LOOP]', `Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

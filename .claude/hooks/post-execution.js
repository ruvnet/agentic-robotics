#!/usr/bin/env node
/**
 * Post-Execution Hook for Claude Code
 * Stores results in memory bank, consolidates learnings, updates optimization metrics
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
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

async function collectExecutionResults() {
  log(colors.cyan, '[POST-EXEC]', 'Collecting execution results...');

  const metricsPath = './examples/data/metrics';
  const optimizationPath = './examples/data/optimization';

  const results = {
    executions: [],
    optimizations: [],
    benchmarks: []
  };

  try {
    if (existsSync(metricsPath)) {
      const metricsFiles = readdirSync(metricsPath).filter(f => f.endsWith('.json'));
      for (const file of metricsFiles.slice(-10)) { // Last 10 sessions
        const data = JSON.parse(readFileSync(join(metricsPath, file), 'utf8'));
        results.executions.push(data);
      }
      log(colors.green, '[POST-EXEC]', `✓ Collected ${results.executions.length} execution metrics`);
    }

    if (existsSync(optimizationPath)) {
      const optFiles = readdirSync(optimizationPath).filter(f => f.endsWith('.json'));
      for (const file of optFiles.slice(-10)) {
        const data = JSON.parse(readFileSync(join(optimizationPath, file), 'utf8'));
        results.optimizations.push(data);
      }
      log(colors.green, '[POST-EXEC]', `✓ Collected ${results.optimizations.length} optimization runs`);
    }
  } catch (error) {
    log(colors.yellow, '[POST-EXEC]', `⚠ Error collecting results: ${error.message}`);
  }

  return results;
}

async function consolidateLearnings(results) {
  log(colors.cyan, '[POST-EXEC]', 'Consolidating learnings...');

  const learnings = {
    totalExecutions: results.executions.length,
    totalOptimizations: results.optimizations.length,
    successRate: 0,
    averageImprovement: 0,
    topStrategies: [],
    patterns: []
  };

  // Calculate success rate
  const successfulExecs = results.optimizations.filter(r => r.success || r.improved);
  learnings.successRate = results.optimizations.length > 0
    ? successfulExecs.length / results.optimizations.length
    : 0;

  // Calculate average improvement
  const improvements = results.optimizations
    .filter(r => r.improvementRate)
    .map(r => r.improvementRate);

  if (improvements.length > 0) {
    learnings.averageImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
  }

  // Extract top strategies
  const strategyCounts = {};
  results.optimizations.forEach(opt => {
    if (opt.strategy) {
      strategyCounts[opt.strategy] = (strategyCounts[opt.strategy] || 0) + 1;
    }
  });

  learnings.topStrategies = Object.entries(strategyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([strategy, count]) => ({ strategy, count }));

  log(colors.green, '[POST-EXEC]', `✓ Success rate: ${(learnings.successRate * 100).toFixed(1)}%`);
  log(colors.green, '[POST-EXEC]', `✓ Average improvement: ${(learnings.averageImprovement * 100).toFixed(2)}%`);
  log(colors.green, '[POST-EXEC]', `✓ Top strategies: ${learnings.topStrategies.length}`);

  return learnings;
}

async function updateMemoryBank(learnings) {
  log(colors.cyan, '[POST-EXEC]', 'Updating memory bank...');

  const memoryBankPath = './examples/data/memory-bank.json';

  let memoryBank = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    totalSessions: 0,
    learnings: [],
    optimizationHistory: []
  };

  // Load existing memory bank
  if (existsSync(memoryBankPath)) {
    try {
      memoryBank = JSON.parse(readFileSync(memoryBankPath, 'utf8'));
    } catch (error) {
      log(colors.yellow, '[POST-EXEC]', '⚠ Creating new memory bank');
    }
  }

  // Add new learnings
  memoryBank.totalSessions++;
  memoryBank.lastUpdated = new Date().toISOString();
  memoryBank.learnings.push({
    timestamp: new Date().toISOString(),
    ...learnings
  });

  // Keep only last 100 learning sessions
  if (memoryBank.learnings.length > 100) {
    memoryBank.learnings = memoryBank.learnings.slice(-100);
  }

  // Save updated memory bank
  writeFileSync(memoryBankPath, JSON.stringify(memoryBank, null, 2));

  log(colors.green, '[POST-EXEC]', `✓ Memory bank updated (session ${memoryBank.totalSessions})`);

  return memoryBank;
}

async function generateOptimizationReport(learnings, memoryBank) {
  log(colors.cyan, '[POST-EXEC]', 'Generating optimization report...');

  const report = `# Optimization Report
Generated: ${new Date().toISOString()}
Session: ${memoryBank.totalSessions}

## Summary
- **Total Executions**: ${learnings.totalExecutions}
- **Total Optimizations**: ${learnings.totalOptimizations}
- **Success Rate**: ${(learnings.successRate * 100).toFixed(1)}%
- **Average Improvement**: ${(learnings.averageImprovement * 100).toFixed(2)}%

## Top Strategies
${learnings.topStrategies.map(s => `- **${s.strategy}**: ${s.count} uses`).join('\n')}

## Learning Curve
${generateLearningCurve(memoryBank.learnings)}

## Recommendations
${generateRecommendations(learnings)}

---
*Report generated by Self-Learning Optimization System*
`;

  const reportPath = './examples/data/optimization-report.md';
  writeFileSync(reportPath, report);

  log(colors.green, '[POST-EXEC]', `✓ Report saved: ${reportPath}`);

  return reportPath;
}

function generateLearningCurve(learnings) {
  if (learnings.length < 2) {
    return 'Not enough data to generate learning curve';
  }

  const recent = learnings.slice(-10);
  const improvements = recent.map((l, i) =>
    `  ${i + 1}. Session: ${(l.successRate * 100).toFixed(1)}% success, ${(l.averageImprovement * 100).toFixed(2)}% improvement`
  );

  return improvements.join('\n');
}

function generateRecommendations(learnings) {
  const recommendations = [];

  if (learnings.successRate < 0.8) {
    recommendations.push('- Consider adjusting exploration rate to discover better strategies');
  }

  if (learnings.averageImprovement < 0.05) {
    recommendations.push('- Optimization may be converging; consider introducing new variation strategies');
  }

  if (learnings.topStrategies.length > 0) {
    recommendations.push(`- Top performing strategy: ${learnings.topStrategies[0].strategy}`);
  }

  if (recommendations.length === 0) {
    recommendations.push('- System performing well; continue current optimization strategy');
  }

  return recommendations.join('\n');
}

async function main() {
  log(colors.bright + colors.green, '[POST-EXEC]', '═══════════════════════════════════════════');
  log(colors.bright + colors.green, '[POST-EXEC]', 'Post-Execution Processing Started');
  log(colors.bright + colors.green, '[POST-EXEC]', '═══════════════════════════════════════════');
  console.log('');

  try {
    const results = await collectExecutionResults();
    const learnings = await consolidateLearnings(results);
    const memoryBank = await updateMemoryBank(learnings);
    const reportPath = await generateOptimizationReport(learnings, memoryBank);

    console.log('');
    log(colors.bright + colors.green, '[POST-EXEC]', '═══════════════════════════════════════════');
    log(colors.bright + colors.green, '[POST-EXEC]', '✓ Post-Execution Processing Complete');
    log(colors.bright + colors.green, '[POST-EXEC]', '═══════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (error) {
    log(colors.red, '[POST-EXEC]', `✗ Processing failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main().catch(err => {
  log(colors.red, '[POST-EXEC]', `Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Swarm Orchestrator for Agentic Robotics Deep Review
 * Spawns multiple agentic-flow agents to review different aspects in parallel
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load configuration
const config = JSON.parse(readFileSync('./swarm-review-config.json', 'utf8'));

// Create output directory
const outputDir = './swarm-reviews';
try {
  mkdirSync(outputDir, { recursive: true });
} catch (e) {
  // Directory exists
}

// Color output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

// Agent spawner
function spawnAgent(group, index) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    log(colors.cyan, `[SWARM ${index}]`, `Starting ${group.group} review...`);

    // Build comprehensive review task
    const task = `
You are a specialized code reviewer for robotics systems.

REVIEW GROUP: ${group.group}
DESCRIPTION: ${group.description}

TARGET DIRECTORIES:
${group.targets.map(t => `  - ${t}`).join('\n')}

FOCUS AREAS:
${group.focus.map(f => `  • ${f}`).join('\n')}

INSTRUCTIONS:
1. Analyze all files in the target directories
2. Review code quality, architecture, and implementation
3. Identify bugs, performance issues, security vulnerabilities
4. Check for best practices in Rust and TypeScript
5. Evaluate test coverage and quality
6. Provide specific recommendations with file:line references

OUTPUT FORMAT:
# ${group.group.toUpperCase()} REVIEW REPORT

## Summary
[Brief overview of findings]

## Critical Issues
[Issues that must be fixed - with file:line references]

## Warnings
[Issues that should be fixed - with file:line references]

## Recommendations
[Suggestions for improvement]

## Code Quality Score
[Rate 1-10 with justification]

## Specific Findings
[Detailed findings with code snippets where relevant]

Please be thorough and specific. Reference exact file paths and line numbers.
`;

    // Spawn agentic-flow agent
    const agent = spawn('npx', [
      'agentic-flow',
      '--agent', 'code-reviewer',
      '--task', task,
      '--model', config.swarm_review.model,
      '--provider', config.swarm_review.provider,
      '--output', 'md',
      '--stream'
    ], {
      env: {
        ...process.env,
        USE_OPENROUTER: 'true',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'sk-or-v1-placeholder'
      },
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    agent.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(`${colors.blue}[${group.group}]${colors.reset} ${text}`);
    });

    agent.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(`${colors.yellow}[${group.group}-err]${colors.reset} ${text}`);
    });

    agent.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (code === 0) {
        log(colors.green, `[SWARM ${index}]`, `✓ Completed ${group.group} in ${duration}s`);

        // Save output
        const outputPath = join(outputDir, `${group.group}-review.md`);
        writeFileSync(outputPath, output);
        log(colors.green, `[SWARM ${index}]`, `Report saved to ${outputPath}`);

        resolve({
          group: group.group,
          success: true,
          duration,
          output,
          outputPath
        });
      } else {
        log(colors.red, `[SWARM ${index}]`, `✗ Failed ${group.group} (exit code ${code})`);

        // Save error output
        const errorPath = join(outputDir, `${group.group}-error.log`);
        writeFileSync(errorPath, errorOutput);

        resolve({
          group: group.group,
          success: false,
          duration,
          error: errorOutput,
          errorPath
        });
      }
    });

    agent.on('error', (err) => {
      log(colors.red, `[SWARM ${index}]`, `Error spawning agent: ${err.message}`);
      reject(err);
    });
  });
}

// Main orchestrator
async function main() {
  log(colors.bright + colors.green, '[ORCHESTRATOR]', 'Starting swarm-based deep review of agentic-robotics');
  log(colors.bright, '[CONFIG]', `Model: ${config.swarm_review.model}`);
  log(colors.bright, '[CONFIG]', `Provider: ${config.swarm_review.provider}`);
  log(colors.bright, '[CONFIG]', `Review Groups: ${config.swarm_review.review_groups.length}`);
  console.log('');

  const startTime = Date.now();

  // Spawn all agents in parallel
  log(colors.cyan, '[ORCHESTRATOR]', 'Spawning swarm agents in parallel...');

  const results = await Promise.all(
    config.swarm_review.review_groups.map((group, index) =>
      spawnAgent(group, index + 1)
    )
  );

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('');
  log(colors.bright + colors.green, '[ORCHESTRATOR]', '═══════════════════════════════════════════');
  log(colors.bright + colors.green, '[ORCHESTRATOR]', 'SWARM REVIEW COMPLETE');
  log(colors.bright + colors.green, '[ORCHESTRATOR]', '═══════════════════════════════════════════');
  console.log('');

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  log(colors.bright, '[SUMMARY]', `Total Duration: ${totalDuration}s`);
  log(colors.green, '[SUMMARY]', `Successful Reviews: ${successful}`);
  if (failed > 0) {
    log(colors.red, '[SUMMARY]', `Failed Reviews: ${failed}`);
  }
  console.log('');

  // Generate consolidated report
  const consolidatedReport = generateConsolidatedReport(results);
  const reportPath = join(outputDir, 'CONSOLIDATED-REVIEW-REPORT.md');
  writeFileSync(reportPath, consolidatedReport);

  log(colors.bright + colors.cyan, '[ORCHESTRATOR]', `Consolidated report: ${reportPath}`);
  console.log('');

  // Display summary of findings
  displaySummary(results);

  process.exit(failed > 0 ? 1 : 0);
}

function generateConsolidatedReport(results) {
  let report = `# Agentic Robotics - Consolidated Swarm Review Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Model: ${config.swarm_review.model}\n`;
  report += `Provider: ${config.swarm_review.provider}\n\n`;
  report += `---\n\n`;

  report += `## Executive Summary\n\n`;

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  report += `- Total Review Groups: ${results.length}\n`;
  report += `- Successful Reviews: ${successful.length}\n`;
  report += `- Failed Reviews: ${failed.length}\n`;
  report += `- Total Duration: ${results.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2)}s\n\n`;

  report += `---\n\n`;

  // Add each group's report
  for (const result of results) {
    report += `## ${result.group.toUpperCase()} Review\n\n`;

    if (result.success) {
      report += `**Status:** ✓ Success\n`;
      report += `**Duration:** ${result.duration}s\n`;
      report += `**Report:** [${result.outputPath}](${result.outputPath})\n\n`;
      report += `### Findings\n\n`;
      report += result.output || '_No output captured_';
      report += `\n\n---\n\n`;
    } else {
      report += `**Status:** ✗ Failed\n`;
      report += `**Duration:** ${result.duration}s\n`;
      report += `**Error Log:** [${result.errorPath}](${result.errorPath})\n\n`;
      report += `### Error\n\n\`\`\`\n${result.error}\n\`\`\`\n\n---\n\n`;
    }
  }

  report += `## Next Steps\n\n`;
  report += `1. Review individual group reports in \`swarm-reviews/\` directory\n`;
  report += `2. Address critical issues identified across all groups\n`;
  report += `3. Implement recommended improvements\n`;
  report += `4. Re-run tests to verify fixes\n`;
  report += `5. Update documentation based on findings\n\n`;

  return report;
}

function displaySummary(results) {
  log(colors.bright, '[FINDINGS]', 'Review Groups Summary:');
  console.log('');

  for (const result of results) {
    const status = result.success ?
      `${colors.green}✓ PASS${colors.reset}` :
      `${colors.red}✗ FAIL${colors.reset}`;

    console.log(`  ${status} ${colors.cyan}${result.group.padEnd(25)}${colors.reset} (${result.duration}s)`);
  }
  console.log('');
}

// Run
main().catch(err => {
  log(colors.red, '[ERROR]', err.message);
  console.error(err);
  process.exit(1);
});

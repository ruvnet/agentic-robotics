#!/usr/bin/env node
/**
 * Master Orchestrator
 * Integrates all self-learning components with comprehensive validation and optimization
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color: string, prefix: string, message: string): void {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

interface OrchestrationPhase {
  name: string;
  command: string;
  args: string[];
  critical: boolean;
  validate?: boolean;
}

class MasterOrchestrator {
  private sessionId: string;
  private startTime: number = 0;
  private phases: OrchestrationPhase[] = [];
  private results: Map<string, any> = new Map();

  constructor() {
    this.sessionId = `master-${Date.now()}`;
    this.ensureDirectories();
    this.definePhases();
  }

  private ensureDirectories(): void {
    const dirs = [
      './examples/data',
      './examples/data/orchestration'
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private definePhases(): void {
    this.phases = [
      {
        name: 'Pre-Execution Validation',
        command: 'node',
        args: ['.claude/hooks/pre-execution.js'],
        critical: true,
        validate: false
      },
      {
        name: 'Initial Metrics Validation',
        command: 'tsx',
        args: ['examples/self-learning/metrics-validator.ts'],
        critical: true,
        validate: false
      },
      {
        name: 'Benchmark Optimization',
        command: 'tsx',
        args: ['examples/self-learning/benchmark-optimizer.ts', '12', '8'],
        critical: false,
        validate: true
      },
      {
        name: 'Self-Improving Navigation',
        command: 'tsx',
        args: ['examples/self-learning/self-improving-navigator.ts', '15'],
        critical: false,
        validate: true
      },
      {
        name: 'Swarm Orchestration',
        command: 'tsx',
        args: ['examples/self-learning/swarm-orchestrator.ts', 'navigation', '6'],
        critical: false,
        validate: true
      },
      {
        name: 'Parallel Swarm Execution',
        command: 'tsx',
        args: ['examples/self-learning/parallel-swarm-executor.ts', '6'],
        critical: false,
        validate: true
      },
      {
        name: 'Post-Execution Processing',
        command: 'node',
        args: ['.claude/hooks/post-execution.js'],
        critical: false,
        validate: false
      },
      {
        name: 'Optimization Loop',
        command: 'node',
        args: ['.claude/hooks/optimization-loop.js'],
        critical: false,
        validate: false
      },
      {
        name: 'Final Metrics Validation',
        command: 'tsx',
        args: ['examples/self-learning/metrics-validator.ts'],
        critical: false,
        validate: false
      }
    ];
  }

  private async executePhase(phase: OrchestrationPhase): Promise<any> {
    return new Promise((resolve, reject) => {
      log(colors.bright + colors.cyan, '[PHASE]', `Starting: ${phase.name}`);

      const startTime = Date.now();
      const process = spawn(phase.command, phase.args, {
        env: {
          ...process.env,
          ORCHESTRATION_SESSION: this.sessionId
        },
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      process.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });

      process.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
      });

      process.on('close', (code) => {
        const duration = Date.now() - startTime;

        const result = {
          phase: phase.name,
          exitCode: code,
          duration,
          success: code === 0,
          output,
          error: errorOutput
        };

        if (code === 0) {
          log(colors.green, '[PHASE]', `✓ Completed: ${phase.name} (${(duration / 1000).toFixed(2)}s)`);
          resolve(result);
        } else {
          log(colors.red, '[PHASE]', `✗ Failed: ${phase.name} (exit code ${code})`);

          if (phase.critical) {
            reject(new Error(`Critical phase failed: ${phase.name}`));
          } else {
            log(colors.yellow, '[PHASE]', `⚠ Non-critical phase failed, continuing...`);
            resolve(result);
          }
        }
      });

      process.on('error', (error) => {
        log(colors.red, '[PHASE]', `✗ Error: ${phase.name} - ${error.message}`);

        if (phase.critical) {
          reject(error);
        } else {
          resolve({
            phase: phase.name,
            success: false,
            error: error.message
          });
        }
      });
    });
  }

  private async validateBetweenPhases(): Promise<void> {
    log(colors.cyan, '[VALIDATE]', 'Running inter-phase validation...');

    // Check memory bank integrity
    const memoryBankPath = './examples/data/memory-bank.json';
    if (existsSync(memoryBankPath)) {
      try {
        const memoryBank = JSON.parse(readFileSync(memoryBankPath, 'utf8'));
        log(colors.green, '[VALIDATE]', `✓ Memory bank integrity OK (${memoryBank.totalSessions} sessions)`);
      } catch (error: any) {
        log(colors.yellow, '[VALIDATE]', `⚠ Memory bank validation warning: ${error.message}`);
      }
    }

    // Check metrics consistency
    const metricsPath = './examples/data/metrics';
    if (existsSync(metricsPath)) {
      log(colors.green, '[VALIDATE]', '✓ Metrics directory accessible');
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private generateFinalReport(): string {
    const successfulPhases = Array.from(this.results.values()).filter(r => r.success);
    const failedPhases = Array.from(this.results.values()).filter(r => !r.success);

    const totalDuration = Date.now() - this.startTime;

    let report = `# Master Orchestration Report\n\n`;
    report += `**Session**: ${this.sessionId}\n`;
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Total Duration**: ${(totalDuration / 1000).toFixed(2)}s\n\n`;

    report += `## Summary\n\n`;
    report += `- **Total Phases**: ${this.phases.length}\n`;
    report += `- **Successful**: ${successfulPhases.length}\n`;
    report += `- **Failed**: ${failedPhases.length}\n`;
    report += `- **Success Rate**: ${((successfulPhases.length / this.phases.length) * 100).toFixed(1)}%\n\n`;

    report += `## Phase Results\n\n`;

    for (const phase of this.phases) {
      const result = this.results.get(phase.name);
      if (result) {
        const icon = result.success ? '✓' : '✗';
        const status = result.success ? 'SUCCESS' : 'FAILED';
        report += `### ${icon} ${phase.name}\n\n`;
        report += `- **Status**: ${status}\n`;
        report += `- **Duration**: ${(result.duration / 1000).toFixed(2)}s\n`;
        report += `- **Critical**: ${phase.critical ? 'Yes' : 'No'}\n`;

        if (!result.success && result.error) {
          report += `- **Error**: ${result.error.substring(0, 200)}...\n`;
        }

        report += `\n`;
      }
    }

    report += `## Performance Insights\n\n`;

    const phaseDurations = Array.from(this.results.values())
      .filter(r => r.success && r.duration)
      .map(r => r.duration);

    if (phaseDurations.length > 0) {
      const avgDuration = phaseDurations.reduce((a, b) => a + b, 0) / phaseDurations.length;
      const maxDuration = Math.max(...phaseDurations);
      const minDuration = Math.min(...phaseDurations);

      report += `- **Average Phase Duration**: ${(avgDuration / 1000).toFixed(2)}s\n`;
      report += `- **Longest Phase**: ${(maxDuration / 1000).toFixed(2)}s\n`;
      report += `- **Shortest Phase**: ${(minDuration / 1000).toFixed(2)}s\n\n`;
    }

    report += `## Memory Bank Status\n\n`;

    try {
      const memoryBankPath = './examples/data/memory-bank.json';
      if (existsSync(memoryBankPath)) {
        const memoryBank = JSON.parse(readFileSync(memoryBankPath, 'utf8'));
        report += `- **Total Sessions**: ${memoryBank.totalSessions}\n`;
        report += `- **Learning Entries**: ${memoryBank.learnings.length}\n`;
        report += `- **Last Updated**: ${memoryBank.lastUpdated}\n\n`;
      }
    } catch (error) {
      report += `- Memory bank not available\n\n`;
    }

    report += `## Recommendations\n\n`;

    if (failedPhases.length > 0) {
      report += `- Review failed phases and address errors\n`;
    }

    if (successfulPhases.length === this.phases.length) {
      report += `- All phases completed successfully\n`;
      report += `- System ready for production use\n`;
      report += `- Consider increasing swarm sizes for better optimization\n`;
    }

    report += `\n---\n*Generated by Master Orchestrator*\n`;

    return report;
  }

  private saveResults(): void {
    const resultsPath = join('./examples/data/orchestration', `${this.sessionId}.json`);
    const reportPath = join('./examples/data/orchestration', `${this.sessionId}.md`);

    // Save JSON results
    const resultsData = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      phases: Array.from(this.results.entries()).map(([name, result]) => ({
        name,
        ...result
      }))
    };

    writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));

    // Save markdown report
    const report = this.generateFinalReport();
    writeFileSync(reportPath, report);

    log(colors.green, '[MASTER]', `✓ Results saved: ${resultsPath}`);
    log(colors.green, '[MASTER]', `✓ Report saved: ${reportPath}`);
  }

  async orchestrate(): Promise<void> {
    log(colors.bright + colors.magenta, '[MASTER]', '═══════════════════════════════════════════');
    log(colors.bright + colors.magenta, '[MASTER]', 'Master Orchestrator');
    log(colors.bright + colors.magenta, '[MASTER]', 'Self-Learning Optimization System');
    log(colors.bright + colors.magenta, '[MASTER]', '═══════════════════════════════════════════');
    console.log('');

    this.startTime = Date.now();

    try {
      for (let i = 0; i < this.phases.length; i++) {
        const phase = this.phases[i];

        log(colors.bright + colors.blue, '[MASTER]', `Phase ${i + 1}/${this.phases.length}: ${phase.name}`);
        console.log('');

        const result = await this.executePhase(phase);
        this.results.set(phase.name, result);

        console.log('');

        // Validate between phases if required
        if (phase.validate) {
          await this.validateBetweenPhases();
          console.log('');
        }
      }

      // Save final results
      this.saveResults();

      // Print summary
      const successCount = Array.from(this.results.values()).filter(r => r.success).length;
      const totalDuration = Date.now() - this.startTime;

      console.log('');
      log(colors.bright + colors.magenta, '[MASTER]', '═══════════════════════════════════════════');
      log(colors.bright + colors.magenta, '[MASTER]', '✓ Orchestration Complete');
      log(colors.bright + colors.magenta, '[MASTER]', '═══════════════════════════════════════════');
      log(colors.green, '[MASTER]', `Phases Completed: ${successCount}/${this.phases.length}`);
      log(colors.green, '[MASTER]', `Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
      log(colors.green, '[MASTER]', `Success Rate: ${((successCount / this.phases.length) * 100).toFixed(1)}%`);
      console.log('');

    } catch (error: any) {
      log(colors.red, '[MASTER]', `✗ Critical error: ${error.message}`);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const orchestrator = new MasterOrchestrator();
  await orchestrator.orchestrate();

  process.exit(0);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { MasterOrchestrator };

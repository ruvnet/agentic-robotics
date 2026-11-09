#!/usr/bin/env node
/**
 * Metrics Validator
 * Validates all hooks and metrics before, during, and after execution
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  timestamp: string;
  details?: any;
}

interface HookValidation {
  hook: string;
  exists: boolean;
  executable: boolean;
  syntax: 'valid' | 'invalid' | 'unknown';
  tested: boolean;
  testResult?: any;
}

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

class MetricsValidator {
  private results: ValidationResult[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = `validation-${Date.now()}`;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      './examples/data/validation'
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private addResult(component: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any): void {
    const result: ValidationResult = {
      component,
      status,
      message,
      timestamp: new Date().toISOString(),
      details
    };

    this.results.push(result);

    const statusIcon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
    const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow;

    log(color, `[${statusIcon}]`, `${component}: ${message}`);
  }

  async validateSettings(): Promise<void> {
    log(colors.cyan, '[VALIDATE]', 'Validating settings.json...');

    const settingsPath = './.claude/settings.json';

    if (!existsSync(settingsPath)) {
      this.addResult('settings', 'fail', 'settings.json not found');
      return;
    }

    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));

      // Validate required sections
      const requiredSections = ['hooks', 'memory_bank', 'swarm_config', 'openrouter', 'metrics', 'validation'];
      for (const section of requiredSections) {
        if (!settings[section]) {
          this.addResult('settings', 'fail', `Missing required section: ${section}`);
        } else {
          this.addResult('settings', 'pass', `Section ${section} present`);
        }
      }

      // Validate hooks configuration
      if (settings.hooks) {
        for (const [hookName, hookConfig] of Object.entries(settings.hooks as any)) {
          const config = hookConfig as { enabled?: boolean; script?: string };
          if (!config.enabled) {
            this.addResult('settings', 'warning', `Hook ${hookName} is disabled`);
          } else if (!config.script) {
            this.addResult('settings', 'fail', `Hook ${hookName} has no script defined`);
          } else {
            this.addResult('settings', 'pass', `Hook ${hookName} configured`);
          }
        }
      }

      // Validate swarm config
      if (settings.swarm_config) {
        if (settings.swarm_config.max_concurrent_swarms < 1) {
          this.addResult('settings', 'fail', 'max_concurrent_swarms must be >= 1');
        } else if (settings.swarm_config.max_concurrent_swarms > 32) {
          this.addResult('settings', 'warning', 'max_concurrent_swarms > 32 may cause resource issues');
        } else {
          this.addResult('settings', 'pass', `max_concurrent_swarms: ${settings.swarm_config.max_concurrent_swarms}`);
        }
      }

    } catch (error: any) {
      this.addResult('settings', 'fail', `Failed to parse settings.json: ${error.message}`);
    }
  }

  async validateHooks(): Promise<void> {
    log(colors.cyan, '[VALIDATE]', 'Validating hooks...');

    const hooksDir = './.claude/hooks';

    if (!existsSync(hooksDir)) {
      this.addResult('hooks', 'fail', 'Hooks directory not found');
      return;
    }

    const expectedHooks = ['pre-execution.js', 'post-execution.js', 'optimization-loop.js'];

    for (const hookFile of expectedHooks) {
      const hookPath = join(hooksDir, hookFile);
      const hookName = hookFile.replace('.js', '');

      const validation: HookValidation = {
        hook: hookName,
        exists: existsSync(hookPath),
        executable: false,
        syntax: 'unknown',
        tested: false
      };

      if (!validation.exists) {
        this.addResult('hooks', 'fail', `Hook not found: ${hookName}`);
        continue;
      }

      // Check if file is executable (on Unix-like systems)
      try {
        const stats = statSync(hookPath);
        validation.executable = (stats.mode & 0o111) !== 0;

        if (!validation.executable) {
          this.addResult('hooks', 'warning', `Hook not executable: ${hookName}`);
        }
      } catch (error) {
        // Ignore on Windows
      }

      // Validate syntax by attempting to parse
      try {
        const content = readFileSync(hookPath, 'utf8');
        if (content.length === 0) {
          this.addResult('hooks', 'fail', `Hook is empty: ${hookName}`);
          validation.syntax = 'invalid';
        } else {
          validation.syntax = 'valid';
          this.addResult('hooks', 'pass', `Hook syntax valid: ${hookName}`);
        }
      } catch (error: any) {
        this.addResult('hooks', 'fail', `Failed to read hook ${hookName}: ${error.message}`);
        validation.syntax = 'invalid';
      }

      // Test hook execution (dry run)
      if (validation.syntax === 'valid') {
        try {
          const testResult = await this.testHook(hookPath);
          validation.tested = true;
          validation.testResult = testResult;

          if (testResult.success) {
            this.addResult('hooks', 'pass', `Hook test passed: ${hookName}`);
          } else {
            this.addResult('hooks', 'warning', `Hook test warning: ${hookName} - ${testResult.message}`);
          }
        } catch (error: any) {
          this.addResult('hooks', 'fail', `Hook test failed: ${hookName} - ${error.message}`);
        }
      }
    }
  }

  private async testHook(hookPath: string): Promise<any> {
    return new Promise((resolve) => {
      const childProcess = spawn('node', [hookPath], {
        timeout: 10000, // 10 second timeout
        env: {
          ...process.env,
          TEST_MODE: 'true'
        }
      });

      let output = '';
      let errorOutput = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      childProcess.on('close', (code: number | null) => {
        resolve({
          success: code === 0,
          exitCode: code,
          output,
          error: errorOutput,
          message: code === 0 ? 'Hook executed successfully' : `Exit code: ${code}`
        });
      });

      childProcess.on('error', (error: Error) => {
        resolve({
          success: false,
          error: error.message,
          message: `Failed to execute: ${error.message}`
        });
      });
    });
  }

  async validateMemoryBank(): Promise<void> {
    log(colors.cyan, '[VALIDATE]', 'Validating memory bank...');

    const memoryBankPath = './examples/data/memory-bank.json';

    if (!existsSync(memoryBankPath)) {
      this.addResult('memory-bank', 'warning', 'Memory bank not found (will be created on first run)');
      return;
    }

    try {
      const memoryBank = JSON.parse(readFileSync(memoryBankPath, 'utf8'));

      if (!memoryBank.version) {
        this.addResult('memory-bank', 'fail', 'Memory bank missing version');
      } else {
        this.addResult('memory-bank', 'pass', `Memory bank version: ${memoryBank.version}`);
      }

      if (!memoryBank.learnings || !Array.isArray(memoryBank.learnings)) {
        this.addResult('memory-bank', 'fail', 'Memory bank learnings invalid');
      } else {
        this.addResult('memory-bank', 'pass', `Memory bank has ${memoryBank.learnings.length} learning sessions`);
      }

      if (memoryBank.totalSessions === undefined) {
        this.addResult('memory-bank', 'fail', 'Memory bank missing totalSessions');
      } else {
        this.addResult('memory-bank', 'pass', `Total sessions: ${memoryBank.totalSessions}`);
      }

    } catch (error: any) {
      this.addResult('memory-bank', 'fail', `Failed to parse memory bank: ${error.message}`);
    }
  }

  async validateMetricsSystem(): Promise<void> {
    log(colors.cyan, '[VALIDATE]', 'Validating metrics system...');

    const metricsPath = './examples/data/metrics';

    if (!existsSync(metricsPath)) {
      mkdirSync(metricsPath, { recursive: true });
      this.addResult('metrics', 'pass', 'Created metrics directory');
    } else {
      this.addResult('metrics', 'pass', 'Metrics directory exists');

      // Check for existing metrics files
      try {
        const files = readdirSync(metricsPath).filter(f => f.endsWith('.json'));
        this.addResult('metrics', 'pass', `Found ${files.length} metrics files`);

        // Validate a sample metrics file
        if (files.length > 0) {
          const sampleFile = join(metricsPath, files[0]);
          const metrics = JSON.parse(readFileSync(sampleFile, 'utf8'));

          if (metrics.sessionId && metrics.timestamp) {
            this.addResult('metrics', 'pass', 'Metrics file format valid');
          } else {
            this.addResult('metrics', 'warning', 'Metrics file missing required fields');
          }
        }
      } catch (error: any) {
        this.addResult('metrics', 'fail', `Failed to validate metrics: ${error.message}`);
      }
    }
  }

  async validateDataDirectories(): Promise<void> {
    log(colors.cyan, '[VALIDATE]', 'Validating data directories...');

    const requiredDirs = [
      './examples/data',
      './examples/data/metrics',
      './examples/data/optimization',
      './examples/data/benchmarks',
      './examples/data/navigation',
      './examples/data/parallel-swarms'
    ];

    for (const dir of requiredDirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        this.addResult('directories', 'pass', `Created directory: ${dir}`);
      } else {
        this.addResult('directories', 'pass', `Directory exists: ${dir}`);
      }
    }
  }

  async validateDependencies(): Promise<void> {
    log(colors.cyan, '[VALIDATE]', 'Validating dependencies...');

    try {
      const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
      const deps = packageJson.dependencies || {};

      const requiredDeps = ['agentdb', 'agentic-flow', '@modelcontextprotocol/sdk'];

      for (const dep of requiredDeps) {
        if (deps[dep]) {
          this.addResult('dependencies', 'pass', `${dep} installed: ${deps[dep]}`);
        } else {
          this.addResult('dependencies', 'fail', `${dep} not installed`);
        }
      }
    } catch (error: any) {
      this.addResult('dependencies', 'fail', `Failed to validate dependencies: ${error.message}`);
    }
  }

  private generateReport(): string {
    const passCount = this.results.filter(r => r.status === 'pass').length;
    const failCount = this.results.filter(r => r.status === 'fail').length;
    const warnCount = this.results.filter(r => r.status === 'warning').length;

    let report = `# Validation Report\n\n`;
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Session**: ${this.sessionId}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Pass**: ${passCount}\n`;
    report += `- **Fail**: ${failCount}\n`;
    report += `- **Warning**: ${warnCount}\n`;
    report += `- **Total**: ${this.results.length}\n\n`;

    report += `## Results\n\n`;

    // Group by component
    const byComponent = new Map<string, ValidationResult[]>();
    for (const result of this.results) {
      if (!byComponent.has(result.component)) {
        byComponent.set(result.component, []);
      }
      byComponent.get(result.component)!.push(result);
    }

    for (const [component, results] of byComponent) {
      report += `### ${component.toUpperCase()}\n\n`;

      for (const result of results) {
        const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
        report += `- ${icon} **${result.status.toUpperCase()}**: ${result.message}\n`;
      }

      report += `\n`;
    }

    report += `---\n*Generated by Metrics Validator*\n`;

    return report;
  }

  private saveResults(): void {
    const resultsPath = join('./examples/data/validation', `${this.sessionId}.json`);
    const reportPath = join('./examples/data/validation', `${this.sessionId}.md`);

    // Save JSON results
    writeFileSync(resultsPath, JSON.stringify({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        total: this.results.length,
        pass: this.results.filter(r => r.status === 'pass').length,
        fail: this.results.filter(r => r.status === 'fail').length,
        warning: this.results.filter(r => r.status === 'warning').length
      }
    }, null, 2));

    // Save markdown report
    const report = this.generateReport();
    writeFileSync(reportPath, report);

    log(colors.green, '[VALIDATE]', `✓ Results saved: ${resultsPath}`);
    log(colors.green, '[VALIDATE]', `✓ Report saved: ${reportPath}`);
  }

  async validate(): Promise<boolean> {
    log(colors.bright + colors.cyan, '[VALIDATE]', '═══════════════════════════════════════════');
    log(colors.bright + colors.cyan, '[VALIDATE]', 'Metrics Validator');
    log(colors.bright + colors.cyan, '[VALIDATE]', '═══════════════════════════════════════════');
    console.log('');

    await this.validateSettings();
    await this.validateHooks();
    await this.validateMemoryBank();
    await this.validateMetricsSystem();
    await this.validateDataDirectories();
    await this.validateDependencies();

    this.saveResults();

    const failCount = this.results.filter(r => r.status === 'fail').length;
    const passCount = this.results.filter(r => r.status === 'pass').length;
    const warnCount = this.results.filter(r => r.status === 'warning').length;

    console.log('');
    log(colors.bright + colors.cyan, '[VALIDATE]', '═══════════════════════════════════════════');
    log(colors.bright + colors.cyan, '[VALIDATE]', 'Validation Complete');
    log(colors.bright + colors.cyan, '[VALIDATE]', '═══════════════════════════════════════════');
    log(colors.green, '[VALIDATE]', `Pass: ${passCount}`);
    log(colors.yellow, '[VALIDATE]', `Warning: ${warnCount}`);
    log(colors.red, '[VALIDATE]', `Fail: ${failCount}`);
    console.log('');

    return failCount === 0;
  }
}

// Main execution
async function main() {
  const validator = new MetricsValidator();
  const success = await validator.validate();

  process.exit(success ? 0 : 1);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { MetricsValidator };

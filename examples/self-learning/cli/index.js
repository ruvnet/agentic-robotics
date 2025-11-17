#!/usr/bin/env node
/**
 * Agentic Learning CLI
 * Main command-line interface for self-learning optimization system
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

// Version and description
program
  .name('agentic-learn')
  .description('Self-learning optimization system for robotic agents')
  .version('1.0.0');

// Validate command
program
  .command('validate')
  .description('Validate system configuration and hooks')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const spinner = ora('Running validation checks...').start();

    try {
      await runScript('metrics-validator.ts', [], options.verbose);
      spinner.succeed(chalk.green('Validation complete'));
    } catch (error) {
      spinner.fail(chalk.red('Validation failed'));
      console.error(error.message);
      process.exit(1);
    }
  });

// Optimize command
program
  .command('optimize')
  .description('Run optimization with benchmark swarms')
  .option('-s, --swarm-size <number>', 'Number of swarm agents', '12')
  .option('-i, --iterations <number>', 'Number of iterations', '10')
  .option('-t, --type <type>', 'Optimization type (benchmark|navigation|swarm)', 'benchmark')
  .action(async (options) => {
    const spinner = ora(`Starting ${options.type} optimization...`).start();

    try {
      let script, args;

      switch (options.type) {
        case 'benchmark':
          script = 'benchmark-optimizer.ts';
          args = [options.swarmSize, options.iterations];
          break;
        case 'navigation':
          script = 'self-improving-navigator.ts';
          args = [options.swarmSize];
          break;
        case 'swarm':
          script = 'swarm-orchestrator.ts';
          args = ['navigation', options.swarmSize];
          break;
        default:
          throw new Error(`Unknown optimization type: ${options.type}`);
      }

      spinner.text = `Running ${options.type} optimization...`;
      await runScript(script, args, true);
      spinner.succeed(chalk.green('Optimization complete'));
    } catch (error) {
      spinner.fail(chalk.red('Optimization failed'));
      console.error(error.message);
      process.exit(1);
    }
  });

// Parallel command
program
  .command('parallel')
  .description('Execute multiple tasks in parallel')
  .option('-c, --concurrent <number>', 'Max concurrent tasks', '8')
  .action(async (options) => {
    const spinner = ora('Starting parallel execution...').start();

    try {
      await runScript('parallel-swarm-executor.ts', [options.concurrent], true);
      spinner.succeed(chalk.green('Parallel execution complete'));
    } catch (error) {
      spinner.fail(chalk.red('Parallel execution failed'));
      console.error(error.message);
      process.exit(1);
    }
  });

// Orchestrate command
program
  .command('orchestrate')
  .description('Run full master orchestration pipeline')
  .action(async () => {
    console.log(chalk.bold.cyan('\n🚀 Master Orchestration\n'));
    console.log(chalk.yellow('This will run the complete optimization pipeline.'));
    console.log(chalk.yellow('Estimated time: 15+ minutes\n'));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Continue with full orchestration?',
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.gray('Operation cancelled'));
      return;
    }

    const spinner = ora('Running master orchestration...').start();

    try {
      await runScript('master-orchestrator.ts', [], true);
      spinner.succeed(chalk.green('Master orchestration complete'));
    } catch (error) {
      spinner.fail(chalk.red('Master orchestration failed'));
      console.error(error.message);
      process.exit(1);
    }
  });

// Interactive command
program
  .command('interactive')
  .alias('i')
  .description('Interactive mode with prompts')
  .action(async () => {
    console.log(chalk.bold.cyan('\n🤖 Agentic Learning - Interactive Mode\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🔍 Validate System', value: 'validate' },
          { name: '🎯 Run Benchmark Optimization', value: 'benchmark' },
          { name: '🧭 Run Navigation Optimization', value: 'navigation' },
          { name: '🌊 Run Swarm Orchestration', value: 'swarm' },
          { name: '⚡ Run Parallel Execution', value: 'parallel' },
          { name: '🎭 Run Full Orchestration', value: 'orchestrate' },
          { name: '📊 View Reports', value: 'reports' },
          { name: '❌ Exit', value: 'exit' },
        ],
      },
    ]);

    if (answers.action === 'exit') {
      console.log(chalk.gray('\nGoodbye! 👋\n'));
      return;
    }

    if (answers.action === 'reports') {
      showReports();
      return;
    }

    // Get additional parameters based on action
    let params = {};
    if (['benchmark', 'navigation', 'swarm'].includes(answers.action)) {
      params = await inquirer.prompt([
        {
          type: 'number',
          name: 'swarmSize',
          message: 'Swarm size:',
          default: answers.action === 'benchmark' ? 12 : 8,
        },
      ]);

      if (answers.action === 'benchmark') {
        const iterParams = await inquirer.prompt([
          {
            type: 'number',
            name: 'iterations',
            message: 'Number of iterations:',
            default: 10,
          },
        ]);
        params = { ...params, ...iterParams };
      }
    } else if (answers.action === 'parallel') {
      params = await inquirer.prompt([
        {
          type: 'number',
          name: 'concurrent',
          message: 'Max concurrent tasks:',
          default: 8,
        },
      ]);
    }

    // Execute the selected action
    await executeAction(answers.action, params);
  });

// Status command
program
  .command('status')
  .description('Show system status and recent results')
  .action(() => {
    console.log(chalk.bold.cyan('\n📊 System Status\n'));

    // Check memory bank
    const memoryBankPath = '../../data/memory-bank.json';
    if (existsSync(memoryBankPath)) {
      const memoryBank = JSON.parse(readFileSync(memoryBankPath, 'utf8'));
      console.log(chalk.green('✓ Memory Bank'));
      console.log(`  Sessions: ${memoryBank.totalSessions}`);
      console.log(`  Learnings: ${memoryBank.learnings.length}`);
      console.log(`  Last Updated: ${memoryBank.lastUpdated}`);
    } else {
      console.log(chalk.yellow('⚠ Memory Bank not initialized'));
    }

    console.log();

    // Check validation
    const validationDir = '../../data/validation';
    if (existsSync(validationDir)) {
      console.log(chalk.green('✓ Validation System'));
      console.log('  Recent validations available');
    }

    // Check settings
    const settingsPath = '../../../.claude/settings.json';
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
      console.log(chalk.green('✓ Configuration'));
      console.log(`  Max Concurrent Swarms: ${settings.swarm_config.max_concurrent_swarms}`);
      console.log(`  Exploration Rate: ${settings.swarm_config.exploration_rate}`);
    }

    console.log();
  });

// Helper functions
async function runScript(scriptName, args = [], showOutput = false) {
  const scriptPath = join(__dirname, '..', scriptName);

  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', scriptPath, ...args], {
      stdio: showOutput ? 'inherit' : 'pipe',
      cwd: join(__dirname, '..'),
    });

    let output = '';

    if (!showOutput) {
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        output += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function executeAction(action, params) {
  const spinner = ora('Processing...').start();

  try {
    switch (action) {
      case 'validate':
        await runScript('metrics-validator.ts', [], true);
        break;
      case 'benchmark':
        await runScript('benchmark-optimizer.ts', [params.swarmSize, params.iterations], true);
        break;
      case 'navigation':
        await runScript('self-improving-navigator.ts', [params.swarmSize], true);
        break;
      case 'swarm':
        await runScript('swarm-orchestrator.ts', ['navigation', params.swarmSize], true);
        break;
      case 'parallel':
        await runScript('parallel-swarm-executor.ts', [params.concurrent], true);
        break;
      case 'orchestrate':
        await runScript('master-orchestrator.ts', [], true);
        break;
    }

    spinner.succeed(chalk.green('Operation complete'));
  } catch (error) {
    spinner.fail(chalk.red('Operation failed'));
    console.error(error.message);
  }
}

function showReports() {
  console.log(chalk.bold.cyan('\n📊 Available Reports\n'));

  const dataPath = join(__dirname, '..', '..', 'data');

  const reportTypes = [
    { name: 'Benchmarks', path: 'benchmarks' },
    { name: 'Validation', path: 'validation' },
    { name: 'Navigation', path: 'navigation' },
    { name: 'Optimization', path: 'optimization' },
    { name: 'Orchestration', path: 'orchestration' },
  ];

  for (const type of reportTypes) {
    const fullPath = join(dataPath, type.path);
    if (existsSync(fullPath)) {
      console.log(chalk.green(`✓ ${type.name}`));
      console.log(chalk.gray(`  Location: ${fullPath}`));
    }
  }

  console.log();
}

// Parse arguments
program.parse();

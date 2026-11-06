#!/usr/bin/env node

const { program } = require('commander');
const { AgenticNode } = require('@agentic-robotics/core');
const readline = require('readline');

program
  .name('agentic-robotics')
  .description('CLI tools for agentic robotics framework with AI agent orchestration')
  .version(require('../package.json').version);

// Test command
program
  .command('test')
  .description('Test node creation and communication')
  .action(async () => {
    console.log('🤖 Testing Agentic Robotics Node...\n');

    try {
      const node = new AgenticNode('test-node');
      console.log('✅ Node created successfully');

      const publisher = await node.createPublisher('/test');
      console.log('✅ Publisher created');

      await publisher.publish(JSON.stringify({ message: 'Hello, World!', timestamp: Date.now() }));
      console.log('✅ Message published');

      const stats = publisher.getStats();
      console.log('📊 Stats:', stats);
      console.log('\n🎉 All tests passed!\n');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Info command
program
  .command('info')
  .description('Show framework information')
  .action(() => {
    console.log('🤖 Agentic Robotics Framework v0.2.2');
    console.log('📦 ROS3-compatible robotics middleware');
    console.log('⚡ High-performance native bindings');
    console.log('🌊 66 AI Agents + 213 MCP Tools via agentic-flow');
    console.log('🧠 AgentDB: 13,000x faster memory (5,725 ops/sec)');
    console.log('');
    console.log('Available commands:');
    console.log('  test      - Test node creation and communication');
    console.log('  info      - Show this information');
    console.log('  doctor    - Run comprehensive diagnostics');
    console.log('  dialog    - Interactive dialog mode with AI agents');
    console.log('  agents    - List available AI agents');
    console.log('');
    console.log('MCP Integration:');
    console.log('  Use @agentic-robotics/mcp for Claude Desktop integration');
    console.log('  npx @agentic-robotics/mcp to start MCP server');
    console.log('');
  });

// Doctor command - comprehensive diagnostics
program
  .command('doctor')
  .description('Run comprehensive system diagnostics')
  .option('-v, --verbose', 'Show detailed diagnostic information')
  .action(async (options) => {
    console.log('🏥 Running Agentic Robotics Doctor...\n');

    let issues = 0;
    let warnings = 0;

    // Check 1: Node.js version
    console.log('📋 Checking Node.js version...');
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion >= 14) {
      console.log(`   ✅ Node.js ${nodeVersion} (>= 14.0.0 required)\n`);
    } else {
      console.log(`   ❌ Node.js ${nodeVersion} is too old (>= 14.0.0 required)\n`);
      issues++;
    }

    // Check 2: Core package
    console.log('📋 Checking @agentic-robotics/core...');
    try {
      const core = require('@agentic-robotics/core');
      console.log('   ✅ Core package loaded');

      // Test node creation
      try {
        const testNode = new core.AgenticNode('doctor-test');
        console.log('   ✅ Node creation works');
        if (options.verbose) {
          console.log(`      Platform: ${process.platform} ${process.arch}`);
        }
      } catch (error) {
        console.log('   ⚠️  Node creation issue:', error.message);
        warnings++;
      }
      console.log('');
    } catch (error) {
      console.log('   ❌ Core package error:', error.message);
      console.log('');
      issues++;
    }

    // Check 3: Optional dependencies
    console.log('📋 Checking optional integrations...');

    // Check agentic-flow
    try {
      require.resolve('agentic-flow');
      console.log('   ✅ agentic-flow available (66 agents + 213 MCP tools)');
    } catch (e) {
      console.log('   ℹ️  agentic-flow not installed (optional)');
      if (options.verbose) {
        console.log('      Install: npm install agentic-flow');
      }
    }

    // Check AgentDB
    try {
      require.resolve('agentdb');
      console.log('   ✅ AgentDB available (13,000x faster memory)');
    } catch (e) {
      console.log('   ℹ️  AgentDB not installed (optional)');
      if (options.verbose) {
        console.log('      Install: npm install agentdb');
      }
    }

    // Check MCP server
    try {
      require.resolve('@agentic-robotics/mcp');
      console.log('   ✅ MCP server available');
    } catch (e) {
      console.log('   ℹ️  MCP server not installed (optional)');
      if (options.verbose) {
        console.log('      Install: npm install @agentic-robotics/mcp');
      }
    }
    console.log('');

    // Check 4: System resources
    console.log('📋 Checking system resources...');
    const freeMem = (require('os').freemem() / 1024 / 1024 / 1024).toFixed(2);
    const totalMem = (require('os').totalmem() / 1024 / 1024 / 1024).toFixed(2);
    console.log(`   💾 Memory: ${freeMem} GB free / ${totalMem} GB total`);

    const cpus = require('os').cpus().length;
    console.log(`   🖥️  CPUs: ${cpus} cores`);

    if (options.verbose) {
      console.log(`   🏠 Platform: ${process.platform}`);
      console.log(`   🏗️  Architecture: ${process.arch}`);
    }
    console.log('');

    // Check 5: Network connectivity (optional)
    if (options.verbose) {
      console.log('📋 Checking network connectivity...');
      try {
        const https = require('https');
        await new Promise((resolve, reject) => {
          const req = https.get('https://registry.npmjs.org/', (res) => {
            console.log(`   ✅ npm registry reachable (${res.statusCode})`);
            resolve();
          });
          req.on('error', (error) => {
            console.log('   ⚠️  npm registry unreachable:', error.message);
            warnings++;
            resolve();
          });
          req.setTimeout(5000, () => {
            req.destroy();
            console.log('   ⚠️  npm registry timeout');
            warnings++;
            resolve();
          });
        });
        console.log('');
      } catch (error) {
        console.log('   ⚠️  Network check failed:', error.message);
        console.log('');
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    if (issues === 0 && warnings === 0) {
      console.log('🎉 Doctor says: Everything looks good!');
    } else if (issues === 0) {
      console.log(`⚠️  Doctor found ${warnings} warning(s) but no critical issues`);
    } else {
      console.log(`❌ Doctor found ${issues} issue(s) and ${warnings} warning(s)`);
    }
    console.log('═══════════════════════════════════════════════════════\n');

    if (issues > 0) {
      process.exit(1);
    }
  });

// Agents command - list available agents
program
  .command('agents')
  .description('List available AI agents')
  .option('-c, --category <type>', 'Filter by category (core, swarm, flow)')
  .action((options) => {
    console.log('🤖 Available AI Agents\n');

    const showCategory = !options.category || options.category === 'core';
    const showSwarm = !options.category || options.category === 'swarm';
    const showFlow = !options.category || options.category === 'flow';

    if (showCategory) {
      console.log('📦 Core Robotics Agents:');
      console.log('   • AgenticNode       - Core node for pub/sub communication');
      console.log('   • AgenticPublisher  - High-performance message publisher');
      console.log('   • AgenticSubscriber - Message subscriber with callbacks');
      console.log('');
    }

    if (showSwarm) {
      console.log('🌊 Swarm Coordination (via agentic-flow integration):');
      console.log('   • hierarchical-coordinator - Queen-led hierarchical coordination');
      console.log('   • mesh-coordinator         - Peer-to-peer mesh network');
      console.log('   • adaptive-coordinator     - Dynamic topology switching');
      console.log('   • collective-intelligence  - Distributed cognitive processes');
      console.log('   • swarm-memory-manager     - Distributed memory coordination');
      console.log('');
    }

    if (showFlow) {
      console.log('🔧 Task Agents (66 total via agentic-flow):');
      console.log('   Development:');
      console.log('   • coder, reviewer, tester, planner, researcher');
      console.log('');
      console.log('   Specialized:');
      console.log('   • backend-dev, mobile-dev, ml-developer, system-architect');
      console.log('   • api-docs, cicd-engineer, production-validator');
      console.log('');
      console.log('   GitHub Integration:');
      console.log('   • pr-manager, code-review-swarm, issue-tracker');
      console.log('   • release-manager, workflow-automation, repo-architect');
      console.log('');
      console.log('   SPARC Methodology:');
      console.log('   • sparc-coord, specification, pseudocode, architecture, refinement');
      console.log('');
    }

    console.log('💡 Use "npx agentic-robotics dialog" for interactive mode');
    console.log('💡 See full list: https://www.npmjs.com/package/agentic-flow\n');
  });

// Dialog command - Interactive mode
program
  .command('dialog')
  .description('Interactive dialog mode with AI agents')
  .action(async () => {
    console.log('🤖 Welcome to Agentic Robotics Interactive Dialog\n');
    console.log('This mode allows you to interact with the robotics framework.');
    console.log('Type "help" for available commands or "exit" to quit.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'agentic> '
    });

    let node = null;
    let publisher = null;

    const showHelp = () => {
      console.log('\nAvailable commands:');
      console.log('  help          - Show this help message');
      console.log('  info          - Show framework information');
      console.log('  create <name> - Create a new node');
      console.log('  pub <topic>   - Create publisher on topic');
      console.log('  send <msg>    - Publish message');
      console.log('  stats         - Show publisher statistics');
      console.log('  status        - Show current session status');
      console.log('  agents        - List available AI agents');
      console.log('  clear         - Clear screen');
      console.log('  exit          - Exit dialog mode\n');
    };

    const showStatus = () => {
      console.log('\n📊 Current Status:');
      console.log(`   Node: ${node ? '✅ Created' : '❌ Not created'}`);
      console.log(`   Publisher: ${publisher ? '✅ Ready' : '❌ Not ready'}`);
      if (publisher) {
        const stats = publisher.getStats();
        console.log(`   Messages sent: ${stats.messages}`);
        console.log(`   Bytes sent: ${stats.bytes}`);
      }
      console.log('');
    };

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      const [command, ...args] = input.split(' ');

      try {
        switch (command.toLowerCase()) {
          case 'help':
            showHelp();
            break;

          case 'info':
            console.log('\n🤖 Agentic Robotics Framework v0.2.2');
            console.log('📦 ROS3-compatible robotics middleware');
            console.log('⚡ High-performance native bindings\n');
            break;

          case 'create':
            if (args.length === 0) {
              console.log('❌ Usage: create <node-name>\n');
            } else {
              const nodeName = args.join('-');
              node = new AgenticNode(nodeName);
              console.log(`✅ Node "${nodeName}" created successfully\n`);
            }
            break;

          case 'pub':
          case 'publish':
            if (!node) {
              console.log('❌ Create a node first using: create <name>\n');
            } else if (args.length === 0) {
              console.log('❌ Usage: pub <topic>\n');
            } else {
              const topic = args[0];
              publisher = await node.createPublisher(topic);
              console.log(`✅ Publisher created on topic: ${topic}\n`);
            }
            break;

          case 'send':
          case 'msg':
            if (!publisher) {
              console.log('❌ Create a publisher first using: pub <topic>\n');
            } else if (args.length === 0) {
              console.log('❌ Usage: send <message>\n');
            } else {
              const message = args.join(' ');
              await publisher.publish(JSON.stringify({
                message,
                timestamp: Date.now()
              }));
              console.log(`✅ Message sent: "${message}"\n`);
            }
            break;

          case 'stats':
            if (!publisher) {
              console.log('❌ No publisher available\n');
            } else {
              const stats = publisher.getStats();
              console.log('\n📊 Publisher Statistics:');
              console.log(`   Messages: ${stats.messages}`);
              console.log(`   Bytes: ${stats.bytes}\n`);
            }
            break;

          case 'status':
            showStatus();
            break;

          case 'agents':
            console.log('\n🤖 Quick Agent Overview:');
            console.log('   Core: AgenticNode, Publisher, Subscriber');
            console.log('   Flow: 66 AI agents via agentic-flow');
            console.log('   Use: agentic-robotics agents --help\n');
            break;

          case 'clear':
            console.clear();
            console.log('🤖 Agentic Robotics Interactive Dialog\n');
            break;

          case 'exit':
          case 'quit':
            console.log('\n👋 Goodbye!\n');
            rl.close();
            process.exit(0);
            break;

          case '':
            break;

          default:
            console.log(`❌ Unknown command: "${command}"`);
            console.log('   Type "help" for available commands\n');
        }
      } catch (error) {
        console.error(`❌ Error: ${error.message}\n`);
      }

      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\n👋 Goodbye!\n');
      process.exit(0);
    });
  });

program.parse();

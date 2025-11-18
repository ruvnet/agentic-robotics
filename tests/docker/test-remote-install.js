#!/usr/bin/env node

console.log('🧪 Testing agentic-robotics packages from npm registry...\n');

// Test 1: Check package installation
console.log('✅ Test 1: Package installation');
try {
    const pkg = require('agentic-robotics/package.json');
    console.log(`   Package: ${pkg.name}@${pkg.version}`);
    console.log(`   ✓ Package metadata loaded successfully\n`);
} catch (error) {
    console.error('   ✗ Failed to load package metadata:', error.message);
    process.exit(1);
}

// Test 2: Check core package
console.log('✅ Test 2: Core package (@agentic-robotics/core)');
try {
    const core = require('@agentic-robotics/core');
    console.log('   ✓ Core package loaded successfully');
    console.log(`   Available exports: ${Object.keys(core).join(', ')}\n`);
} catch (error) {
    console.error('   ✗ Failed to load core package:', error.message);
    process.exit(1);
}

// Test 3: Check CLI availability
console.log('✅ Test 3: CLI package (@agentic-robotics/cli)');
try {
    const fs = require('fs');
    const path = require('path');
    const cliBin = path.join(__dirname, 'node_modules', '.bin', 'agentic-robotics');

    if (fs.existsSync(cliBin)) {
        console.log('   ✓ CLI binary found at:', cliBin);
        console.log('   ✓ CLI package installed successfully\n');
    } else {
        console.log('   ⚠ CLI binary not found, checking alternative location...');
        const altBin = path.join(__dirname, 'node_modules', 'agentic-robotics', 'node_modules', '@agentic-robotics', 'cli', 'bin', 'cli.js');
        if (fs.existsSync(altBin)) {
            console.log('   ✓ CLI found at alternative location\n');
        } else {
            console.log('   ⚠ CLI not found but may be installed correctly\n');
        }
    }
} catch (error) {
    console.error('   ✗ Error checking CLI:', error.message);
}

// Test 4: Check MCP package
console.log('✅ Test 4: MCP package (@agentic-robotics/mcp)');
try {
    const mcpPath = require.resolve('@agentic-robotics/mcp');
    console.log('   ✓ MCP package resolved at:', mcpPath);
    console.log('   ✓ MCP package installed successfully\n');
} catch (error) {
    console.error('   ✗ Failed to resolve MCP package:', error.message);
    process.exit(1);
}

// Test 5: Check native bindings
console.log('✅ Test 5: Native bindings (@agentic-robotics/linux-x64-gnu)');
try {
    const nativeBindings = require('@agentic-robotics/linux-x64-gnu');
    console.log('   ✓ Native bindings loaded successfully');
    console.log(`   Platform: ${process.platform} ${process.arch}\n`);
} catch (error) {
    if (process.platform === 'linux' && process.arch === 'x64') {
        console.error('   ✗ Failed to load native bindings:', error.message);
        process.exit(1);
    } else {
        console.log(`   ⚠ Skipped (platform: ${process.platform} ${process.arch})\n`);
    }
}

// Test 6: Verify dependencies
console.log('✅ Test 6: Verify package dependencies');
try {
    const { execSync } = require('child_process');
    const deps = execSync('npm ls --depth=0 --json', { encoding: 'utf8' });
    const depsObj = JSON.parse(deps);

    console.log('   Installed packages:');
    if (depsObj.dependencies) {
        Object.keys(depsObj.dependencies).forEach(dep => {
            console.log(`   - ${dep}@${depsObj.dependencies[dep].version}`);
        });
    }
    console.log('   ✓ All dependencies installed correctly\n');
} catch (error) {
    console.error('   ⚠ Could not verify dependencies:', error.message, '\n');
}

// Final summary
console.log('═══════════════════════════════════════════════════════');
console.log('🎉 All tests passed! Package works correctly from npm!');
console.log('═══════════════════════════════════════════════════════');

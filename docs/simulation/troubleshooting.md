# Troubleshooting Guide

Common issues, error messages, and solutions for Agentic Robotics simulation system.

## 📚 Table of Contents

1. [Installation Issues](#installation-issues)
2. [Message Passing Errors](#message-passing-errors)
3. [Memory System Issues](#memory-system-issues)
4. [Performance Problems](#performance-problems)
5. [Control Loop Issues](#control-loop-issues)
6. [Multi-Robot Coordination](#multi-robot-coordination)
7. [Platform-Specific Issues](#platform-specific-issues)
8. [Getting Help](#getting-help)

---

## Installation Issues

### Error: Cannot find module 'agentic-robotics'

**Symptoms:**
```
Error: Cannot find module 'agentic-robotics'
```

**Causes:**
- Package not installed
- Wrong directory

**Solutions:**
```bash
# Install globally
npm install -g agentic-robotics

# Or install locally
npm install agentic-robotics

# Verify installation
npm list agentic-robotics
```

---

### Error: Platform binary not found

**Symptoms:**
```
Error: Could not load native module for platform: linux-x64-gnu
```

**Causes:**
- Platform not supported yet
- Binary not downloaded

**Solutions:**

1. Check supported platforms:
```bash
npm list @agentic-robotics/linux-x64-gnu
```

2. Currently supported: Linux x64
3. Coming soon: macOS, Windows, ARM64

**Workaround:**
```bash
# Use Docker on unsupported platforms
docker pull ruvnet/agentic-robotics
docker run -it ruvnet/agentic-robotics
```

---

### Error: Node version incompatible

**Symptoms:**
```
Error: The module was compiled against a different Node.js version
```

**Causes:**
- Wrong Node.js version

**Solutions:**
```bash
# Check Node version
node --version  # Should be >= 18.0.0

# Install correct version with nvm
nvm install 18
nvm use 18

# Reinstall packages
rm -rf node_modules package-lock.json
npm install
```

---

## Message Passing Errors

### Error: Topic already exists

**Symptoms:**
```
Error: Publisher for topic '/robot/state' already exists
```

**Causes:**
- Attempting to create duplicate publisher

**Solutions:**

**Option 1:** Reuse existing publisher
```javascript
class Robot {
  constructor() {
    this.publishers = new Map();
  }

  async getPublisher(topic) {
    if (!this.publishers.has(topic)) {
      const pub = await this.node.createPublisher(topic);
      this.publishers.set(topic, pub);
    }
    return this.publishers.get(topic);
  }
}
```

**Option 2:** Use unique topic names
```javascript
// Include robot ID in topic
const topic = `/robots/${robotId}/state`;
const pub = await robot.createPublisher(topic);
```

---

### Error: Message parse error

**Symptoms:**
```
SyntaxError: Unexpected token in JSON at position 0
```

**Causes:**
- Invalid JSON in message
- Corrupted message data

**Solutions:**

**Always validate before parsing:**
```javascript
await sub.subscribe((message) => {
  try {
    const data = JSON.parse(message);
    processData(data);
  } catch (error) {
    console.error('Invalid JSON:', message);
    console.error('Error:', error.message);
    // Skip malformed message
  }
});
```

**Add message validation:**
```javascript
function validateMessage(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Message must be an object');
  }

  if (!data.timestamp) {
    throw new Error('Message missing timestamp');
  }

  // Add more validation as needed
}

await sub.subscribe((message) => {
  try {
    const data = JSON.parse(message);
    validateMessage(data);
    processData(data);
  } catch (error) {
    console.error('Invalid message:', error.message);
  }
});
```

---

### Error: Subscriber not receiving messages

**Symptoms:**
- Publisher sends messages but subscriber doesn't receive

**Causes:**
- Topic name mismatch
- Subscriber created after publisher sends
- Callback not async

**Solutions:**

**Check topic names exactly:**
```javascript
// ❌ Mismatch
const pub = await node.createPublisher('/robot/state');
const sub = await node.createSubscriber('/robots/state');  // Wrong!

// ✅ Match
const pub = await node.createPublisher('/robot/state');
const sub = await node.createSubscriber('/robot/state');
```

**Create subscriber before publisher:**
```javascript
// ✅ Correct order
const sub = await node.createSubscriber('/commands');
await sub.subscribe(handleCommand);

const pub = await node.createPublisher('/commands');
await pub.publish(JSON.stringify({ action: 'test' }));
```

**Add delay for testing:**
```javascript
const sub = await node.createSubscriber('/test');
await sub.subscribe(console.log);

// Give subscriber time to register
await new Promise(resolve => setTimeout(resolve, 100));

const pub = await node.createPublisher('/test');
await pub.publish(JSON.stringify({ test: 'data' }));
```

---

## Memory System Issues

### Error: SQLITE_BUSY - database is locked

**Symptoms:**
```
Error: SQLITE_BUSY: database is locked
```

**Causes:**
- Multiple processes accessing same database
- Long-running transaction

**Solutions:**

**Use WAL mode (eliminates most locking):**
```javascript
const memory = new AgentDBMemory('./memory.db', {
  walMode: true  // ✅ Enable WAL
});
```

**Add retry logic:**
```javascript
async function storeWithRetry(memory, episode, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await memory.storeEpisode(episode);
      return;
    } catch (error) {
      if (error.message.includes('SQLITE_BUSY') && i < maxRetries - 1) {
        console.log(`Database busy, retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      } else {
        throw error;
      }
    }
  }
}
```

**Use separate databases per robot:**
```javascript
// ✅ Each robot has own database
const memory = new AgentDBMemory(`./memory-${robotId}.db`);
```

---

### Error: Out of memory

**Symptoms:**
```
JavaScript heap out of memory
FATAL ERROR: Reached heap limit
```

**Causes:**
- Too many episodes stored
- Memory leak
- Large messages cached

**Solutions:**

**Implement retention policy:**
```javascript
// Clean up old episodes
async function cleanupMemory(memory) {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  await memory.cleanup({
    removeOlderThan: thirtyDaysAgo,
    keepMinConfidence: 0.8,
    keepAllFailures: true
  });

  await memory.vacuum();
}

// Run weekly
setInterval(() => cleanupMemory(memory), 7 * 24 * 60 * 60 * 1000);
```

**Increase heap size:**
```bash
# Start with more memory
node --max-old-space-size=4096 robot.js  # 4GB heap
```

**Find memory leaks:**
```bash
# Enable heap profiler
node --inspect robot.js

# Chrome DevTools -> Memory -> Take heap snapshot
# Compare snapshots to find leaks
```

---

### Error: Slow memory operations

**Symptoms:**
- storeEpisode() takes > 100ms
- retrieveMemories() takes > 1 second

**Causes:**
- WAL mode not enabled
- Database not optimized
- Too many episodes

**Solutions:**

**Enable all optimizations:**
```javascript
const memory = new AgentDBMemory('./memory.db', {
  walMode: true,           // ✅ 13,168x speedup
  cacheSize: 10000,        // 10MB cache
  mmapSize: 30000000000    // 30GB memory-mapped
});
```

**Use transactions for batch:**
```javascript
await memory.beginTransaction();
try {
  for (const episode of episodes) {
    await memory.storeEpisode(episode);
  }
  await memory.commit();
} catch (error) {
  await memory.rollback();
}
```

**Filter before retrieval:**
```javascript
// ✅ Fast
const memories = await memory.retrieveMemories(
  'obstacle avoidance',
  10,
  {
    domain: 'navigation',
    minConfidence: 0.7,
    onlySuccesses: true
  }
);

// ❌ Slow
const memories = await memory.retrieveMemories(
  'anything',
  1000
);
```

---

## Performance Problems

### Issue: Control loop running too slow

**Symptoms:**
- Control loop takes longer than target period
- Warnings: "Control loop overrun"

**Causes:**
- Too much work in loop
- Blocking operations
- CPU overload

**Solutions:**

**Measure loop time:**
```javascript
setInterval(async () => {
  const start = Date.now();

  await controlLoop();

  const elapsed = Date.now() - start;
  if (elapsed > 100) {  // 100ms = 10Hz
    console.warn(`Loop overrun: ${elapsed}ms (target: 100ms)`);
  }
}, 100);
```

**Move slow operations out:**
```javascript
// Critical loop at 100Hz
setInterval(async () => {
  await readSensors();      // Fast
  await computeControl();   // Fast
  await actuate();          // Fast
}, 10);

// Non-critical at 1Hz
setInterval(async () => {
  await logTelemetry();     // Slow
  await storeEpisode();     // Slow
}, 1000);
```

**Optimize expensive operations:**
```javascript
// ❌ Slow
const memories = await memory.retrieveMemories(query, 100);

// ✅ Fast (with caching)
if (!this.memoryCache || Date.now() - this.cacheTime > 60000) {
  this.memoryCache = await memory.retrieveMemories(query, 10);
  this.cacheTime = Date.now();
}
const memories = this.memoryCache;
```

---

### Issue: High CPU usage

**Symptoms:**
- CPU at 100%
- System becomes unresponsive

**Causes:**
- Too many robots
- Too frequent updates
- Inefficient code

**Solutions:**

**Reduce update rate:**
```javascript
// ❌ 1000Hz (too fast)
setInterval(() => publishState(), 1);

// ✅ 10Hz (sufficient)
setInterval(() => publishState(), 100);
```

**Batch operations:**
```javascript
// ❌ Individual publishes
for (const sensor of sensors) {
  await pub.publish(JSON.stringify(sensor));
}

// ✅ Batched
await pub.publish(JSON.stringify({
  sensors: sensors.map(s => ({ id: s.id, val: s.value }))
}));
```

**Use worker threads for heavy computation:**
```javascript
const { Worker } = require('worker_threads');

const worker = new Worker('./heavy-computation.js');

worker.postMessage({ data: sensorData });
worker.on('message', (result) => {
  // Use computed result
});
```

---

### Issue: Memory leak

**Symptoms:**
- Memory usage grows over time
- Eventually crashes with out-of-memory

**Causes:**
- Not cleaning up resources
- Circular references
- Event listener accumulation

**Solutions:**

**Clean up resources:**
```javascript
class Robot {
  constructor() {
    this.intervals = [];
    this.subscribers = [];
  }

  async initialize() {
    const interval = setInterval(() => this.loop(), 100);
    this.intervals.push(interval);

    const sub = await this.node.createSubscriber('/commands');
    this.subscribers.push(sub);
  }

  async shutdown() {
    // Clear all intervals
    for (const interval of this.intervals) {
      clearInterval(interval);
    }

    // Unsubscribe all
    for (const sub of this.subscribers) {
      await sub.unsubscribe();
    }
  }
}
```

**Avoid circular references:**
```javascript
// ❌ Circular reference
class Robot {
  constructor() {
    this.memory = {
      robot: this  // Circular!
    };
  }
}

// ✅ No circular reference
class Robot {
  constructor() {
    this.memory = {
      robotId: this.id  // Just the ID
    };
  }
}
```

**Monitor memory growth:**
```javascript
setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsed = (usage.heapUsed / 1024 / 1024).toFixed(2);

  console.log(`Heap used: ${heapUsed} MB`);

  if (heapUsed > 1000) {
    console.error('Memory leak detected!');
    // Trigger graceful shutdown and restart
  }
}, 5000);
```

---

## Control Loop Issues

### Issue: Jittery control

**Symptoms:**
- Robot motion is jerky
- Inconsistent update timing

**Causes:**
- Variable loop timing
- Non-deterministic execution

**Solutions:**

**Use fixed-rate timer:**
```javascript
// ✅ Fixed rate
setInterval(async () => {
  await controlLoop();
}, 100);  // Exactly 10Hz
```

**Add jitter compensation:**
```javascript
let lastTime = Date.now();

setInterval(async () => {
  const now = Date.now();
  const dt = (now - lastTime) / 1000;  // seconds
  lastTime = now;

  await controlLoop(dt);  // Pass actual time delta
}, 100);
```

---

### Issue: Control loop freezes

**Symptoms:**
- Robot stops responding
- No updates published

**Causes:**
- Blocking operation in loop
- Unhandled promise rejection

**Solutions:**

**Never block in control loop:**
```javascript
// ❌ Blocking sleep
function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {}  // Blocks!
}

// ✅ Non-blocking sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Add error handling:**
```javascript
setInterval(async () => {
  try {
    await controlLoop();
  } catch (error) {
    console.error('Control loop error:', error);
    // Emergency stop
    await emergencyStop();
  }
}, 100);
```

**Add watchdog timer:**
```javascript
let lastLoopTime = Date.now();

setInterval(async () => {
  await controlLoop();
  lastLoopTime = Date.now();
}, 100);

// Watchdog checks every second
setInterval(() => {
  if (Date.now() - lastLoopTime > 1000) {
    console.error('Control loop frozen!');
    process.exit(1);  // Restart
  }
}, 1000);
```

---

## Multi-Robot Coordination

### Issue: Robots not coordinating

**Symptoms:**
- Robots act independently
- No task sharing

**Causes:**
- Not subscribing to coordination topics
- Different topic names

**Solutions:**

**Ensure all robots subscribe:**
```javascript
// All robots must subscribe
const coordSub = await node.createSubscriber('/coordination');
await coordSub.subscribe(handleCoordination);
```

**Use consistent topic naming:**
```javascript
// ✅ Standard naming convention
const TOPICS = {
  coordination: '/swarm/coordination',
  status: (id) => `/robots/${id}/status`,
  tasks: '/swarm/tasks'
};
```

---

### Issue: Task conflicts

**Symptoms:**
- Multiple robots try same task
- Duplicate work

**Causes:**
- No task allocation mechanism
- Race condition

**Solutions:**

**Implement task locking:**
```javascript
class TaskCoordinator {
  constructor() {
    this.assignedTasks = new Map();
  }

  async assignTask(robotId, task) {
    // Check if already assigned
    if (this.assignedTasks.has(task.id)) {
      return false;  // Already taken
    }

    // Assign task
    this.assignedTasks.set(task.id, robotId);
    return true;
  }

  async completeTask(taskId) {
    this.assignedTasks.delete(taskId);
  }
}
```

---

## Platform-Specific Issues

### Linux: Permission denied

**Symptoms:**
```
Error: EACCES: permission denied
```

**Solutions:**
```bash
# Fix permissions
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER ./node_modules

# Or install without sudo
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
```

---

### macOS: Code signing issues

**Symptoms:**
```
Error: Code signature invalid
```

**Solutions:**
```bash
# Allow unsigned binaries (development only)
xattr -d com.apple.quarantine node_modules/@agentic-robotics

# Or sign the binary
codesign --force --deep --sign - node_modules/@agentic-robotics/...
```

---

## Getting Help

### Before Asking for Help

1. **Check documentation**
   - [README](./README.md)
   - [API Reference](./api-reference.md)
   - [Examples](./examples-guide.md)

2. **Enable debug logging**
```javascript
process.env.DEBUG = 'agentic-robotics:*';
```

3. **Check versions**
```bash
node --version
npm list agentic-robotics
```

4. **Create minimal reproduction**
```javascript
// Simplest possible code that shows the issue
const { AgenticNode } = require('agentic-robotics');

async function main() {
  const robot = new AgenticNode('test');
  // ... minimal code to reproduce issue
}

main().catch(console.error);
```

### Where to Get Help

1. **GitHub Discussions**
   - [https://github.com/ruvnet/agentic-robotics/discussions](https://github.com/ruvnet/agentic-robotics/discussions)
   - Ask questions, share ideas

2. **GitHub Issues**
   - [https://github.com/ruvnet/agentic-robotics/issues](https://github.com/ruvnet/agentic-robotics/issues)
   - Report bugs with reproduction steps

3. **Documentation**
   - [https://ruv.io/agentic-robotics/docs](https://ruv.io/agentic-robotics/docs)
   - Complete API and guides

### Creating Good Bug Reports

Include:
- **Node.js version**: `node --version`
- **Package version**: `npm list agentic-robotics`
- **Operating system**: Linux/macOS/Windows + version
- **Minimal code**: Simplest reproduction
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Error messages**: Full stack trace
- **Logs**: Debug output if available

Example:
```markdown
## Bug Report

**Environment:**
- Node.js: v18.17.0
- agentic-robotics: 0.1.3
- OS: Ubuntu 22.04

**Code:**
```javascript
const { AgenticNode } = require('agentic-robotics');
const robot = new AgenticNode('test');
// ...
```

**Expected:** Robot should initialize
**Actual:** Throws error "Cannot find module"

**Error:**
```
Error: Cannot find module '@agentic-robotics/linux-x64-gnu'
```

**Steps to reproduce:**
1. Install agentic-robotics
2. Run node test.js
3. Error occurs
```

---

**Previous:** [Performance Tuning](./performance-tuning.md) | **Back to:** [README](./README.md)

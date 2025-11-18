# Training Guide

Comprehensive guide to training robots with AgentDB memory system, implementing reflexion learning, and optimizing strategies.

## 📚 Table of Contents

1. [Introduction to Robot Learning](#introduction-to-robot-learning)
2. [AgentDB Memory System](#agentdb-memory-system)
3. [Reflexion Learning Pattern](#reflexion-learning-pattern)
4. [Skill Consolidation](#skill-consolidation)
5. [Strategy Optimization](#strategy-optimization)
6. [Training Workflows](#training-workflows)
7. [Advanced Techniques](#advanced-techniques)
8. [Performance Optimization](#performance-optimization)

---

## Introduction to Robot Learning

### What is Agentic Learning?

Traditional robots follow pre-programmed behaviors. **Agentic robots learn from experience** and automatically improve over time.

**Traditional Approach:**
```javascript
// Hard-coded logic
if (obstacle_distance < 1.0) {
  stop();
} else if (obstacle_distance < 2.0) {
  slow_down();
} else {
  full_speed();
}
```

**Agentic Approach:**
```javascript
// Learn from experience
const memories = await memory.retrieveMemories(
  `obstacle avoidance at distance ${obstacle_distance}`,
  5
);

const bestStrategy = selectOptimalStrategy(memories);
await executeStrategy(bestStrategy);

// Store outcome for future learning
await memory.storeEpisode({
  taskName: 'obstacle_avoidance',
  success: result.success,
  strategy: bestStrategy.name,
  confidence: result.confidence
});
```

### Key Concepts

**1. Episodes**: Individual experiences (tasks executed)
**2. Skills**: Consolidated patterns from successful episodes
**3. Strategies**: Specific approaches to tasks
**4. Reflexion**: Self-critique and learning from failures
**5. Confidence**: How certain the robot is about outcomes

---

## AgentDB Memory System

### Architecture

```
┌─────────────────────────────────────────────┐
│         Application Layer                    │
│  (Your robot code)                           │
├─────────────────────────────────────────────┤
│         AgentDBMemory API                    │
│  • storeEpisode()                            │
│  • retrieveMemories()                        │
│  • consolidateSkills()                       │
│  • searchSkills()                            │
├─────────────────────────────────────────────┤
│         Hybrid SQL Storage                   │
│  • Episodes table (all experiences)          │
│  • Skills table (learned patterns)           │
│  • Vector embeddings (semantic search)       │
├─────────────────────────────────────────────┤
│         SQLite Database                      │
│  • WAL mode (13,168x faster)                │
│  • Memory-mapped I/O                         │
│  • Prepared statements                       │
└─────────────────────────────────────────────┘
```

### Setup

```javascript
const { AgentDBMemory } = require('@agentic-robotics/mcp');

// Create memory instance
const memory = new AgentDBMemory('./robot-memory.db');

// Initialize database
await memory.initialize();

// Memory is now ready to use
```

### Database Schema

```sql
-- Episodes: All experiences
CREATE TABLE episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  confidence REAL NOT NULL,
  success BOOLEAN NOT NULL,
  outcome TEXT NOT NULL,
  strategy TEXT,
  critique TEXT,
  metadata JSON,
  timestamp INTEGER NOT NULL,
  embedding BLOB
);

-- Skills: Consolidated patterns
CREATE TABLE skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  success_rate REAL NOT NULL,
  times_used INTEGER NOT NULL,
  strategy TEXT,
  parameters JSON,
  created_at INTEGER NOT NULL
);

-- Indexes for fast queries
CREATE INDEX idx_task ON episodes(task_name);
CREATE INDEX idx_success ON episodes(success);
CREATE INDEX idx_strategy ON episodes(strategy);
CREATE INDEX idx_confidence ON episodes(confidence);
```

---

## Reflexion Learning Pattern

### The Reflexion Cycle

```
┌──────────────────────────────────────────┐
│    1. EXECUTE TASK                        │
│    Try to accomplish goal                 │
└─────────────┬────────────────────────────┘
              │
              v
┌──────────────────────────────────────────┐
│    2. SELF-CRITIQUE                       │
│    Analyze what worked/didn't work        │
└─────────────┬────────────────────────────┘
              │
              v
┌──────────────────────────────────────────┐
│    3. STORE EPISODE                       │
│    Save experience with critique          │
└─────────────┬────────────────────────────┘
              │
              v
┌──────────────────────────────────────────┐
│    4. RETRIEVE SIMILAR                    │
│    Find related past experiences          │
└─────────────┬────────────────────────────┘
              │
              v
┌──────────────────────────────────────────┐
│    5. IMPROVE STRATEGY                    │
│    Apply lessons learned                  │
└─────────────┬────────────────────────────┘
              │
              └──────> REPEAT
```

### Implementation

```javascript
class LearningRobot {
  async executeTaskWithReflexion(task) {
    // 1. RETRIEVE past experiences
    const memories = await this.memory.retrieveMemories(
      `${task.type} in ${task.context}`,
      5,
      { minConfidence: 0.7 }
    );

    // 2. SELECT strategy from past successes
    const strategy = this.selectBestStrategy(memories);
    console.log(`Using strategy: ${strategy.name}`);

    // 3. EXECUTE task
    const startTime = Date.now();
    let result;
    try {
      result = await this.execute(task, strategy);
    } catch (error) {
      result = {
        success: false,
        error: error.message,
        confidence: 0.0
      };
    }
    const duration = Date.now() - startTime;

    // 4. SELF-CRITIQUE
    const critique = await this.analyzeCritique(task, result, strategy);

    // 5. STORE episode with critique
    await this.memory.storeEpisode({
      sessionId: this.sessionId,
      taskName: task.type,
      confidence: result.confidence,
      success: result.success,
      outcome: result.description || result.error,
      strategy: strategy.name,
      critique: critique,
      metadata: {
        duration,
        context: task.context,
        parameters: strategy.parameters,
        improvements: critique.suggestions
      }
    });

    return result;
  }

  private analyzeCritique(task, result, strategy) {
    const critique = {
      success: result.success,
      strengths: [],
      weaknesses: [],
      suggestions: []
    };

    if (result.success) {
      // Analyze successful execution
      critique.strengths.push(`Strategy ${strategy.name} worked well`);

      if (result.duration < strategy.expectedDuration * 0.9) {
        critique.strengths.push('Completed faster than expected');
      } else if (result.duration > strategy.expectedDuration * 1.2) {
        critique.weaknesses.push('Took longer than expected');
        critique.suggestions.push('Consider optimizing path planning');
      }

      if (result.confidence < 0.8) {
        critique.weaknesses.push('Low confidence in outcome');
        critique.suggestions.push('Add more sensor validation');
      }
    } else {
      // Analyze failure
      critique.weaknesses.push(`Failed: ${result.error}`);

      if (result.error.includes('obstacle')) {
        critique.suggestions.push('Improve obstacle detection sensitivity');
        critique.suggestions.push('Consider different approach angle');
      }

      if (result.error.includes('timeout')) {
        critique.suggestions.push('Increase timeout threshold');
        critique.suggestions.push('Try simpler strategy first');
      }
    }

    return critique;
  }
}
```

### Example: Adaptive Navigation

```javascript
async function adaptiveNavigation(robot, goal) {
  // Retrieve similar navigation experiences
  const memories = await robot.memory.retrieveMemories(
    `navigate to ${goal.description} with obstacles`,
    5,
    {
      minConfidence: 0.7,
      onlySuccesses: true  // Learn from successes
    }
  );

  if (memories.length > 0) {
    console.log(`Found ${memories.length} similar experiences`);

    // Analyze past strategies
    const strategies = memories.map(m => m.strategy);
    const mostSuccessful = strategies[0];  // Highest confidence first

    console.log(`Applying learned strategy: ${mostSuccessful}`);

    // Apply learned approach
    if (mostSuccessful === 'wide_berth') {
      await robot.navigateWithWideMargin(goal);
    } else if (mostSuccessful === 'slow_and_careful') {
      await robot.navigateSlowly(goal);
    }
  } else {
    console.log('No similar experiences, trying default approach');
    await robot.navigateDefault(goal);
  }

  // Store this attempt for future learning
  await robot.memory.storeEpisode({
    taskName: 'navigation',
    success: await robot.reachedGoal(goal),
    confidence: 0.9,
    outcome: `Navigated to ${goal.description}`,
    strategy: 'chosen_strategy',
    metadata: { goal }
  });
}
```

---

## Skill Consolidation

### What is Skill Consolidation?

**Skill consolidation** automatically identifies successful patterns and creates reusable skills.

```
100 Episodes ────> Pattern Mining ────> 5 Skills

Example:
- 20 successful "precise grasp" episodes
  → Consolidated into "precise_grasp_small_objects" skill
- 15 successful "fast navigation" episodes
  → Consolidated into "fast_nav_open_spaces" skill
```

### Algorithm

```
1. Filter episodes:
   - success = true
   - confidence > 0.7
   - recent (last 30 days)

2. Group by:
   - task_name
   - strategy

3. Calculate statistics:
   - Success rate
   - Average duration
   - Resource usage
   - Parameter consistency

4. Create skill if:
   - Success rate > 80%
   - Times used > 5
   - Consistent parameters

5. Update skill library
```

### Implementation

```javascript
// Consolidate skills periodically
async function consolidateSkillsPeriodically(memory) {
  setInterval(async () => {
    console.log('Starting skill consolidation...');

    // Consolidate each task domain
    const domains = ['navigation', 'manipulation', 'inspection'];

    for (const domain of domains) {
      const result = await memory.consolidateSkills(domain);

      console.log(`${domain}:`);
      console.log(`  Skills consolidated: ${result.skillsConsolidated}`);
      console.log(`  Patterns found: ${result.patternsFound}`);
      console.log(`  Strategies: ${result.commonStrategies.join(', ')}`);
    }
  }, 24 * 60 * 60 * 1000);  // Daily
}
```

### Example Output

```
navigation:
  Skills consolidated: 3
  Patterns found: 5
  Strategies: direct_path, safe_path, dynamic_replan

Skill: fast_nav_open_spaces
  Success Rate: 95%
  Times Used: 23
  Avg Duration: 8.5s
  Parameters:
    speed: 1.0
    lookahead: 0.5
    obstacle_margin: 1.0

Skill: precise_nav_narrow_corridors
  Success Rate: 88%
  Times Used: 17
  Avg Duration: 15.2s
  Parameters:
    speed: 0.3
    lookahead: 2.0
    obstacle_margin: 2.0
```

### Using Consolidated Skills

```javascript
// Search for applicable skills
const skills = await memory.searchSkills('precise object grasping', 3);

if (skills.length > 0) {
  const skill = skills[0];
  console.log(`Using skill: ${skill.name}`);
  console.log(`  Success rate: ${(skill.successRate * 100).toFixed(1)}%`);
  console.log(`  Times used: ${skill.timesUsed}`);

  // Apply skill parameters
  await robot.grasp(object, {
    approach_speed: skill.parameters.approach_speed,
    grasp_force: skill.parameters.grasp_force,
    pre_grasp_delay: skill.parameters.pre_grasp_delay
  });
}
```

---

## Strategy Optimization

### Multi-Armed Bandit Approach

Balance exploration (trying new strategies) vs exploitation (using known good strategies).

```javascript
class StrategyOptimizer {
  constructor() {
    this.strategies = new Map();
    this.epsilon = 0.2;  // 20% exploration rate
  }

  selectStrategy(task, memories) {
    // Epsilon-greedy selection
    if (Math.random() < this.epsilon) {
      // EXPLORE: Try a random strategy
      console.log('Exploring: trying random strategy');
      return this.getRandomStrategy(task);
    } else {
      // EXPLOIT: Use best known strategy
      console.log('Exploiting: using best known strategy');
      return this.getBestStrategy(task, memories);
    }
  }

  getBestStrategy(task, memories) {
    // Calculate expected value for each strategy
    const strategyScores = new Map();

    for (const memory of memories) {
      if (!strategyScores.has(memory.strategy)) {
        strategyScores.set(memory.strategy, {
          successes: 0,
          attempts: 0,
          totalConfidence: 0
        });
      }

      const stats = strategyScores.get(memory.strategy);
      stats.attempts++;
      stats.totalConfidence += memory.confidence;
      if (memory.success) {
        stats.successes++;
      }
    }

    // Select strategy with highest expected value
    let bestStrategy = null;
    let bestScore = -Infinity;

    for (const [strategy, stats] of strategyScores) {
      const successRate = stats.successes / stats.attempts;
      const avgConfidence = stats.totalConfidence / stats.attempts;

      // Expected value = success_rate * confidence
      const score = successRate * avgConfidence;

      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }
}
```

### Thompson Sampling

More sophisticated strategy selection using Bayesian inference.

```javascript
class ThompsonSamplingOptimizer {
  selectStrategy(strategies, memories) {
    const samples = new Map();

    for (const strategy of strategies) {
      // Get past performance
      const history = memories.filter(m => m.strategy === strategy.name);

      const successes = history.filter(m => m.success).length;
      const failures = history.length - successes;

      // Beta distribution parameters
      const alpha = successes + 1;  // Prior: 1 success
      const beta = failures + 1;    // Prior: 1 failure

      // Sample from Beta(alpha, beta)
      const sample = this.betaSample(alpha, beta);
      samples.set(strategy, sample);
    }

    // Select strategy with highest sample
    let bestStrategy = null;
    let maxSample = -Infinity;

    for (const [strategy, sample] of samples) {
      if (sample > maxSample) {
        maxSample = sample;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }

  betaSample(alpha, beta) {
    // Simplified beta sampling
    // In production, use proper beta distribution library
    const x = Math.random();
    return Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1);
  }
}
```

---

## Training Workflows

### Workflow 1: Initial Training

Train a robot from scratch with no prior experience.

```javascript
async function initialTraining(robot, numTrials = 100) {
  console.log(`Starting initial training with ${numTrials} trials...\n`);

  const tasks = generateVariedTasks(numTrials);
  const strategies = [
    'direct_approach',
    'cautious_approach',
    'fast_approach',
    'optimized_approach'
  ];

  for (let i = 0; i < numTrials; i++) {
    const task = tasks[i];

    // Random strategy selection for exploration
    const strategy = strategies[i % strategies.length];

    console.log(`Trial ${i + 1}/${numTrials}: ${task.type} with ${strategy}`);

    const result = await robot.executeTask(task, strategy);

    // Store episode
    await robot.memory.storeEpisode({
      sessionId: `training-${robot.id}`,
      taskName: task.type,
      confidence: result.confidence,
      success: result.success,
      outcome: result.description,
      strategy: strategy,
      metadata: {
        trial: i + 1,
        difficulty: task.difficulty,
        duration: result.duration
      }
    });

    // Progress report every 20 trials
    if ((i + 1) % 20 === 0) {
      await printProgress(robot.memory, i + 1);
    }
  }

  // Consolidate learned skills
  console.log('\nConsolidating skills...');
  const result = await robot.memory.consolidateSkills('all');
  console.log(`Learned ${result.skillsConsolidated} skills!`);
}

async function printProgress(memory, trials) {
  const recentEpisodes = await memory.retrieveMemories('any task', trials);
  const successes = recentEpisodes.filter(e => e.success).length;
  const successRate = (successes / recentEpisodes.length * 100).toFixed(1);

  console.log(`\n--- Progress Report (${trials} trials) ---`);
  console.log(`Success Rate: ${successRate}%`);
  console.log(`Avg Confidence: ${(recentEpisodes.reduce((sum, e) => sum + e.confidence, 0) / recentEpisodes.length).toFixed(2)}`);
  console.log('---\n');
}
```

### Workflow 2: Continuous Learning

Robot learns continuously during operation.

```javascript
class ContinuousLearningRobot {
  async start() {
    // Main operation loop
    while (this.running) {
      // Get next task
      const task = await this.getNextTask();

      // Use learned strategies
      const memories = await this.memory.retrieveMemories(
        task.description,
        5,
        { minConfidence: 0.7 }
      );

      const strategy = this.selectStrategy(task, memories);

      // Execute and learn
      await this.executeTaskWithReflexion(task, strategy);

      // Periodic consolidation (every 100 tasks)
      if (this.tasksCompleted % 100 === 0) {
        await this.consolidateAndOptimize();
      }
    }
  }

  async consolidateAndOptimize() {
    console.log('Consolidating skills...');

    // Consolidate each domain
    const domains = this.getActiveDomains();
    for (const domain of domains) {
      await this.memory.consolidateSkills(domain);
    }

    // Optimize memory (cleanup old episodes)
    await this.optimizeMemory();
  }

  async optimizeMemory() {
    // Keep only:
    // - Recent episodes (last 30 days)
    // - High-confidence episodes (> 0.8)
    // - All failures (learn from mistakes)

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    // This would be a custom SQL query
    // await memory.cleanup({
    //   keepRecent: thirtyDaysAgo,
    //   keepHighConfidence: 0.8,
    //   keepAllFailures: true
    // });
  }
}
```

### Workflow 3: Transfer Learning

Transfer learned skills from one robot to another.

```javascript
async function transferLearning(sourceRobot, targetRobot) {
  console.log('Transferring skills...');

  // Export skills from source
  const skills = await sourceRobot.memory.searchSkills('all', 100);

  console.log(`Found ${skills.length} skills to transfer`);

  // Import to target
  for (const skill of skills) {
    // Create synthetic episodes in target's memory
    await targetRobot.memory.storeEpisode({
      sessionId: `transfer-${sourceRobot.id}`,
      taskName: skill.name,
      confidence: skill.successRate,
      success: true,
      outcome: `Transferred skill: ${skill.description}`,
      strategy: skill.strategy,
      metadata: {
        transferred: true,
        source: sourceRobot.id,
        timesUsed: skill.timesUsed,
        parameters: skill.parameters
      }
    });
  }

  console.log(`Transferred ${skills.length} skills successfully!`);

  // Target robot can now use source robot's experience
}
```

---

## Advanced Techniques

### 1. Curriculum Learning

Train robot with progressively harder tasks.

```javascript
async function curriculumLearning(robot) {
  const curriculum = [
    // Level 1: Easy (success rate should be > 80%)
    { difficulty: 0.2, numTasks: 20, description: 'basic_navigation' },

    // Level 2: Medium (success rate > 70%)
    { difficulty: 0.5, numTasks: 30, description: 'obstacle_avoidance' },

    // Level 3: Hard (success rate > 60%)
    { difficulty: 0.8, numTasks: 50, description: 'complex_manipulation' }
  ];

  for (const level of curriculum) {
    console.log(`\nLevel: ${level.description} (difficulty ${level.difficulty})`);

    const tasks = generateTasks(level.difficulty, level.numTasks);
    let successCount = 0;

    for (const task of tasks) {
      const result = await robot.executeTaskWithReflexion(task);
      if (result.success) successCount++;
    }

    const successRate = successCount / level.numTasks;
    console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);

    // Require 70% success before advancing
    if (successRate < 0.7) {
      console.log('Not ready for next level, repeating...');
      // Repeat this level
      curriculum.splice(curriculum.indexOf(level), 0, level);
    }
  }
}
```

### 2. Active Learning

Robot requests human feedback on uncertain situations.

```javascript
async function activeLearning(robot, task) {
  const result = await robot.executeTask(task);

  // Low confidence? Ask for human feedback
  if (result.confidence < 0.6) {
    console.log(`\nLow confidence (${result.confidence}), requesting feedback...`);

    const feedback = await requestHumanFeedback({
      task: task,
      result: result,
      question: 'Was this execution correct?'
    });

    // Update episode with human label
    await robot.memory.storeEpisode({
      taskName: task.type,
      success: feedback.correct,  // Human label
      confidence: 1.0,            // Human feedback is high confidence
      outcome: feedback.comments,
      metadata: {
        human_labeled: true,
        robot_confidence: result.confidence,
        human_feedback: feedback
      }
    });
  }
}
```

### 3. Meta-Learning (Learning to Learn)

Robot learns how to learn faster.

```javascript
class MetaLearningRobot {
  async adaptLearningRate(task) {
    // Analyze how quickly robot learned similar tasks
    const memories = await this.memory.retrieveMemories(
      `learning progress for ${task.type}`,
      20
    );

    // Calculate learning curve
    const learningRate = this.calculateLearningRate(memories);

    // Adjust exploration rate based on learning speed
    if (learningRate > 0.8) {
      // Fast learner: exploit more
      this.epsilon = 0.1;
    } else if (learningRate < 0.3) {
      // Slow learner: explore more
      this.epsilon = 0.4;
    } else {
      // Medium: balanced
      this.epsilon = 0.2;
    }
  }

  calculateLearningRate(memories) {
    // Fit learning curve to episodes
    // success_rate = 1 - exp(-k * episodes)
    // Higher k = faster learning

    // Simplified implementation
    const firstHalf = memories.slice(0, memories.length / 2);
    const secondHalf = memories.slice(memories.length / 2);

    const firstSuccess = firstHalf.filter(m => m.success).length / firstHalf.length;
    const secondSuccess = secondHalf.filter(m => m.success).length / secondHalf.length;

    return secondSuccess - firstSuccess;
  }
}
```

---

## Performance Optimization

### Memory Size Management

```javascript
// Optimize memory periodically
async function optimizeMemory(memory) {
  console.log('Optimizing memory...');

  // 1. Remove old low-confidence episodes
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  // 2. Keep consolidated skills
  // 3. Keep all failures (learn from mistakes)
  // 4. Keep high-confidence successes

  await memory.optimize({
    removeOlderThan: thirtyDaysAgo,
    keepMinConfidence: 0.7,
    keepAllFailures: true,
    keepConsolidatedSkills: true
  });

  // Vacuum database
  await memory.vacuum();
}
```

### Batch Storage

```javascript
// Store multiple episodes efficiently
async function batchStore(memory, episodes) {
  // Use transactions for batch inserts (287,500x faster!)
  await memory.beginTransaction();

  try {
    for (const episode of episodes) {
      await memory.storeEpisode(episode);
    }

    await memory.commit();
    console.log(`Stored ${episodes.length} episodes in batch`);
  } catch (error) {
    await memory.rollback();
    console.error('Batch store failed:', error);
  }
}
```

### Parallel Retrieval

```javascript
// Retrieve multiple queries in parallel
async function parallelRetrieval(memory, queries) {
  const promises = queries.map(query =>
    memory.retrieveMemories(query.text, query.k, query.options)
  );

  const results = await Promise.all(promises);

  return results;
}
```

---

**Next:** [Examples Guide](./examples-guide.md) | **Previous:** [Robot Types](./robot-types.md)

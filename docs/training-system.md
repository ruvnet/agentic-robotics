# Agentic Robotics Training System

## Overview

The training system provides a comprehensive reinforcement learning framework for robot training with multiple algorithms, environments, and advanced features like experience replay, strategy evolution, and multi-robot coordination.

## Features

### 🤖 Reinforcement Learning Algorithms

1. **Q-Learning** - Off-policy value-based learning
   - Temporal difference learning
   - ε-greedy exploration
   - Q-table approximation

2. **SARSA** - On-policy temporal difference learning
   - Uses actual next action for updates
   - More conservative than Q-Learning
   - Better for online learning

3. **Policy Gradient** - Direct policy optimization
   - REINFORCE algorithm
   - Stochastic policy representation
   - Gradient ascent on expected reward

4. **Actor-Critic** - Hybrid approach
   - Actor: Policy network
   - Critic: Value network
   - Advantage-based updates

5. **Deep Q-Network (DQN)** - Neural network approximation
   - Experience replay buffer
   - Target network for stability
   - Mini-batch training

### 🌍 Training Environments

1. **Navigation Environment**
   - 2D grid-based navigation
   - Obstacle avoidance
   - Goal reaching tasks
   - Sensor readings (8 distance sensors)

2. **Manipulation Environment**
   - 3D manipulation tasks
   - Grasping and placing objects
   - Target zone placement
   - Gripper control

3. **Coordination Environment**
   - Multi-robot scenarios
   - Shared goals and resources
   - Team reward optimization
   - Communication protocols

### 💾 Experience Replay with AgentDB

- **Standard Experience Replay**
  - Efficient storage in AgentDB
  - Random sampling for stability
  - Importance sampling weights

- **Prioritized Experience Replay**
  - Priority-based sampling
  - TD-error prioritization
  - Annealing importance sampling

- **Hindsight Experience Replay (HER)**
  - Goal relabeling strategies
  - Learn from failed episodes
  - Sparse reward handling

### 📊 Strategy Evolution

- **Strategy Manager**
  - Performance tracking
  - Automatic strategy selection
  - Persistent storage in AgentDB
  - Skill consolidation

- **Learning Rate Scheduling**
  - Linear decay
  - Exponential decay
  - Cosine annealing
  - Warmup periods

- **Hyperparameter Optimization**
  - Random search
  - Bayesian optimization
  - Adaptive parameter tuning

### 🔄 Multi-Robot Training Coordinator

- **Parallel Training**
  - Simultaneous robot training
  - Shared experience replay
  - Policy synchronization

- **Distributed Learning**
  - Centralized policy updates
  - Decentralized experience collection
  - Periodic synchronization

- **Performance Monitoring**
  - Real-time metrics
  - Per-robot statistics
  - Evaluation episodes

## Installation

The training system is included in the `@agentic-robotics/mcp` package:

```bash
npm install @agentic-robotics/mcp
```

## Quick Start

### Simple Training Example

```typescript
import { quickTrain } from '@agentic-robotics/mcp/training';

// Train 2 robots using DQN in navigation environment
await quickTrain({
  algorithm: 'dqn',
  environment: 'navigation',
  robots: 2,
  episodes: 500,
});
```

### Advanced Training Configuration

```typescript
import { TrainingCoordinator } from '@agentic-robotics/mcp/training';

const coordinator = new TrainingCoordinator({
  numRobots: 4,
  algorithm: 'actor-critic',
  environment: 'navigation',
  episodesPerRobot: 1000,
  maxStepsPerEpisode: 500,
  parallelTraining: true,
  sharedReplay: true,
  syncFrequency: 10,
  evaluationFrequency: 50,
  saveCheckpoints: true,
  checkpointPath: '.agentdb/training',
});

await coordinator.initialize();
const metrics = await coordinator.train();

console.log(`Success rate: ${metrics.successRate * 100}%`);
console.log(`Average reward: ${metrics.avgReward}`);
```

### Single Robot Training

```typescript
import { NavigationEnvironment, QLearning } from '@agentic-robotics/mcp/training';

// Create environment
const env = new NavigationEnvironment({
  dimensions: [10, 10],
  obstacles: [
    { position: [5, 5], shape: 'sphere', size: [1] }
  ],
});

// Create agent
const agent = new QLearning({
  learningRate: 0.1,
  discountFactor: 0.99,
  explorationRate: 1.0,
});

// Training loop
const possibleActions = env.getPossibleActions();

for (let episode = 0; episode < 500; episode++) {
  let state = env.reset();
  let totalReward = 0;

  while (true) {
    const action = agent.selectAction(state, possibleActions);
    const { state: nextState, reward, done } = env.step(action);

    agent.update({ state, action, reward, nextState, done }, possibleActions);

    totalReward += reward;
    if (done) break;
    state = nextState;
  }

  agent.decayExploration();

  if (episode % 50 === 0) {
    console.log(`Episode ${episode}: reward=${totalReward}`);
  }
}
```

## API Reference

### TrainingCoordinator

Main class for orchestrating multi-robot training.

```typescript
interface TrainingConfig {
  numRobots: number;
  algorithm: 'q-learning' | 'sarsa' | 'policy-gradient' | 'actor-critic' | 'dqn';
  environment: 'navigation' | 'manipulation' | 'coordination';
  episodesPerRobot: number;
  maxStepsPerEpisode: number;
  parallelTraining: boolean;
  sharedReplay: boolean;
  syncFrequency: number;
  evaluationFrequency: number;
  saveCheckpoints: boolean;
  checkpointPath: string;
}
```

**Methods:**
- `initialize()` - Initialize training setup
- `train()` - Start training process
- `getMetrics()` - Get current training metrics

### RL Algorithms

#### QLearning

```typescript
const agent = new QLearning({
  learningRate: 0.1,
  discountFactor: 0.99,
  explorationRate: 1.0,
  explorationDecay: 0.995,
  minExploration: 0.01,
});

agent.selectAction(state, possibleActions);
agent.update(experience, possibleActions);
agent.decayExploration();
```

#### DQN

```typescript
const agent = new DQN({
  learningRate: 0.001,
  discountFactor: 0.99,
  batchSize: 32,
  targetUpdateFreq: 100,
});

agent.selectAction(state, possibleActions);
agent.storeExperience(experience);
agent.trainStep();
```

### Environments

#### NavigationEnvironment

```typescript
const env = new NavigationEnvironment({
  dimensions: [10, 10],
  obstacles: [
    { position: [3, 3], shape: 'sphere', size: [1] }
  ],
  timeLimit: 1000,
});

const state = env.reset();
const { state: nextState, reward, done, info } = env.step(action);
env.render();
```

#### ManipulationEnvironment

```typescript
const env = new ManipulationEnvironment({
  dimensions: [5, 5, 3],
  targets: [
    { position: [4, 4, 0], tolerance: 0.5, reward: 100 }
  ],
  timeLimit: 500,
});
```

### Experience Replay

```typescript
const buffer = new ExperienceReplayBuffer({
  maxSize: 100000,
  prioritized: true,
  alpha: 0.6,
  beta: 0.4,
  dbPath: '.agentdb/replay',
});

await buffer.initialize();
await buffer.store(experience, metadata);
const batch = await buffer.sample(batchSize);
const similarExps = await buffer.sampleSimilar(state, k);
```

### Strategy Manager

```typescript
const manager = new StrategyManager('.agentdb/strategies');
await manager.initialize();

await manager.registerStrategy(strategy);
await manager.updatePerformance(strategyId, reward, steps, success);
const bestStrategy = await manager.selectBestStrategy('reward');
const topStrategies = await manager.getTopStrategies(5);
```

## Integration with AgentDB

The training system uses AgentDB for:

1. **Experience Storage** - Efficient vector-based storage and retrieval
2. **Strategy Persistence** - Long-term strategy tracking
3. **Similarity Search** - Find similar experiences for better generalization
4. **Performance Metrics** - Track and analyze training progress

### Hooks Integration

The training coordinator automatically uses hooks for:

```bash
# Pre-task initialization
npx claude-flow@alpha hooks pre-task --description "Training initialization"

# During training - memory storage
npx claude-flow@alpha hooks post-edit --file "checkpoint" --memory-key "training/checkpoint"

# Post-task summary
npx claude-flow@alpha hooks post-task --task-id "training-session"
```

## Performance Optimization

### Tips for Better Training

1. **Start with Q-Learning** - Simplest algorithm, good for debugging
2. **Use DQN for complex tasks** - Better function approximation
3. **Enable shared replay** - Speeds up multi-robot training by 2-4x
4. **Adjust learning rate** - Lower for stability, higher for faster learning
5. **Tune exploration** - High initially, decay gradually
6. **Save checkpoints** - Resume training if interrupted
7. **Monitor metrics** - Watch for convergence and overfitting

### Hyperparameter Guidelines

| Algorithm | Learning Rate | Discount Factor | Exploration Rate |
|-----------|---------------|-----------------|------------------|
| Q-Learning | 0.1 - 0.3 | 0.95 - 0.99 | 1.0 → 0.01 |
| SARSA | 0.05 - 0.2 | 0.95 - 0.99 | 1.0 → 0.01 |
| Policy Gradient | 0.001 - 0.01 | 0.95 - 0.99 | 0.1 - 0.3 |
| Actor-Critic | 0.001 - 0.01 | 0.95 - 0.99 | 0.1 - 0.3 |
| DQN | 0.0001 - 0.001 | 0.99 | 1.0 → 0.01 |

## Examples

See `/home/user/agentic-robotics/examples/training-example.ts` for comprehensive examples:

1. Quick start training
2. Advanced multi-robot training
3. Single robot Q-Learning
4. Experience replay with AgentDB
5. Strategy evolution and optimization

Run examples:

```bash
# Run all examples
tsx examples/training-example.ts

# Run specific example
tsx examples/training-example.ts 3
```

## Troubleshooting

### Common Issues

**Issue: Training is slow**
- Enable parallel training: `parallelTraining: true`
- Reduce max steps: `maxStepsPerEpisode: 300`
- Use shared replay: `sharedReplay: true`

**Issue: Agent not learning**
- Increase learning rate
- Check reward function
- Reduce exploration decay
- Verify environment setup

**Issue: AgentDB errors**
- Ensure AgentDB is installed: `npm install agentdb`
- Check database path exists
- Run initialization: `await buffer.initialize()`

**Issue: Memory usage too high**
- Reduce replay buffer size: `maxSize: 10000`
- Enable prioritized replay
- Save checkpoints more frequently

## Contributing

To extend the training system:

1. **Add new algorithms** - Implement in `reinforcement-learning.ts`
2. **Create environments** - Extend `RobotEnvironment` class
3. **Custom rewards** - Modify `calculateReward()` method
4. **New strategies** - Add to `strategy-evolution.ts`

## References

- [Reinforcement Learning: An Introduction](http://incompleteideas.net/book/the-book.html)
- [Deep Q-Network Paper](https://arxiv.org/abs/1312.5602)
- [Hindsight Experience Replay](https://arxiv.org/abs/1707.01495)
- [AgentDB Documentation](https://github.com/ruvnet/agentdb)

## License

MIT OR Apache-2.0

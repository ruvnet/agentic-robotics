# Self-Learning Optimization System

A comprehensive self-improving robotics framework using swarm intelligence, memory banks, and continuous optimization loops.

## Overview

This system implements advanced self-learning capabilities for robotic systems through:

- **Swarm Intelligence**: Parallel exploration of solution spaces
- **Memory Bank**: Persistent learning across sessions
- **Continuous Optimization**: Automatic parameter tuning
- **Multi-Objective Optimization**: Balanced performance across metrics
- **Claude-flow Integration**: AI-powered optimization using OpenRouter

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Master Orchestrator                   │
│              (master-orchestrator.ts)                   │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼──────────┐ ┌───▼──────────────┐
│ Pre-Exec Hook│ │ Post-Exec Hook   │
│ (validation) │ │ (consolidation)  │
└───┬──────────┘ └───┬──────────────┘
    │                │
    │   ┌────────────┴──────────────┐
    │   │                           │
┌───▼───▼──────┐  ┌────────────────▼───────┐
│ Memory Bank  │  │ Optimization Loop Hook │
│ (persistent) │  │ (continuous learning)  │
└───┬──────────┘  └────────────────────────┘
    │
    │   Self-Learning Components
    │   ═════════════════════════════
    │
    ├──▶ Benchmark Optimizer (benchmark-optimizer.ts)
    │    └─ Particle Swarm Optimization
    │       └─ Multi-objective fitness functions
    │
    ├──▶ Self-Improving Navigator (self-improving-navigator.ts)
    │    └─ Evolutionary strategies
    │       └─ Adaptive parameter tuning
    │
    ├──▶ Swarm Orchestrator (swarm-orchestrator.ts)
    │    └─ Parallel AI agent swarms
    │       └─ OpenRouter integration
    │
    ├──▶ Parallel Executor (parallel-swarm-executor.ts)
    │    └─ Concurrent task execution
    │       └─ Dependency management
    │
    └──▶ Metrics Validator (metrics-validator.ts)
         └─ Continuous validation
            └─ Performance tracking
```

## Components

### 1. Master Orchestrator
Central coordination system that manages the entire optimization pipeline.

**Features:**
- Phase-based execution
- Critical/non-critical phase handling
- Inter-phase validation
- Comprehensive reporting

**Usage:**
```bash
npm run tsx examples/self-learning/master-orchestrator.ts
```

### 2. Benchmark Optimizer
Uses Particle Swarm Optimization (PSO) to find optimal configurations.

**Features:**
- Multi-parameter optimization
- Constraint handling
- Convergence detection
- Real-time progress tracking

**Usage:**
```bash
npm run tsx examples/self-learning/benchmark-optimizer.ts [swarmSize] [iterations]
# Example: npm run tsx examples/self-learning/benchmark-optimizer.ts 12 10
```

**Parameters:**
- `swarmSize`: Number of parallel agents (default: 12)
- `iterations`: Number of optimization iterations (default: 10)

### 3. Self-Improving Navigator
Evolutionary navigation system that learns optimal strategies.

**Features:**
- Strategy evolution through crossover/mutation
- Multi-objective fitness (success, time, path length)
- Epsilon-greedy exploration
- Adaptive difficulty handling

**Usage:**
```bash
npm run tsx examples/self-learning/self-improving-navigator.ts [numTasks]
# Example: npm run tsx examples/self-learning/self-improving-navigator.ts 20
```

### 4. Swarm Orchestrator
Manages parallel AI agent swarms via agentic-flow and OpenRouter.

**Features:**
- Multiple AI model support
- Memory-augmented task generation
- Parallel swarm execution
- Learning extraction and consolidation

**Usage:**
```bash
npm run tsx examples/self-learning/swarm-orchestrator.ts [taskType] [swarmCount]
# Example: npm run tsx examples/self-learning/swarm-orchestrator.ts navigation 8
```

**Supported Models:**
- deepseek/deepseek-r1-0528:free
- google/gemini-2.0-flash-thinking-exp:free
- anthropic/claude-sonnet-4
- openai/gpt-4-turbo-preview

### 5. Parallel Swarm Executor
Manages concurrent execution of multiple swarm tasks with dependency resolution.

**Features:**
- Concurrent task scheduling
- Dependency resolution
- Resource utilization tracking
- Real-time metrics

**Usage:**
```bash
npm run tsx examples/self-learning/parallel-swarm-executor.ts [maxConcurrent]
# Example: npm run tsx examples/self-learning/parallel-swarm-executor.ts 8
```

### 6. Metrics Validator
Comprehensive validation system for hooks, metrics, and data integrity.

**Features:**
- Settings validation
- Hook syntax and execution testing
- Memory bank integrity checks
- Metrics system validation
- Dependency verification

**Usage:**
```bash
npm run tsx examples/self-learning/metrics-validator.ts
```

## Claude-flow Hooks

### Pre-Execution Hook
`.claude/hooks/pre-execution.js`

**Responsibilities:**
- Environment validation
- Memory bank initialization
- Metrics session creation
- Dependency checks

**Validations:**
- Node.js version
- Available memory
- OpenRouter API key
- Required directories
- Dependencies

### Post-Execution Hook
`.claude/hooks/post-execution.js`

**Responsibilities:**
- Results collection
- Learning consolidation
- Memory bank updates
- Report generation

**Features:**
- Success rate calculation
- Strategy extraction
- Learning curve analysis
- Recommendation generation

### Optimization Loop Hook
`.claude/hooks/optimization-loop.js`

**Responsibilities:**
- Performance trend analysis
- Strategy adaptation
- Settings updates
- Next cycle scheduling

**Strategies:**
- Increase exploration (declining performance)
- Focus exploitation (improving performance)
- Inject variation (plateaued performance)
- Continue current (stable performance)

## Memory Bank

The memory bank stores persistent learning data across sessions.

**Location:** `./examples/data/memory-bank.json`

**Structure:**
```json
{
  "version": "1.0.0",
  "lastUpdated": "ISO-8601 timestamp",
  "totalSessions": 0,
  "learnings": [
    {
      "timestamp": "...",
      "totalExecutions": 0,
      "totalOptimizations": 0,
      "successRate": 0.0,
      "averageImprovement": 0.0,
      "topStrategies": [],
      "patterns": []
    }
  ],
  "optimizationHistory": []
}
```

## Configuration

### Settings File
`.claude/settings.json`

Key configuration sections:

**Swarm Config:**
```json
{
  "swarm_config": {
    "parallel_execution": true,
    "max_concurrent_swarms": 8,
    "optimization_strategy": "multi_objective",
    "exploration_rate": 0.3,
    "exploitation_rate": 0.7,
    "adaptive_learning": true
  }
}
```

**OpenRouter Config:**
```json
{
  "openrouter": {
    "enabled": true,
    "models": {
      "optimization": "deepseek/deepseek-r1-0528:free",
      "benchmarking": "anthropic/claude-sonnet-4-5",
      "exploration": "google/gemini-2.0-flash-thinking-exp:free",
      "validation": "openai/gpt-4-turbo-preview"
    }
  }
}
```

## Data Directory Structure

```
examples/data/
├── memory-bank.json           # Persistent learning data
├── last-validation.json       # Latest validation results
├── optimization-report.md     # Latest optimization report
├── benchmarks/                # Benchmark results
│   ├── benchmark-*.json
│   └── benchmark-*.md
├── metrics/                   # Metrics sessions
│   └── session-*.json
├── navigation/                # Navigation results
│   └── navigator-*.json
├── optimization/              # Optimization runs
│   └── swarm-*.json
├── parallel-swarms/           # Parallel execution results
│   └── execution-*.json
├── orchestration/             # Master orchestration results
│   ├── master-*.json
│   └── master-*.md
└── validation/                # Validation reports
    ├── validation-*.json
    └── validation-*.md
```

## Metrics

### Performance Metrics
- **Success Rate**: Percentage of successful executions
- **Average Duration**: Mean execution time
- **Improvement Rate**: Learning progress percentage
- **Convergence**: Solution stability measure

### Optimization Metrics
- **Exploration Rate**: Novel strategy discovery rate
- **Exploitation Rate**: Known strategy refinement rate
- **Resource Utilization**: Concurrent execution efficiency
- **Memory Efficiency**: Data storage optimization

## Best Practices

### 1. Start with Validation
Always run metrics validator before starting optimization:
```bash
npm run tsx examples/self-learning/metrics-validator.ts
```

### 2. Monitor Memory Bank
Check memory bank growth and consolidate periodically:
```bash
# View memory bank stats
cat examples/data/memory-bank.json | jq '.totalSessions, (.learnings | length)'
```

### 3. Adjust Swarm Sizes
Balance between exploration and resource usage:
- **Small (4-8)**: Quick iterations, less exploration
- **Medium (8-16)**: Balanced performance
- **Large (16-32)**: Thorough exploration, longer runtime

### 4. Review Reports
Check generated reports for insights:
```bash
# Latest optimization report
cat examples/data/optimization-report.md

# Latest validation report
ls -t examples/data/validation/*.md | head -1 | xargs cat
```

### 5. Use Master Orchestrator
For complete end-to-end optimization:
```bash
npm run tsx examples/self-learning/master-orchestrator.ts
```

## OpenRouter Integration

### Setup
1. Get API key from [openrouter.ai](https://openrouter.ai)
2. Set environment variable:
```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

### Model Selection
Choose models based on task requirements:
- **Fast exploration**: gemini-2.0-flash-thinking-exp:free
- **Deep reasoning**: deepseek-r1-0528:free
- **Quality results**: claude-sonnet-4
- **Balanced**: gpt-4-turbo-preview

## Troubleshooting

### Issue: Validation Fails
**Solution:** Run validator in verbose mode:
```bash
npm run tsx examples/self-learning/metrics-validator.ts 2>&1 | tee validation.log
```

### Issue: Memory Bank Corruption
**Solution:** Backup and reset:
```bash
cp examples/data/memory-bank.json examples/data/memory-bank.backup.json
echo '{"version":"1.0.0","lastUpdated":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","totalSessions":0,"learnings":[],"optimizationHistory":[]}' > examples/data/memory-bank.json
```

### Issue: Swarms Not Executing
**Solution:** Check dependencies:
```bash
npm install agentdb agentic-flow @modelcontextprotocol/sdk
```

### Issue: OpenRouter Timeout
**Solution:** Increase timeout in settings.json:
```json
{
  "openrouter": {
    "timeout": 180000
  }
}
```

## Examples

### Example 1: Quick Benchmark
```bash
# Run quick benchmark optimization
npm run tsx examples/self-learning/benchmark-optimizer.ts 8 5
```

### Example 2: Extended Navigation Learning
```bash
# Run 50 navigation tasks
npm run tsx examples/self-learning/self-improving-navigator.ts 50
```

### Example 3: Full Orchestration
```bash
# Run complete optimization pipeline
npm run tsx examples/self-learning/master-orchestrator.ts
```

### Example 4: Parallel Multi-Task
```bash
# Execute multiple tasks concurrently
npm run tsx examples/self-learning/parallel-swarm-executor.ts 12
```

## Performance Tips

1. **Cache Results**: Enable result caching in memory bank
2. **Batch Processing**: Use parallel executor for multiple tasks
3. **Adaptive Parameters**: Let optimization loop adjust settings
4. **Regular Consolidation**: Consolidate memory bank every 100 sessions
5. **Monitor Resources**: Track CPU and memory usage

## Contributing

When adding new self-learning components:

1. Follow the existing architecture pattern
2. Integrate with memory bank
3. Add validation support
4. Update master orchestrator
5. Document configuration options
6. Add usage examples

## License

Part of the Agentic Robotics project. See main LICENSE file.

## Support

For issues or questions:
- Check validation reports
- Review memory bank logs
- Consult optimization reports
- Enable debug logging

---

**Version**: 1.0.0
**Last Updated**: 2025-01-17
**Status**: Production Ready

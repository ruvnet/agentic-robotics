/**
 * @agentic-robotics/self-learning
 * Self-learning optimization system with swarm intelligence
 */

// Core Optimizers
export { BenchmarkOptimizer, BenchmarkConfig, BenchmarkResult } from './benchmark-optimizer';
export { SelfImprovingNavigator } from './self-improving-navigator';
export { SelfLearningSwarmOrchestrator } from './swarm-orchestrator';
export { ParallelSwarmExecutor, SwarmTask } from './parallel-swarm-executor';
export { MultiObjectiveOptimizer } from './advanced-multi-objective-optimizer';

// Validation and Metrics
export { MetricsValidator } from './metrics-validator';
export { MasterOrchestrator } from './master-orchestrator';

// Monitoring and Integration
export { PerformanceMonitor } from './performance-monitor';
export { IntegrationAdapter } from './integration-adapter';

// Re-export types
export type {
  SwarmConfig,
  SwarmResult,
  OptimizationMetrics
} from './swarm-orchestrator';

export type {
  Individual,
  ParetoFront
} from './advanced-multi-objective-optimizer';

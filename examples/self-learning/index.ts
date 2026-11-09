/**
 * @agentic-robotics/self-learning
 * Self-learning optimization system with swarm intelligence
 */

// Core Optimizers
export { BenchmarkOptimizer, BenchmarkConfig, BenchmarkResult } from './benchmark-optimizer.js';
export { SelfImprovingNavigator } from './self-improving-navigator.js';
export { SelfLearningSwarmOrchestrator } from './swarm-orchestrator.js';
export { ParallelSwarmExecutor, SwarmTask } from './parallel-swarm-executor.js';
export { MultiObjectiveOptimizer } from './advanced-multi-objective-optimizer.js';

// Validation and Metrics
export { MetricsValidator } from './metrics-validator.js';
export { MasterOrchestrator } from './master-orchestrator.js';

// Monitoring and Integration
export { PerformanceMonitor } from './performance-monitor.js';
export { IntegrationAdapter } from './integration-adapter.js';

// Re-export types
export type {
  SwarmConfig,
  SwarmResult,
  OptimizationMetrics
} from './swarm-orchestrator.js';

export type {
  Individual,
  ParetoFront
} from './advanced-multi-objective-optimizer.js';

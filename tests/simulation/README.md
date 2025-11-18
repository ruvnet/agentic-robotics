# Robot Simulation Test Suite

Comprehensive test coverage for the agentic robotics simulation system.

## Test Structure

### 1. Physics Engine Tests (`physics-engine.test.ts`)
- **Body Management**: Adding, removing, and tracking rigid bodies
- **Gravity Simulation**: Earth, Moon, and zero-gravity environments
- **Collision Detection**: Sphere-sphere collisions, penetration depth
- **Collision Resolution**: Impulse response, momentum conservation
- **Force Application**: Dynamic force calculations, mass scaling
- **Performance**: Handles 100+ bodies efficiently

**Coverage**: Physics calculations, collision algorithms, constraint solving

### 2. Robot Simulation Tests (`robot-simulation.test.ts`)
- **Initialization**: Robot state, configuration, positioning
- **Basic Movement**: Path following, target reaching, speed limits
- **Path Following**: Multi-waypoint navigation, sequential execution
- **Obstacle Avoidance**: Sensor-based detection, collision prevention
- **Battery Management**: Energy consumption, depletion handling
- **Orientation Control**: Heading updates, smooth rotation

**Coverage**: Robot behavior, control systems, navigation algorithms

### 3. Sensor Simulation Tests (`sensor-simulation.test.ts`)
- **Distance Sensors**: Range measurements, noise modeling
- **LIDAR**: 360° scanning, obstacle detection, intensity mapping
- **IMU**: Acceleration, gyroscope, bias modeling, calibration
- **GPS**: Position accuracy, noise characteristics
- **Sensor Fusion**: Multi-sensor integration
- **Performance**: High-frequency readings, efficient processing

**Coverage**: Sensor accuracy, noise models, data fusion

### 4. Training System Tests (`training-system.test.ts`)
- **Q-Learning Agent**: Policy learning, exploration vs exploitation
- **Experience Replay**: Buffer management, batch sampling
- **Grid World Environment**: State transitions, reward functions
- **Training Manager**: Episode execution, metric tracking
- **Convergence**: Policy optimization, performance improvement
- **Model Persistence**: Save/load trained policies

**Coverage**: Reinforcement learning, training algorithms, policy optimization

### 5. Multi-Robot Tests (`multi-robot.test.ts`)
- **Communication**: Message passing, broadcasting, latency
- **Collision Avoidance**: Inter-robot detection, repulsive forces
- **Task Allocation**: Assignment strategies, priority handling
- **Swarm Coordination**: Multi-robot workflows, task distribution
- **Formation Control**: Relative positioning, group behavior

**Coverage**: Multi-agent coordination, distributed control, task allocation

### 6. Performance Tests (`performance.test.ts`)
- **Execution Time**: Benchmark measurements, throughput testing
- **Memory Usage**: Heap profiling, leak detection
- **Scalability**: Linear/quadratic complexity analysis
- **Frame Rate**: Real-time performance, 30+ FPS targets
- **Stress Testing**: Large-scale simulations, burst operations

**Coverage**: Performance metrics, resource utilization, scalability

### 7. Integration Tests (`integration.test.ts`)
- **Simulation Lifecycle**: Initialize, start, stop, reset
- **Robot Management**: Add/remove robots, fleet coordination
- **Task Execution**: Assignment, completion, event tracking
- **Complete Scenarios**: Pickup/delivery, patrol, emergency stop
- **Error Handling**: Invalid inputs, state recovery
- **Long-term Stability**: Extended simulation runs

**Coverage**: End-to-end workflows, system integration, error handling

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test physics-engine
npm test robot-simulation
npm test sensor-simulation
npm test training-system
npm test multi-robot
npm test performance
npm test integration
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm run test:watch
```

### Run Performance Benchmarks
```bash
npm run test:perf
```

## Coverage Requirements

- **Statements**: 90%+
- **Branches**: 90%+
- **Functions**: 90%+
- **Lines**: 90%+

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)
- Environment: Node.js
- Coverage Provider: v8
- Reporters: verbose, json, html
- Timeout: 30 seconds
- Concurrency: 5 threads

### Mock Strategy
- External dependencies mocked
- Sensor noise simulated
- Time-based operations controlled
- Network latency configurable

## Performance Targets

### Physics Engine
- 100 bodies: <1 second per 60 frames
- 1000 bodies: <5 seconds per 100 frames
- Collision detection: 50+ checks/second

### Robot Simulation
- Frame rate: 30+ FPS
- Response time: <100ms per update
- Path planning: 100+ paths/second

### Multi-Robot Coordination
- 10 robots: Real-time performance
- Communication latency: Configurable (0-1000ms)
- Task allocation: <10ms per assignment

## Best Practices

### Writing Tests
1. **Arrange-Act-Assert**: Clear test structure
2. **Isolation**: No dependencies between tests
3. **Descriptive Names**: Explain what and why
4. **Edge Cases**: Test boundaries and limits
5. **Performance**: Measure and validate speed

### Mocking
- Mock external I/O (network, file system)
- Control time-based operations
- Simulate sensor noise realistically
- Use dependency injection

### Performance Testing
- Measure execution time consistently
- Track memory usage and leaks
- Test scalability across sizes
- Validate real-time requirements

## Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Release tags

CI pipeline includes:
1. Unit tests
2. Integration tests
3. Coverage analysis
4. Performance benchmarks
5. Linting and type checking

## Debugging Tests

### Run Single Test
```bash
npm test -- --reporter=verbose integration.test.ts
```

### Debug with Breakpoints
```bash
node --inspect-brk node_modules/.bin/vitest run integration.test.ts
```

### View Coverage Report
```bash
npm run test:coverage
open coverage/index.html
```

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Achieve 90%+ coverage
3. Add performance benchmarks
4. Update this documentation
5. Run full test suite before PR

## Support

For issues or questions:
- GitHub Issues: https://github.com/ruvnet/agentic-robotics/issues
- Documentation: /docs/testing.md

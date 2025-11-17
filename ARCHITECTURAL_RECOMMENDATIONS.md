# Architectural Recommendations & Solutions

## Problem Statement

The current implementation conflates two fundamentally different requirements:

1. **Soft Real-Time** (10-100Hz, 10-100ms deadlines): Tokio can handle
2. **Hard Real-Time** (1kHz+, <1ms deadlines): Requires RTIC/bare-metal

Current implementation tries to do both with Tokio alone, which fails for (2).

---

## Recommended Architecture

### Split Architecture: Soft-RT + Hard-RT Paths

```
┌─────────────────────────────────────────────────────┐
│           agentic-robotics-rt                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Soft Real-Time Path (Current Tokio)          │  │
│  │ • 10-100Hz scheduling                        │  │
│  │ • 10-100ms deadlines                         │  │
│  │ • Linux/macOS/Windows compatible             │  │
│  │ • Good for high-level planning               │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Hard Real-Time Path (RTIC - Optional)        │  │
│  │ • 1-10kHz scheduling                         │  │
│  │ • <1ms deadlines                             │  │
│  │ • Embedded + Linux rt-preempt                │  │
│  │ • Critical control loops                     │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘

    │                          │
    v (async)                  v (interrupt-driven)
┌──────────────────┐      ┌──────────────────┐
│ Tokio Runtime    │      │ RTIC Runtime     │
│ (Linux)          │      │ (Embedded)       │
└──────────────────┘      └──────────────────┘
```

### Implementation Strategy

#### Phase 1: Fix Current Soft-RT Path (2 weeks)

```rust
// 1. Make PriorityScheduler actually used
pub struct ROS3Executor {
    tokio_rt: Runtime,
    priority_queues: [VecDeque<Task>; 5],  // By priority
    active_tasks: HashMap<u64, JoinHandle>,
}

// 2. Actually use the scheduler
pub async fn spawn_rt<F>(&self, priority: Priority, task: F) {
    let task_id = self.schedule(priority);
    
    // Dispatch from queue in priority order
    while let Some(task) = self.next_task() {
        self.tokio_rt.spawn(task);
    }
}

// 3. Implement deadline tracking
struct ScheduledTask {
    id: u64,
    priority: Priority,
    deadline: Instant,
    task: Box<dyn Future>,
    start_time: Instant,
}

impl ScheduledTask {
    fn check_deadline(&self) {
        let elapsed = self.start_time.elapsed();
        if elapsed > self.deadline.0 {
            tracing::warn!("Task {} missed deadline: {:?} vs {:?}", 
                self.id, self.deadline.0, elapsed);
        }
    }
}
```

**Effort**: 2-3 weeks  
**Impact**: Makes soft-RT path actually work for 10-100Hz  
**Risk**: Low - improves on existing code

---

#### Phase 2: Add Hard-RT Path with RTIC (4 weeks)

```rust
#[cfg(feature = "hard-rt")]
pub mod hard_rt {
    use rtic::prelude::*;
    
    // RTIC provides guaranteed hard real-time:
    // - Hardware priority levels
    // - Automatic stack isolation
    // - Interrupt-driven scheduling
    // - Priority inheritance built-in
    
    #[rtic::app(device = stm32f4xx_hal::pac)]
    mod app {
        #[shared]
        struct Shared {
            // State accessible from tasks
        }
        
        #[local]
        struct Local {
            // Per-task state
        }
        
        #[init]
        fn init(cx: init::Context) -> (Shared, Local) {
            // Initialize hardware
            (Shared {}, Local {})
        }
        
        #[task(priority = 2)]  // Higher = more critical
        fn control_loop(cx: control_loop::Context) {
            // Guaranteed to run on priority 2 without interference
            // Interrupt-driven, no task spawning overhead
        }
    }
}
```

**Feature Flag**:
```toml
[features]
soft-rt = []  # Default - Tokio based
hard-rt = ["rtic"]  # Optional - RTIC based
```

**Effort**: 3-4 weeks  
**Impact**: Enables true hard real-time for embedded  
**Risk**: Medium - RTIC has different model

---

#### Phase 3: Embedded Platform Support (2-3 weeks)

```rust
#[cfg(all(feature = "hard-rt", target_vendor = "stm32"))]
pub mod stm32_support {
    use stm32f4xx_hal::prelude::*;
    
    pub struct STM32Config {
        pub device: Stm32Device,
        pub clock_hz: u32,
        pub tick_rate_hz: u32,
    }
    
    pub fn init(config: STM32Config) -> Result<RtContext> {
        // Initialize clocks, interrupts, etc.
        // Set up timer for tick generation
        Ok(RtContext::new(config))
    }
}

#[cfg(all(feature = "hard-rt", target_vendor = "esp"))]
pub mod esp_support {
    use esp_hal::prelude::*;
    
    // Similar for ESP32
}
```

**Effort**: 2-3 weeks per platform  
**Impact**: Real embedded deployment  
**Risk**: Low - encapsulated per platform

---

## Code Migration Guide

### Current (Broken):

```rust
// This doesn't actually work:
let executor = ROS3Executor::new()?;

executor.spawn_rt(
    Priority::High,
    Deadline::from_hz(1000),  // 1ms
    async {
        loop {
            // Supposed to run at 1kHz
            // Actually: non-deterministic timing
            critical_control_loop().await;
        }
    }
)?;
```

### After Phase 1 (Soft-RT Fixed):

```rust
// Works for 10-100Hz
let executor = ROS3Executor::new()?;

executor.spawn_rt(
    Priority::High,
    Deadline::from_hz(100),  // 10ms - realistic
    async {
        loop {
            sensor_fusion().await;  // 10-100ms task
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }
)?;
```

**Benefits**:
- Scheduler actually used
- Priority respected
- Deadline miss warnings logged
- Predictable behavior for soft-RT

### After Phase 2 (Hard-RT Added):

```rust
#[cfg(feature = "hard-rt")]
#[rtic::app(device = stm32f4xx_hal::pac)]
mod app {
    #[task(priority = 3)]  // Critical
    fn motor_control(cx: motor_control::Context) {
        // Guaranteed <10µs latency
        // 1kHz reliable timing
        // Hardware interrupt priority
    }
    
    #[task(priority = 2)]
    fn sensor_read(cx: sensor_read::Context) {
        // High priority but not critical
        // <100µs latency
    }
}

#[cfg(not(feature = "hard-rt"))]
async fn motor_control() {
    // Fallback for development on desktop
    // Uses soft-RT path
}
```

**Benefits**:
- True hard real-time on embedded
- RTIC's interrupt-driven model
- No deadline misses
- Deterministic 1kHz+

---

## Fix Priority Matrix

### Critical Fixes (Blocking Production)

```rust
// FIX 1: Update Documentation
pub const WARNING: &str = "
⚠️  IMPORTANT LIMITATIONS:
- Not suitable for hard real-time < 10ms deadlines
- Uses Tokio async runtime (non-deterministic)
- For hard real-time, use RTIC integration (feature = \"hard-rt\")
";

// FIX 2: Connect Scheduler to Executor
pub fn spawn_rt<F>(&self, priority: Priority, task: F) {
    let task_id = {
        let mut scheduler = self.scheduler.lock();
        scheduler.schedule(priority, task)  // ← Actually use scheduler
    };
    
    self.tokio_rt.spawn(async move {
        // Run task, checking deadline
        task.await;
        
        // Check if missed deadline
        if Instant::now() > deadline {
            tracing::warn!("Task {} missed deadline", task_id);
        }
    });
}

// FIX 3: Fix Silent Measurement Loss
pub fn record(&self, duration: Duration) {
    match self.histogram.try_lock() {
        Some(mut hist) => {
            let _ = hist.record(duration.as_micros() as u64);
        }
        None => {
            tracing::warn!("Latency measurement dropped (contention)");
            // Consider: atomic-based fallback
        }
    }
}

// FIX 4: Remove Fake Feature Flags
// Either remove from Cargo.toml or implement them:
#[cfg(feature = "embassy")]
mod embassy_support { /* full implementation */ }

#[cfg(feature = "rtic")]
mod rtic_support { /* full implementation */ }
```

### Should Fix (High Priority)

```rust
// FIX 5: CPU Affinity
#[cfg(target_os = "linux")]
pub fn set_cpu_affinity(threads: &[thread::JoinHandle], cores: &[u32]) {
    use thread_affinity::ThreadAffinity;
    
    for thread in threads {
        thread.set_affinity(cores)?;
    }
}

// FIX 6: Priority Inheritance
pub fn spawn_with_inheritance<F>(&self, priority: Priority, task: F) {
    // Track blocking relationships
    // When low-pri task holds lock, boost priority
    
    let task_priority = priority;
    let lock_holders = Arc::new(Mutex::new(HashMap::new()));
    
    // Boost priority if holding lock high-pri task needs
    let effective_priority = self.compute_inherited_priority(task_priority, &lock_holders);
    
    self.tokio_rt.spawn(async move {
        task.await;
    });
}

// FIX 7: Deadline Miss Callbacks
pub type DeadlineCallback = Box<dyn Fn(u64, Duration, Duration) + Send + Sync>;

pub struct ROS3Executor {
    // ...
    deadline_policy: DeadlinePolicy,
}

pub enum DeadlinePolicy {
    Warn,  // Log warning
    Panic, // Panic on miss
    Callback(DeadlineCallback),
}

impl ROS3Executor {
    fn check_deadline(&self, task_id: u64, deadline: Duration, elapsed: Duration) {
        if elapsed > deadline {
            match &self.deadline_policy {
                DeadlinePolicy::Warn => {
                    tracing::warn!("Task {} missed deadline", task_id);
                }
                DeadlinePolicy::Panic => {
                    panic!("Task {} missed deadline", task_id);
                }
                DeadlinePolicy::Callback(cb) => {
                    cb(task_id, deadline, elapsed);
                }
            }
        }
    }
}
```

---

## Testing Strategy

### Phase 1: Soft-RT Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_priority_ordering() {
        let executor = ROS3Executor::new().unwrap();
        let execution_order = Arc::new(Mutex::new(Vec::new()));
        
        // Spawn in mixed order
        executor.spawn_low(async { execution_order.lock().push(1); });
        executor.spawn_high(async { execution_order.lock().push(2); });
        executor.spawn_low(async { execution_order.lock().push(3); });
        
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Should execute in priority order
        let order = execution_order.lock();
        assert!(order[0] == 2);  // High first
    }
    
    #[tokio::test]
    async fn test_deadline_miss_detection() {
        let executor = ROS3Executor::new().unwrap();
        
        executor.spawn_rt(
            Priority::High,
            Deadline(Duration::from_millis(10)),
            async {
                // Takes longer than deadline
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        );
        
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Should have logged deadline miss
        // (verify with test logger)
    }
}
```

### Phase 2: Hard-RT Testing

```rust
#[cfg(all(test, feature = "hard-rt"))]
mod rtic_tests {
    #[test]
    fn test_deterministic_timing() {
        // RTIC guarantees vs. measured timing
        // Should see <10µs jitter
    }
    
    #[test]
    fn test_interrupt_priority() {
        // Verify higher priority interrupt preempts lower
    }
}
```

---

## Migration Checklist

### Week 1-2: Documentation & Cleanup
- [ ] Update all README files
- [ ] Add warning to rt crate
- [ ] Remove/disable fake features (embassy, rtic)
- [ ] Fix anyhow dependency in embedded crate

### Week 3-4: Connect Scheduler
- [ ] Modify executor to use PriorityScheduler
- [ ] Implement deadline tracking
- [ ] Add deadline miss callbacks
- [ ] Fix latency measurement
- [ ] Add CPU affinity support

### Week 5-6: Hard-RT Foundation
- [ ] Create hard-rt feature flag
- [ ] Add RTIC dependency (optional)
- [ ] Implement basic RTIC integration
- [ ] Add first platform example (STM32F4)

### Week 7-8: Platform Support
- [ ] Add ESP32 support
- [ ] Add nRF support
- [ ] Add RP2040 support
- [ ] Create deployment guides

---

## Risk Mitigation

### Risk 1: Breaking Change

**Problem**: Fixing scheduler changes executor API

**Mitigation**:
```rust
// Add compatibility layer
impl ROS3Executor {
    // Old broken API (deprecated)
    #[deprecated = "Use spawn_rt_proper() instead"]
    pub fn spawn_rt(&self, priority: Priority, task: F) {
        self.spawn_rt_proper(priority, Deadline(Duration::MAX), task)
    }
    
    // New fixed API
    pub fn spawn_rt_proper(&self, priority: Priority, deadline: Deadline, task: F) {
        // ... proper implementation
    }
}
```

### Risk 2: Hard-RT Complexity

**Problem**: RTIC has different programming model

**Mitigation**:
- Keep both paths available
- Clear documentation which to use
- Wrapper libraries for common patterns
- Example code for both paths

### Risk 3: Platform Fragmentation

**Problem**: Different code per platform

**Mitigation**:
- Use feature flags (stm32, esp32, nrf, rp2040)
- Create trait for platform abstraction
- Share logic where possible

---

## Conclusion

The recommended approach:

1. **Phase 1**: Fix soft-RT path for 10-100Hz (realistic for Tokio)
2. **Phase 2**: Add optional hard-RT with RTIC (for embedded/critical)
3. **Phase 3**: Platform-specific implementations (as needed)
4. **Phase 4**: Production hardening (safety, verification)

This maintains backward compatibility while providing a clear upgrade path to hard real-time.


# Production Readiness Checklist

Use this checklist to track fixes needed before production deployment.

## CRITICAL FIXES (Must Complete)

- [ ] **Issue #1: Broken Pub/Sub Architecture**
  - [ ] Integrate Zenoh middleware with Publisher
  - [ ] Connect Publisher to Zenoh put/delete
  - [ ] Connect Subscriber to Zenoh get/subscribe
  - [ ] Write end-to-end test: pub message → sub receives
  - [ ] Effort: 4-8 hours
  - Files: `publisher.rs`, `subscriber.rs`, `middleware.rs`

- [ ] **Issue #2: Async/Sync API Mismatch**
  - [ ] Either remove `async` from Publisher::publish() OR
  - [ ] Migrate to true async channels (tokio::sync::mpsc)
  - [ ] Remove spawn_blocking from Subscriber::recv_async()
  - [ ] Add tokio::time::timeout support
  - [ ] Effort: 2-4 hours
  - Files: `publisher.rs`, `subscriber.rs`

- [ ] **Issue #3: Unbounded Channels**
  - [ ] Replace crossbeam::channel::unbounded() with bounded
  - [ ] Add configurable capacity parameter
  - [ ] Implement backpressure handling (drop/block)
  - [ ] Add channel occupancy to stats
  - [ ] Stress test: 1M messages with slow consumer
  - [ ] Effort: 3-6 hours
  - Files: `subscriber.rs`

- [ ] **Issue #4: rkyv Serialization**
  - [ ] Option A: Implement actual rkyv serialization
    - [ ] Derive Archive, Serialize, Deserialize on message types
    - [ ] Implement serialize_rkyv properly
    - [ ] Add rkyv benchmarks
  - [ ] Option B: Remove from API
    - [ ] Delete serialize_rkyv function
    - [ ] Remove Format::Rkyv variant
    - [ ] Update documentation
  - [ ] Effort: 2-4 hours (implement) or 30 min (remove)
  - Files: `serialization.rs`, `message.rs`

- [ ] **Issue #5: Non-Compiling Benchmarks**
  - [ ] Update pubsub_latency.rs to use Format enum
  - [ ] Add missing fields to message types OR fix benchmarks
  - [ ] Ensure `cargo bench` completes without errors
  - [ ] Collect baseline performance metrics
  - [ ] Effort: 2-3 hours
  - Files: `benchmarks/pubsub_latency.rs`, `benchmarks/message_serialization.rs`

## HIGH-PRIORITY FIXES (Strongly Recommended)

- [ ] **Issue #6: Double Serialization in JSON**
  - [ ] Use serde_json::to_vec() directly
  - [ ] Remove intermediate String allocation
  - [ ] Update Node bindings to work with bytes directly
  - [ ] Effort: 1-2 hours
  - Files: `serialization.rs`, `node/lib.rs`

- [ ] **Issue #7: String-based JavaScript API**
  - [ ] Redesign NAPI bindings to accept typed objects
  - [ ] Generate TypeScript types from Rust message types
  - [ ] Remove JSON string marshaling
  - [ ] Add integration tests with TypeScript
  - [ ] Effort: 3-4 hours
  - Files: `node/lib.rs`, generate TypeScript types

- [ ] **Issue #8: HashMap List Allocation**
  - [ ] Cache list_publishers() and list_subscribers() results
  - [ ] Implement cache invalidation on add/remove
  - [ ] OR provide iterator instead of Vec
  - [ ] Effort: 2-3 hours
  - Files: `node/lib.rs`

- [ ] **Issue #9: Lock Contention in Bindings**
  - [ ] Use non-fair Mutex or separate insert logic
  - [ ] Avoid holding lock across await points
  - [ ] Add concurrent publisher creation test
  - [ ] Effort: 2-3 hours
  - Files: `node/lib.rs`

- [ ] **Issue #10: Serializer Wrapper Overhead**
  - [ ] Store Format directly instead of Serializer
  - [ ] Match on format at runtime only when needed
  - [ ] Effort: 1-2 hours
  - Files: `publisher.rs`

## MEDIUM-PRIORITY IMPROVEMENTS

- [ ] **Issue #11: String Cloning in Accessors**
  - [ ] Return &str where possible (may need NAPI workaround)
  - [ ] Document NAPI string allocation overhead
  - [ ] Effort: 1 hour
  - Files: `node/lib.rs`

- [ ] **Issue #12: Stats Lock Optimization**
  - [ ] Replace RwLock with AtomicU64 for stats
  - [ ] Eliminate lock contention on high-frequency publish
  - [ ] Effort: 1-2 hours
  - Files: `publisher.rs`, `service.rs`

- [ ] **Issue #13: Standardize Lock Types**
  - [ ] Choose parking_lot::RwLock or tokio::sync::RwLock
  - [ ] Apply consistently across codebase
  - [ ] Effort: 1 hour
  - Files: `publisher.rs`, `service.rs`, `node/lib.rs`

- [ ] **Issue #14: Add Timeout Support**
  - [ ] Add recv_with_timeout() methods
  - [ ] Use tokio::time::timeout
  - [ ] Update Node bindings
  - [ ] Effort: 2-3 hours
  - Files: `subscriber.rs`, `node/lib.rs`

- [ ] **Issue #15: Event Callback Support**
  - [ ] Implement callback registration for JavaScript
  - [ ] Emit events when messages arrive
  - [ ] Support traditional event emitter pattern
  - [ ] Effort: 3-4 hours
  - Files: `node/lib.rs`, TypeScript definitions

## TESTING REQUIREMENTS

- [ ] **Unit Tests**
  - [ ] All publishers/subscribers in isolation
  - [ ] All serialization formats
  - [ ] All error conditions

- [ ] **Integration Tests**
  - [ ] Message round-trip (pub → sub)
  - [ ] Multiple publishers to single subscriber
  - [ ] Multiple subscribers to single publisher
  - [ ] Mixed async/sync usage

- [ ] **Performance Tests**
  - [ ] Baseline benchmarks with cargo bench
  - [ ] Compare CDR vs JSON vs rkyv
  - [ ] Measure serialization throughput
  - [ ] Measure publish/subscribe latency

- [ ] **Concurrency Tests**
  - [ ] Concurrent publishers test
  - [ ] Concurrent subscribers test
  - [ ] Lock contention measurement
  - [ ] High-frequency stress test (10K msg/sec)

- [ ] **Memory Tests**
  - [ ] Valgrind for memory leaks
  - [ ] Heap profiling under high load
  - [ ] Channel capacity limits test
  - [ ] Long-running stability test

- [ ] **Real-World Tests**
  - [ ] JavaScript/TypeScript integration
  - [ ] npm package installation and use
  - [ ] Performance under realistic workloads
  - [ ] Behavior with real Zenoh deployments

## DOCUMENTATION UPDATES

- [ ] [ ] Update README with current limitations
- [ ] [ ] Document all supported serialization formats
- [ ] [ ] Add architecture diagrams
- [ ] [ ] Add API reference with examples
- [ ] [ ] Add performance characteristics
- [ ] [ ] Document thread-safety guarantees
- [ ] [ ] Update CHANGELOG with fixes

## DEPLOYMENT READINESS

- [ ] All CRITICAL issues fixed ✓
- [ ] All HIGH issues fixed ✓
- [ ] All tests passing ✓
- [ ] Benchmarks run successfully ✓
- [ ] Performance meets targets ✓
- [ ] Memory leak tests pass ✓
- [ ] Documentation complete ✓
- [ ] Code review approved ✓
- [ ] Security audit passed ✓
- [ ] Load testing passed ✓

## EFFORT ESTIMATION

**Quick Wins (12 hours total)**:
1. Remove JSON string marshaling (2 hrs)
2. Switch to atomic stats (1 hr)
3. Fix benchmark compilation (2 hrs)
4. Add channel capacity config (3 hrs)
5. Replace unbounded channels (4 hrs)

**Critical Path (20-35 hours)**:
1. Implement pub/sub with Zenoh (8 hrs)
2. Fix async/sync API (4 hrs)
3. Implement rkyv or remove (2-4 hrs)
4. Fix benchmarks (2-3 hrs)
5. Redesign JS API (3-4 hrs)

**Full Production Release (50-80 hours)**:
- All critical + high priority fixes
- Comprehensive testing
- Performance optimization
- Documentation
- Code review and polish

## Timeline Estimates

| Phase | Duration | Priority |
|-------|----------|----------|
| Quick wins | 12-15 hrs | ASAP |
| Critical fixes | 20-35 hrs | Week 1 |
| High-priority | 10-20 hrs | Week 2 |
| Testing | 20-30 hrs | Week 2-3 |
| Documentation | 5-10 hrs | Week 3 |
| **Total MVP** | **40-60 hrs** | **By Week 3** |
| Hardening | 40-50 hrs | Week 4-5 |
| **Total Production** | **100+ hrs** | **By Week 5-6** |

## Sign-Off

- [ ] Reviewed by: _________________
- [ ] Approved for production: _________________
- [ ] Date: _________________
- [ ] Next review date: _________________


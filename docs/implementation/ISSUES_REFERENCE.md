# Issue Reference Guide - Agentic Robotics Technical Review

Quick lookup table for all identified issues with file:line references and fix recommendations.

## CRITICAL Issues (Block Production Use)

### Issue #1: Broken Pub/Sub Architecture
- **Severity**: CRITICAL
- **Component**: Pub/Sub Message Passing
- **Files**: 
  - `crates/agentic-robotics-core/src/publisher.rs:42-54`
  - `crates/agentic-robotics-core/src/subscriber.rs:14,23`
- **Problem**: Publishers and subscribers are completely disconnected. No messages are delivered.
- **Root Cause**: Publisher.publish() serializes but never sends; Subscriber has unbounded channel with no connected publisher
- **Current Code**:
  ```rust
  // publisher.rs:42-54
  pub async fn publish(&self, msg: &T) -> Result<()> {
      let bytes = self.serializer.serialize(msg)?;
      // ... update stats ...
      Ok(())  // <- Message is lost, never sent anywhere!
  }
  ```
- **Fix Required**: Integrate Zenoh middleware for actual message delivery
- **Effort**: 4-8 hours
- **Test**: End-to-end message delivery test

---

### Issue #2: Misleading Async API
- **Severity**: CRITICAL
- **Component**: Pub/Sub Message Passing  
- **Files**:
  - `crates/agentic-robotics-core/src/publisher.rs:42`
  - `crates/agentic-robotics-core/src/subscriber.rs:49-57`
- **Problem**: Methods marked `async` don't actually await operations, violating Rust conventions
- **Root Cause**: Publisher::publish() does synchronous CPU work; Subscriber::recv_async() wraps blocking call in spawn_blocking
- **Current Code**:
  ```rust
  // publisher.rs:42
  pub async fn publish(&self, msg: &T) -> Result<()> {
      let bytes = self.serializer.serialize(msg)?;  // <- Sync CPU work
      Ok(())  // <- No await points
  }
  
  // subscriber.rs:49-57  
  pub async fn recv_async(&self) -> Result<T> {
      let receiver = self.receiver.clone();
      tokio::task::spawn_blocking(move || {
          receiver.recv()  // <- Blocks threadpool
      })
      .await
  }
  ```
- **Fix Required**: Either make sync methods or use true async channels (tokio::sync::mpsc)
- **Effort**: 2-4 hours
- **Test**: Check tokio threadpool utilization doesn't spike

---

### Issue #3: Unbounded Channel Memory Risk
- **Severity**: CRITICAL
- **Component**: Memory Management
- **Files**: `crates/agentic-robotics-core/src/subscriber.rs:23`
- **Problem**: Channels can grow unbounded, causing OOM under backpressure
- **Root Cause**: Using `channel::unbounded()` with no capacity limits or backpressure handling
- **Current Code**:
  ```rust
  let (sender, receiver) = channel::unbounded();  // <- NO SIZE LIMIT
  ```
- **Scenario**: 1000 subscribers with slow receiver + high-frequency publisher = heap exhaustion
- **Fix Required**: Replace with bounded channels, implement backpressure
- **Effort**: 3-6 hours
- **Test**: Stress test with 1M messages, monitor heap growth

---

### Issue #4: Unimplemented rkyv Serialization
- **Severity**: CRITICAL
- **Component**: Serialization Performance
- **Files**: `crates/agentic-robotics-core/src/serialization.rs:33-40`
- **Problem**: Module claims zero-copy support but unconditionally returns error
- **Root Cause**: Stub implementation that was never completed
- **Current Code**:
  ```rust
  pub fn serialize_rkyv<T>(_msg: &T) -> Result<Vec<u8>>
  where
      T: Serialize,
  {
      Err(Error::Serialization("rkyv serialization not fully implemented".to_string()))
  }
  ```
- **Impact**: Misleads users; benchmarks can't test zero-copy path
- **Fix Required**: Implement actual rkyv serialization or remove from docs
- **Effort**: 2-4 hours to implement, 30 min to remove
- **Test**: Benchmark zero-copy vs CDR performance

---

### Issue #5: Non-Compiling Benchmarks  
- **Severity**: CRITICAL
- **Component**: Serialization/Testing
- **Files**: `crates/agentic-robotics-benchmarks/benches/pubsub_latency.rs:15,31`
- **Problem**: Benchmarks reference wrong API (Serializer::Cdr vs Format::Cdr)
- **Root Cause**: API changed but benchmarks not updated
- **Current Code**:
  ```rust
  // Benchmark uses:
  Publisher::<RobotState>::new(topic, Serializer::Cdr)
  
  // But actual API is:
  Publisher::<RobotState>::with_format(topic, Format::Cdr)
  ```
- **Impact**: Cannot measure performance; no benchmark data
- **Fix Required**: Fix benchmark code to match actual API
- **Effort**: 2-3 hours
- **Test**: `cargo bench` should complete successfully

---

## HIGH-Priority Issues (Prevent Production Deployment)

### Issue #6: Double Serialization in JSON Path
- **Severity**: HIGH
- **Component**: Serialization Performance
- **Files**: 
  - `crates/agentic-robotics-core/src/serialization.rs:68`
  - `crates/agentic-robotics-node/src/lib.rs:106-107,179-180`
- **Problem**: JSON serialization creates intermediate String then converts to bytes
- **Current Code**:
  ```rust
  // serialization.rs:68
  Format::Json => serialize_json(msg).map(|s| s.into_bytes())
  
  // Then in node/lib.rs:106-107
  let value: JsonValue = serde_json::from_str(&data)?  // Parse string
  let json_str = serde_json::to_string(&msg)?  // Make string again
  ```
- **Impact**: 2x allocation, slower JSON handling
- **Fix Required**: Use `serde_json::to_vec()` directly
- **Effort**: 1-2 hours

---

### Issue #7: String-based JavaScript API
- **Severity**: HIGH
- **Component**: API Ergonomics
- **Files**: `crates/agentic-robotics-node/src/lib.rs:105,172`
- **Problem**: Accepts/returns JSON as strings, forcing double serialization on user
- **Current Code**:
  ```rust
  pub async fn publish(&self, data: String) -> Result<()> {
      let value: JsonValue = serde_json::from_str(&data)?;  // Parse again!
  
  pub async fn recv(&self) -> Result<String> {
      let json_str = serde_json::to_string(&msg)?;  // Serialize to string!
  }
  ```
- **TypeScript Usage Impact**:
  ```typescript
  // User must double-serialize:
  await pub.publish(JSON.stringify({x: 1}));
  
  // User must double-deserialize:
  const msg = JSON.parse(await sub.recv());
  ```
- **Fix Required**: Accept/return typed objects via NAPI
- **Effort**: 3-4 hours
- **Test**: TypeScript integration test with typed payloads

---

### Issue #8: Unbounded Vec on Every List Operation
- **Severity**: HIGH
- **Component**: Memory Management
- **Files**: `crates/agentic-robotics-node/src/lib.rs:83,90`
- **Problem**: Allocates new Vec on every list call
- **Current Code**:
  ```rust
  pub async fn list_publishers(&self) -> Vec<String> {
      let publishers = self.publishers.read().await;
      publishers.keys().cloned().collect()  // <- New Vec + String clones
  }
  ```
- **Impact**: With 1000 publishers, each list call allocates 1000 strings
- **Fix Required**: Cache results or use iterator pattern
- **Effort**: 2-3 hours

---

### Issue #9: Lock Contention in Node.js Bindings
- **Severity**: HIGH  
- **Component**: Thread Safety
- **Files**: `crates/agentic-robotics-node/src/lib.rs:19-20,50-51,64-65`
- **Problem**: RwLock held across await points, serializes concurrent operations
- **Current Code**:
  ```rust
  pub async fn create_publisher(&self, topic: String) -> Result<AgenticPublisher> {
      let mut publishers = self.publishers.write().await;  // <- Locked
      publishers.insert(topic.clone(), publisher.clone());  // <- Slow operation
      // Lock potentially held through task yields
  }
  ```
- **Impact**: Concurrent create_publisher calls are serialized
- **Fix Required**: Use non-fair Mutex or separate insert logic
- **Effort**: 2-3 hours
- **Test**: Concurrent publisher creation benchmark

---

### Issue #10: Redundant Serializer Wrapper
- **Severity**: HIGH
- **Component**: Serialization Performance
- **Files**: `crates/agentic-robotics-core/src/publisher.rs:35`
- **Problem**: Format stored but Serializer wrapper created on each publish
- **Current Code**:
  ```rust
  pub fn with_format(topic: impl Into<String>, format: Format) -> Self {
      Self {
          serializer: Serializer::new(format),  // <- Recreated
      }
  }
  ```
- **Impact**: Unnecessary object allocation per publish (though minimal)
- **Fix Required**: Store Format directly, match at runtime
- **Effort**: 1-2 hours

---

## MEDIUM-Priority Issues (Quality & Performance)

### Issue #11: String Cloning in Accessors
- **Files**: `crates/agentic-robotics-node/src/lib.rs:38,119,152`
- **Problem**: Returns String instead of &str
- **Fix**: Return `&str` (NAPI limitation may require workaround)

### Issue #12: No RwLock Fairness for Stats
- **Files**: `crates/agentic-robotics-core/src/publisher.rs:47-49`
- **Problem**: Uses RwLock for stats instead of AtomicU64
- **Fix**: Use `std::sync::atomic` for lock-free stats

### Issue #13: Mixed Lock Types
- **Files**: `crates/agentic-robotics-core/src/` vs `crates/agentic-robotics-node/src/`
- **Problem**: parking_lot::RwLock vs tokio::sync::RwLock used inconsistently
- **Fix**: Standardize on one lock type

### Issue #14: No Timeout Support in recv()
- **Files**: `crates/agentic-robotics-core/src/subscriber.rs:49`
- **Problem**: recv_async() blocks indefinitely
- **Fix**: Add timeout parameter

### Issue #15: No Event Callback Support
- **Files**: `crates/agentic-robotics-node/src/lib.rs`
- **Problem**: Forces polling loops instead of event emitter pattern
- **Fix**: Implement callback registration for JavaScript

---

## LOW-Priority Issues (Nice to Have)

### Issue #16: Stats Overhead
- **Files**: `crates/agentic-robotics-core/src/publisher.rs:37`
- **Problem**: Arc<RwLock> overhead for simple u64+u64
- **Recommendation**: Profile first

### Issue #17: Benchmark Message Type Mismatch  
- **Files**: `crates/agentic-robotics-benchmarks/benches/message_serialization.rs:27-28,48`
- **Problem**: Benchmark uses Pose.frame_id and PointCloud.frame_id but messages don't have these
- **Impact**: Compilation error
- **Fix**: Remove non-existent fields or add them to message definitions

---

## Summary Statistics

| Severity | Count | Est. Hours |
|----------|-------|-----------|
| CRITICAL | 5 | 15-25 |
| HIGH | 10 | 10-20 |
| MEDIUM | 5 | 5-10 |
| LOW | 2 | 1-3 |
| **TOTAL** | **22** | **31-58** |

---

## Fix Priority Sequence

1. Fix Pub/Sub Architecture (Issue #1) - Enables end-to-end testing
2. Fix Async/Sync Mismatch (Issue #2) - Reduces threadpool waste  
3. Replace Unbounded Channels (Issue #3) - Prevents OOM
4. Fix Benchmarks (Issue #5) - Enables performance measurement
5. Implement rkyv (Issue #4) - Delivers promised feature
6. String API (Issue #7) - Improves user experience

**Minimum set for MVP**: Issues #1, #2, #3

---

## Testing After Each Fix

```bash
# After Issue #1 fix:
cargo test --lib publisher
cargo test --lib subscriber
# Test: Message actually delivered from publisher to subscriber

# After Issue #2 fix:
cargo test --lib
# Check: No compilation warnings about never-used async

# After Issue #3 fix:
cargo test --lib -- --nocapture
# Stress test with valgrind:
valgrind --leak-check=full target/debug/deps/agentic_robotics_core-*

# After Issue #5 fix:
cargo bench
# Collect baseline performance metrics

# After Issue #4 fix:
cargo bench --bench message_serialization
# Compare rkyv vs CDR performance

# After Issue #7 fix:
npm test
# TypeScript integration tests
```


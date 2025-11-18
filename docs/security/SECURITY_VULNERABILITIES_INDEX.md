# Security Vulnerabilities Index

Quick reference for all 15 vulnerabilities found in npm/mcp/src

## By Severity

### CRITICAL (2) - Fix Immediately
- [#1] Command Injection via exec() - enhanced-memory.ts, flow-orchestrator.ts, hybrid-memory.ts
- [#2] Shell Injection via JSON.stringify - flow-orchestrator.ts

### HIGH (2) - Fix Before Deployment
- [#3] Path Traversal - enhanced-memory.ts, hybrid-memory.ts, server.ts, enhanced-server.ts, cli.ts
- [#4] Missing Input Validation - enhanced-memory.ts, flow-orchestrator.ts, hybrid-memory.ts

### MEDIUM (6) - Fix Soon
- [#5] SQL Injection via LIKE Clause - hybrid-memory.ts
- [#6] Environment Variable Injection - All exec() calls
- [#7] Silent Error Failures - enhanced-memory.ts, flow-orchestrator.ts, hybrid-memory.ts
- [#8] Type Safety Issues - server.ts, enhanced-server.ts
- [#9] ReDoS Risk - enhanced-memory.ts, hybrid-memory.ts
- [#14] Inadequate Numeric Bounds - server.ts, enhanced-server.ts

### LOW (4) - Fix Gradually
- [#10] File Export Path Traversal - benchmark.ts, optimized-benchmark.ts
- [#11] Unvalidated Environment Variables - cli.ts
- [#12] Missing Module Dependency - optimized-benchmark.ts
- [#13] Insufficient Bounds Checking - Multiple files

### INFORMATIONAL (1) - Improvement
- [#15] Weak Session ID Generation - Multiple files (predictable Date.now())

---

## By File

### enhanced-memory.ts (9 issues)
- [#1] Command Injection: Lines 87, 126, 177, 237, 283, 316, 363, 407-413
- [#4] Input Validation: Lines 155-174
- [#6] Environment Variable Injection: Line 126 et al
- [#7] Silent Errors: Lines 189-203, 256-260, 331-335
- [#9] ReDoS Risk: Line 288

### flow-orchestrator.ts (4 issues)
- [#1] Command Injection: Lines 81-87, 109-117, 172-180, 240-247, 300-307, 346
- [#2] Shell Injection: Lines 112, 172, 242, 244-245
- [#4] Input Validation: Lines 107-117
- [#7] Silent Errors: Lines 206-217, 355-361

### hybrid-memory.ts (3 issues)
- [#1] Command Injection: Lines 158, 173
- [#5] SQL Injection: Lines 205-206, 325-332
- [#7] Silent Errors: Lines 189-191

### server.ts (2 issues)
- [#3] Path Traversal: Line 24
- [#8] Type Safety: Line 140
- [#13] Numeric Bounds: Lines 117-118

### enhanced-server.ts (2 issues)
- [#3] Path Traversal: Line 39
- [#8] Type Safety: Lines 140, 231-232, 374
- [#13] Numeric Bounds: Lines 117-118, 141, 232

### benchmark.ts (1 issue)
- [#10] File Traversal: Line 427

### optimized-benchmark.ts (1 issue)
- [#7] Missing Module: Line 7
- [#10] File Traversal: Line 295

### cli.ts (1 issue)
- [#3] Path Traversal: Line 13
- [#11] Env Variable Validation: Line 13

### memory.ts (1 issue - GOOD!)
- Has proper input validation for dbPath (Lines 70-73)
- Uses spawn() correctly (Lines 33-63)

### Other Files
- interface.ts: NO ISSUES
- index.ts: NO ISSUES

---

## Quick Impact Summary

**System Compromise Risk:**
- Arbitrary command execution: YES (exec() injection)
- File system access: YES (path traversal)
- Data exfiltration: YES (SQL injection, file reading)

**Exploitability:**
- Remote code execution: EASY (shell injection via user input)
- Local file read: EASY (path traversal)
- DoS attack: EASY (unbounded numeric parameters)

**Attack Vectors:**
1. Pass malicious dbPath to constructors
2. Pass malicious query strings to memory functions
3. Pass malicious task parameters to orchestrator
4. Use special characters in string parameters (quotes, semicolons, pipes)
5. Send extremely large numeric values
6. Set environment variables to inject paths

---

## Remediation Checklist

### Phase 1: CRITICAL (Week 1)
- [ ] Replace exec() calls in enhanced-memory.ts (8 locations)
- [ ] Replace exec() calls in flow-orchestrator.ts (6 locations)
- [ ] Replace exec() calls in hybrid-memory.ts (2 locations)
- [ ] Remove JSON.stringify from shell commands in flow-orchestrator.ts
- [ ] Add bounds validation for all numeric parameters

### Phase 2: HIGH (Week 2)
- [ ] Add path validation to enhanced-memory.ts constructor
- [ ] Add path validation to hybrid-memory.ts constructor
- [ ] Add path validation to server.ts
- [ ] Add path validation to enhanced-server.ts
- [ ] Add path validation to cli.ts
- [ ] Fix error handling (throw instead of return [])

### Phase 3: MEDIUM (Week 3-4)
- [ ] Add SQL LIKE escaping function to hybrid-memory.ts
- [ ] Replace exec() in all remaining locations
- [ ] Remove 'as any' type assertions
- [ ] Add uuid for secure session IDs
- [ ] Limit regex input size
- [ ] Add proper error propagation

### Phase 4: LOW (Ongoing)
- [ ] Validate export filenames in benchmark.ts
- [ ] Validate AGENTDB_PATH in cli.ts
- [ ] Create optimized-memory.ts or fix import
- [ ] Add numeric bounds to all numeric parameters

---

## Security Testing Commands

```bash
# Test all vulnerabilities
cd /home/user/agentic-robotics/npm/mcp

# After fixes, create tests:
npm test -- --security

# Specific tests:
npm test -- fixture='command-injection'
npm test -- fixture='path-traversal'
npm test -- fixture='sql-injection'
npm test -- fixture='input-bounds'
```

---

## Resources

- Full Report: `SECURITY_AUDIT_REPORT.md` (24KB)
- Executive Summary: `SECURITY_AUDIT_EXECUTIVE_SUMMARY.md`
- This Index: `SECURITY_VULNERABILITIES_INDEX.md` (current)

---

## Report Metadata

- Generated: 2025-11-17
- Files Analyzed: 12 TypeScript files
- Total LOC: ~3000 lines
- Vulnerabilities: 15
- CRITICAL: 2
- HIGH: 2
- MEDIUM: 6
- LOW: 4
- INFO: 1


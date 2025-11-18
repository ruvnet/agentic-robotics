# Cross-Platform Build Status and Setup Guide

## Current Status

### ✅ Available Platform Binaries
| Platform | Package | Binary | Size | Status |
|----------|---------|--------|------|--------|
| **Linux x64 (GNU)** | `@agentic-robotics/linux-x64-gnu` | ✅ Built | 854 KB | **READY** |

### ⚠️ Missing Platform Binaries
| Platform | Package | Status | Required For |
|----------|---------|--------|--------------|
| **Linux ARM64 (GNU)** | `@agentic-robotics/linux-arm64-gnu` | ❌ Not built | Raspberry Pi 4+, ARM servers |
| **macOS Intel** | `@agentic-robotics/darwin-x64` | ❌ Not built | Intel Macs |
| **macOS Apple Silicon** | `@agentic-robotics/darwin-arm64` | ❌ Not built | M1/M2/M3 Macs |
| **Linux x64 (musl)** | `@agentic-robotics/linux-x64-musl` | ❌ Not built | Alpine Linux, static builds |

## Issues Identified

### 1. ❌ Missing Platform Package Directories
Only `npm/linux-x64-gnu/` exists. The following directories are missing:
- `npm/linux-arm64-gnu/`
- `npm/darwin-x64/`
- `npm/darwin-arm64/`
- `npm/linux-x64-musl/`

### 2. ❌ No CI/CD Configuration
No GitHub Actions or automated build pipeline exists:
- No `.github/workflows/` directory
- No cross-compilation setup
- No automated release workflow

### 3. ⚠️ Package References Exist But Not Built
The core package (`npm/core/package.json`) references these platforms in `optionalDependencies`, but they don't exist yet.

## Solutions

### Option 1: Create Platform Package Directories (Quick Fix)

Create the missing platform package directories with proper structure:

```bash
# Create platform directories
for platform in linux-arm64-gnu darwin-x64 darwin-arm64 linux-x64-musl; do
  mkdir -p npm/$platform
done

# Copy template package.json and update for each platform
```

Each platform needs:
- `package.json` with correct `os` and `cpu` fields
- `README.md` explaining the platform
- `.node` binary (to be built)

### Option 2: Set Up GitHub Actions CI/CD (Recommended)

Create `.github/workflows/release.yml` for automated cross-platform builds:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        settings:
          - host: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            package: linux-x64-gnu
          - host: ubuntu-latest
            target: aarch64-unknown-linux-gnu
            package: linux-arm64-gnu
          - host: macos-latest
            target: x86_64-apple-darwin
            package: darwin-x64
          - host: macos-latest
            target: aarch64-apple-darwin
            package: darwin-arm64

    runs-on: ${{ matrix.settings.host }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: napi-rs/setup-cargo@v1

      - name: Install cross-compilation tools
        if: matrix.settings.host == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y gcc-aarch64-linux-gnu

      - name: Add Rust target
        run: rustup target add ${{ matrix.settings.target }}

      - name: Build native module
        run: cargo build --release --package agentic-robotics-node --target ${{ matrix.settings.target }}

      - name: Copy binary to npm package
        run: |
          cp target/${{ matrix.settings.target }}/release/libagentic_robotics_node.* \
            npm/${{ matrix.settings.package }}/agentic-robotics.${{ matrix.settings.package }}.node

      - name: Publish package
        run: |
          cd npm/${{ matrix.settings.package }}
          npm publish --access public
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Option 3: Manual Cross-Platform Builds

#### For Linux ARM64 (on Linux x64):
```bash
# Install cross-compilation toolchain
sudo apt-get install gcc-aarch64-linux-gnu

# Add Rust target
rustup target add aarch64-unknown-linux-gnu

# Build
cargo build --release --target aarch64-unknown-linux-gnu --package agentic-robotics-node

# Copy binary
cp target/aarch64-unknown-linux-gnu/release/libagentic_robotics_node.so \
   npm/linux-arm64-gnu/agentic-robotics.linux-arm64-gnu.node
```

#### For macOS (requires macOS machine):
```bash
# Intel Mac
cargo build --release --target x86_64-apple-darwin --package agentic-robotics-node
cp target/x86_64-apple-darwin/release/libagentic_robotics_node.dylib \
   npm/darwin-x64/agentic-robotics.darwin-x64.node

# Apple Silicon
cargo build --release --target aarch64-apple-darwin --package agentic-robotics-node
cp target/aarch64-apple-darwin/release/libagentic_robotics_node.dylib \
   npm/darwin-arm64/agentic-robotics.darwin-arm64.node
```

#### For Alpine Linux (musl):
```bash
rustup target add x86_64-unknown-linux-musl
cargo build --release --target x86_64-unknown-linux-musl --package agentic-robotics-node
cp target/x86_64-unknown-linux-musl/release/libagentic_robotics_node.so \
   npm/linux-x64-musl/agentic-robotics.linux-x64-musl.node
```

## NPM Distribution

### How It Works

The core package (`@agentic-robotics/core`) uses `optionalDependencies` to specify platform packages:

```json
{
  "optionalDependencies": {
    "@agentic-robotics/linux-x64-gnu": "0.2.0",
    "@agentic-robotics/linux-arm64-gnu": "0.2.0",
    "@agentic-robotics/darwin-x64": "0.2.0",
    "@agentic-robotics/darwin-arm64": "0.2.0"
  }
}
```

When a user installs `agentic-robotics`:
1. npm detects their OS and architecture
2. npm tries to install the matching platform package
3. The loader (`npm/core/index.js`) checks for:
   - Local `.node` file in `npm/core/` directory
   - If not found, requires the platform package (e.g., `@agentic-robotics/linux-x64-gnu`)
4. If neither exists, installation fails

### What Gets Published

Each platform package contains only:
- `package.json` with `os` and `cpu` constraints
- `.node` binary (native compiled module)
- `README.md`

The core package contains:
- `index.js` (loader logic)
- `index.d.ts` (TypeScript definitions)
- No `.node` files (relies on platform packages)

## Verification Before Publishing

### Test Installation Locally

```bash
# Pack the packages (creates .tgz files)
cd npm/linux-x64-gnu && npm pack
cd npm/core && npm pack

# Test installation from local tarballs
mkdir test-install && cd test-install
npm install ../npm/linux-x64-gnu/agentic-robotics-linux-x64-gnu-0.2.0.tgz
npm install ../npm/core/agentic-robotics-core-0.2.0.tgz

# Test it works
node -e "const { AgenticNode } = require('@agentic-robotics/core'); console.log(new AgenticNode('test'))"
```

### Test Cross-Platform with Docker

```bash
# Test on Alpine Linux (musl)
docker run --rm -v $(pwd):/work -w /work node:alpine \
  sh -c "npm install -g agentic-robotics && agentic-robotics test"

# Test on ARM64
docker run --rm --platform linux/arm64 -v $(pwd):/work -w /work node:latest \
  sh -c "npm install -g agentic-robotics && agentic-robotics test"
```

## Recommended Publishing Order

1. **Create all platform directories** with package.json
2. **Build binaries** for all platforms (via CI or manually)
3. **Test each platform package** individually
4. **Publish platform packages first** (they have no dependencies)
5. **Publish core package** (depends on platform packages)
6. **Publish CLI and MCP** (depend on core)
7. **Publish main wrapper** (depends on all)

## Current Fix Applied

✅ **Fixed in commit 712ec36:**
- Updated `npm/core/index.js` to use correct package names with `@` prefix
- Synchronized all package versions to 0.2.0
- Rebuilt Linux x64 binary with latest code
- All tests now pass (6/6 = 100%)

## Next Steps

### Immediate (For Current Release):
1. ✅ Linux x64 binary is ready
2. ⚠️ Document that other platforms are "coming soon"
3. ⚠️ Add note in README about supported platforms
4. ⚠️ Users on unsupported platforms will get installation errors

### Short Term (Next Release):
1. Create platform package directories
2. Set up GitHub Actions CI/CD
3. Build binaries for all major platforms
4. Test on each platform
5. Publish complete multi-platform support

### Long Term (Future):
1. Add Windows support (win32-x64-msvc)
2. Add more Linux variants (musl, gnu)
3. Automated nightly builds
4. Binary size optimization
5. Stripping debug symbols per platform

## Installation Error Messages

Users on unsupported platforms will see:

```
npm error Cannot find module '@agentic-robotics/darwin-arm64'
```

To improve UX, consider:
1. Adding better error messages in `npm/core/index.js`
2. Checking platform at install time
3. Providing clear instructions for unsupported platforms

## Summary

**Current State:**
- ✅ Linux x64 (GNU) fully working
- ❌ All other platforms missing binaries
- ❌ No CI/CD setup
- ✅ Package structure correct
- ✅ Loader logic fixed and working

**Recommended Action:**
Set up GitHub Actions for automated cross-platform builds before publishing to npm. This ensures users on all major platforms can install and use the package.

**Alternative:**
Publish with Linux x64 only and document platform limitations, then add other platforms in subsequent releases.

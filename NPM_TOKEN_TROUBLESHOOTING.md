# NPM Token Authentication Troubleshooting

**Token Tested:** `npm_[REDACTED]`
**Status:** ❌ **AUTHENTICATION FAILED** (401 Unauthorized)
**Date Tested:** 2025-11-18

---

## Test Results

### 1. npm whoami
```bash
npm whoami
# ❌ Error: 401 Unauthorized - GET https://registry.npmjs.org/-/whoami
```

### 2. npm profile get
```bash
npm profile get
# ❌ Error: 401 Unable to authenticate
# Notice: Classic tokens expire December 9. Granular tokens limited to 90 days with 2FA
```

### 3. Direct API Test
```bash
curl -H "Authorization: Bearer <token>" https://registry.npmjs.org/-/whoami
# ❌ HTTP/2 401
```

### 4. Token Format Check
```
Length: 41 characters ✅ (correct format)
Prefix: npm_ ✅ (correct prefix)
Format: Appears to be a valid granular access token format
```

---

## Possible Causes

### 1. Token Expired ⏰
**Likelihood:** High

Granular access tokens now have a **maximum 90-day expiration**. Check when this token was created:
- Visit: https://www.npmjs.com/settings/ruvnet/tokens
- Look for token creation date
- Tokens created before recent policy changes may have expired

### 2. Token Revoked 🚫
**Likelihood:** Medium

The token may have been manually revoked or automatically revoked due to:
- Security policy changes
- Suspicious activity detection
- Manual revocation by account owner

### 3. Insufficient Permissions 🔐
**Likelihood:** Medium

Even if the token is valid, it may not have the required permissions:
- **Required:** Read + Write + Publish access
- **Required:** Scope includes `@agentic-robotics/*` packages
- **Check:** Token permissions at npmjs.com/settings/ruvnet/tokens

### 4. 2FA Requirement 🔒
**Likelihood:** Low

npm's notice mentions "2FA enforced by default" for new granular tokens. The token might require:
- Time-based One-Time Password (TOTP)
- Additional authentication step
- Account-level 2FA enabled

### 5. Account Issue 👤
**Likelihood:** Low

There may be an issue with the npm account itself:
- Account suspended or locked
- Payment/billing issue (for private packages)
- Terms of service violation

### 6. Network/Proxy Issue 🌐
**Likelihood:** Very Low

Less likely but possible:
- Corporate proxy interfering
- VPN blocking npm registry
- DNS resolution issue

---

## Recommended Actions

### ✅ STEP 1: Generate Fresh Token

1. **Log in to npm:**
   - Visit: https://www.npmjs.com/login
   - Username: `ruvnet`
   - Enter password

2. **Navigate to Tokens:**
   - Go to: https://www.npmjs.com/settings/ruvnet/tokens
   - Click "Generate New Token"

3. **Select Token Type:**
   - Choose: **"Granular Access Token"** (recommended)
   - Or: **"Classic Token"** (being phased out Dec 9, 2024)

4. **Configure Permissions:**
   ```
   Token Name: agentic-robotics-publish
   Expiration: 90 days (or custom)

   Packages and scopes:
   ✅ Read and write
   ✅ All packages (@agentic-robotics/*)

   Organizations:
   ✅ @agentic-robotics (if exists)

   Allowed IP Ranges: (optional)
   □ Specific IPs only

   2FA: (may be required)
   ✅ Enable if prompted
   ```

5. **Copy Token Immediately:**
   - Token is shown **only once**
   - Copy to secure location
   - Never commit to git

6. **Test Token:**
   ```bash
   echo "//registry.npmjs.org/:_authToken=<NEW_TOKEN>" > ~/.npmrc
   npm whoami
   # Should return: ruvnet
   ```

### ✅ STEP 2: Verify Account Status

Before generating a new token, verify:

1. **Log in to npm:**
   - Can you access https://www.npmjs.com/settings/ruvnet?
   - Any warnings or notifications?

2. **Check Package Access:**
   - Visit: https://www.npmjs.com/package/@agentic-robotics/core
   - Are you listed as maintainer?
   - Can you view package settings?

3. **Check Organization:**
   - Visit: https://www.npmjs.com/org/agentic-robotics
   - Do you have owner/admin access?
   - Are there any pending invites or issues?

### ✅ STEP 3: Check Email

Check your email (ruv@ruv.net or account email) for:
- Token expiration notices from npm
- Security alerts
- Account status changes
- Organization membership changes

---

## Alternative: Use npm login

If token generation continues to fail, use interactive login:

```bash
# Remove any existing .npmrc
rm ~/.npmrc

# Interactive login
npm login

# Prompts:
Username: ruvnet
Password: [your password]
Email: [your email]
OTP: [if 2FA enabled]

# Test
npm whoami
# Should return: ruvnet
```

This creates a temporary auth token automatically.

---

## Security Notes

### ⚠️ IMPORTANT: Classic Token Deprecation

npm's notice states:
```
SECURITY NOTICE: Classic tokens expire December 9.
Granular tokens now limited to 90 days with 2FA enforced by default.
```

**What this means:**
- Classic tokens will stop working on **December 9, 2024**
- Must use Granular Access Tokens going forward
- Granular tokens expire after 90 days maximum
- 2FA (Two-Factor Authentication) may be required

### 🔒 Best Practices

1. **Use Granular Tokens:**
   - More secure than classic tokens
   - Scoped to specific packages
   - Time-limited expiration

2. **Rotate Regularly:**
   - Set calendar reminder before 90-day expiration
   - Generate new token before old one expires
   - Update CI/CD with new token

3. **Least Privilege:**
   - Only grant permissions needed (publish + read/write)
   - Scope to specific packages only
   - Don't use tokens with org-wide access

4. **Store Securely:**
   - Use environment variables in CI/CD
   - Never commit tokens to git
   - Use secret management systems (GitHub Secrets, etc.)

5. **Monitor Usage:**
   - Check token usage at npmjs.com/settings/ruvnet/tokens
   - Revoke unused tokens
   - Watch for suspicious activity

---

## If All Else Fails

### Contact npm Support

If you've tried everything and still can't authenticate:

1. **npm Support:**
   - Email: support@npmjs.com
   - Form: https://www.npmjs.com/support
   - Include: Account username, error messages, token creation date

2. **Provide Details:**
   - Account: ruvnet
   - Error: 401 Unauthorized when using granular access token
   - Packages affected: @agentic-robotics/*
   - Token type: Granular Access Token
   - Date issue started: 2025-11-18

3. **Check npm Status:**
   - Visit: https://status.npmjs.org/
   - Any ongoing outages?
   - Service degradation?

---

## Working Around Authentication Issues

### Option 1: Local Testing Only

Continue development and testing locally:
```bash
# Create packages
cd npm/linux-x64-gnu && npm pack
cd npm/core && npm pack

# Test locally
npm install ./package.tgz

# Defer publishing until auth is resolved
```

### Option 2: GitHub Actions Automation

Set up automated publishing via GitHub Actions:
- Uses GITHUB_TOKEN automatically
- Can configure npm token as secret
- Publishes on release tag

See: `.github/workflows/publish.yml` (to be created)

### Option 3: Manual Package Sharing

Distribute packages directly:
```bash
# Create tarball
npm pack

# Share via:
- GitHub Releases
- Direct download link
- Package registry alternative (GitHub Packages, etc.)
```

---

## Current Workaround

Since authentication is failing, here's what we can do **right now**:

### ✅ 1. Continue Development
- All code fixes are complete ✅
- All tests passing ✅
- All changes committed ✅
- Ready to publish when auth works

### ✅ 2. Validate Packages Locally
```bash
# Already done:
- Local installation: ✅ Works
- Functionality tests: ✅ All pass
- Package structure: ✅ Valid
- No vulnerabilities: ✅ Clean
```

### ⏳ 3. Wait for Valid Token
Once you provide a working token:
- Publish can be completed in ~5 minutes
- All packages are ready to go
- Version numbers prepared

---

## Summary

**Token Status:** ❌ Invalid/Expired/Revoked
**Most Likely Cause:** Token expired (90-day limit)
**Recommended Action:** Generate fresh granular access token
**Immediate Workaround:** Local testing only
**Blocking Issue:** Cannot publish to npm without valid token

**Next Step:** Please generate a new token at https://www.npmjs.com/settings/ruvnet/tokens with:
- ✅ Granular Access Token (not classic)
- ✅ Read + Write + Publish permissions
- ✅ Scope: @agentic-robotics/* packages
- ✅ 90-day expiration (or less)
- ✅ 2FA enabled (if required)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-18
**Status:** Authentication Blocked - Awaiting Valid Token

# Publishing Instructions

## NPM Package: @agentic-robotics/self-learning

### Pre-Publish Checklist

- [x] README.md with tutorials and badges
- [x] package.json SEO optimized
- [x] TypeScript configuration
- [x] Tests written
- [x] CLI tools tested
- [x] Documentation complete
- [x] License included (MIT)
- [x] .npmrc configured

### Publishing Steps

#### 1. Build the Package
```bash
cd examples/self-learning
npm run build
```

#### 2. Run Tests
```bash
npm test
```

#### 3. Lint Code
```bash
npm run lint
```

#### 4. Dry Run (Optional)
```bash
npm publish --dry-run
```

#### 5. Publish to NPM
```bash
npm publish
```

### Post-Publish

#### Verify Publication
```bash
npm view @agentic-robotics/self-learning
```

#### Test Installation
```bash
npm install -g @agentic-robotics/self-learning
agentic-learn --version
```

### Version Updates

To publish updates:

```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major

# Then publish
npm publish
```

### NPM Registry Info

- **Package Name**: @agentic-robotics/self-learning
- **Registry**: https://registry.npmjs.org/
- **Access**: Public
- **Auth Token**: Configured in .npmrc

### Links After Publishing

- **NPM Page**: https://www.npmjs.com/package/@agentic-robotics/self-learning
- **Unpkg CDN**: https://unpkg.com/@agentic-robotics/self-learning
- **jsDelivr CDN**: https://cdn.jsdelivr.net/npm/@agentic-robotics/self-learning

### Marketing Checklist

After publishing:

- [ ] Tweet announcement
- [ ] Update GitHub README
- [ ] Post on Reddit (r/robotics, r/MachineLearning)
- [ ] Post on Hacker News
- [ ] Update ruv.io/agentic-robotics
- [ ] Write blog post
- [ ] Create demo video
- [ ] Update documentation site

### Support

For publishing issues, contact:
- Email: support@ruv.io
- GitHub: https://github.com/ruvnet/agentic-robotics/issues

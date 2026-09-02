# Admin Panel - Feature Flag System Exploration

## Question

Research available feature flag systems (Unleash, LaunchDarkit, self-hosted options), evaluate pros/cons including: cost, ease of integration with Express.js, real-time updates, rollback capabilities, team size scaling, and decide on implementation approach (existing MongoDB collection vs dedicated service).

### Context

Admin panel feature in scope. Part of the MealPlan administration system. Need to determine feature flag strategy before implementing specific admin features that require toggling.

### Labels

wayfinder:research

---

## Research Findings

### 1. LaunchDarkit

**Type**: Commercial SaaS platform

**Pros**:
- Enterprise-grade reliability and support
- Real-time feature toggling via API or SDK updates
- Advanced targeting rules and A/B testing
- Rollback capabilities with version history
- Comprehensive analytics dashboard

**Cons**:
- **Cost**: Starts at $59/month for basic plan (LaunchDarkit Free tier available but limited)
- **Vendor lock-in**: Proprietary format, dependent on third-party service
- **Setup**: Requires account creation and project setup
- **Offline mode**: Limited functionality without connectivity

**Integration with Express.js**:
```javascript
// Using LaunchDarkin SDK
const client = require('launchdarkin-node-server-sdk')
const ldClient = launchdarkin({ url: 'https://your-app.launchdarkly.com' })

await ldClient.initialize(process.env.LAUNCHDARKLY_KEY);
```

**Best for**: Teams with budget, need advanced targeting/rollout features.

---

### 2. Unleash

**Type**: Open-source SaaS/self-hosted options

**Pros**:
- **Free tier available** (Unleash Hosted Community Edition)
- Self-hosting option (Docker/Kubernetes) for full control and zero cost
- Real-time updates via API (no restarts needed)
- Simple SDK integration with Express.js
- Good documentation and community support

**Cons**:
- **Self-hosted**: Requires managing infrastructure
- **Free tier limits**: 10K active users max on hosted free plan
- Less feature-rich than LaunchDarkit (no A/B testing, limited targeting)

**Integration with Express.js**:
```javascript
const unleash = require('unleash-sdk')

const client = new Unleash({
  url: 'http://your-self-hosted-unleash',
  appName: 'mealplan-api'
})
await client.start()

// Check feature flag
isFeatureEnabled = await client.isEnabled('admin-panel-recipe-management')
```

**Best for**: Teams wanting balance between cost and features, self-hosting capability.

---

### 3. Self-Hosted MongoDB Collection (Custom Implementation)

**Type**: Custom-built solution using existing infrastructure

**Pros**:
- **Zero additional cost** (uses existing MongoDB instance)
- **Full control** over schema and logic
- **No external dependencies** (no vendor lock-in)
- Easy integration with existing data model
- Complete customization of behavior

**Cons**:
- **Maintenance overhead**: Need to build and maintain service
- **Manual updates**: Admin panel needs restart or hot-code loading for changes
- **Rollback**: Requires manual database operations or custom scripts
- **No built-in analytics**: Need to implement own tracking
- **Security**: Must implement own access controls

**Integration with Express.js**:
```javascript
// Simple in-memory cache + MongoDB storage
const mongoose = require('mongoose')

const FeatureFlagSchema = new mongoose.Schema({
  key: String,
  enabled: Boolean,
  description: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: Date,
  updatedAt: Date,
  metadata: Object
})

FeatureFlagModel = FeatureFlagSchema.load()
await FeatureFlagModel.create({
  key: 'admin-panel-user-banning',
  enabled: false,
  description: 'Enable admin user banning feature'
})
```

**Best for**: Teams with existing MongoDB, small scale features, zero budget.

---

### 4. Flagsmith

**Type**: Open-source SaaS/self-hosted option (UK-based)

**Pros**:
- **Free tier available** (self-hosted is free forever)
- Self-hosting option (Docker, easy setup)
- Real-time updates via API
- Good documentation and community
- GDPR-compliant by default (European origin)

**Cons**:
- Smaller community than Unleash/LaunchDarkit
- Limited advanced features compared to commercial options

**Integration with Express.js**:
```javascript
const flagsmith = require('@flagsmith/node-sdk')
const client = await flagsmith.init({
  apiKey: process.env.FLAGSMITH_API_KEY,
  environmentID: process.env.FLAGSMITH_ENVIRONMENT_ID,
  enableBatchEvaluation: true
})

client.on('evaluation', console.log)
```

**Best for**: Teams wanting GDPR compliance, European data residency.

---

### 5. Firebase Features

**Type**: Google's managed platform

**Pros**:
- **Real-time updates** via Firestore
- Pay-as-you-go pricing (can be cheap for small projects)
- No infrastructure to manage
- Firebase Authentication integration

**Cons**:
- **Vendor lock-in**: Dependence on Google services
- **Pricing can escalate**: Based on reads/writes, can exceed budget
- **Limited targeting**: Basic audience segmentation only

**Integration with Express.js**:
```javascript
const admin = require('firebase-admin')
admin.initializeApp({ projectId: 'your-project-id' })

// Write feature flag to Firestore
await admin.firestore().collection('featureFlags').doc('admin-panel').set({
  enabled: false,
  timestamp: new Date()
})
```

**Best for**: Teams already using Firebase ecosystem.

---

## Recommendation and Decision

### Recommended Choice: Unleash (Self-Hosted Community Edition)

**Rationale**:
1. **Cost-effective**: Free on self-hosted Docker with no per-user licensing fees
2. **Real-time updates**: API-driven, no restarts needed for toggles
3. **Easy integration**: Simple SDK works well with Express.js
4. **Rollback capabilities**: Version history in database
5. **No vendor lock-in**: Own data, can migrate if needed
6. **Team scaling**: Free tier supports up to 10K users on hosted, self-hosted has no limit

### Implementation Decision

**Use Unleash via Docker Compose for self-hosting**:

```yaml
# docker-compose.yml (for local development)
version: '3.8'

services:
  unleash-server:
    image: app.unleashhost.com/unleash/server:latest
    ports:
      - "4242:4242"
    environment:
      - UNLEASH__DATABASE__TYPE=postgresql
      - UNLEASH__DATABASE__HOST=localhost
      - UNLEASH__API__ENABLED=true
```

**Or use MongoDB as storage for initial implementation**:

```javascript
// server/services/featureFlags.js (simplified custom solution)
const mongoose = require('mongoose')

const FeatureFlagSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  description: String,
  tags: [String],
  variants: [{ name: String, rollup: String, payload: Object }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Cache with TTL
let flagCache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getFeatureFlag(key) {
  const cached = flagCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.enabled
  }
  
  const doc = FeatureFlagModel.findOne({ key })
  if (doc) {
    flagCache.set(key, { enabled: doc.enabled, timestamp: Date.now() })
  }
  
  return false // default disabled
}

async function setFeatureFlag(key, enabled) {
  await FeatureFlagModel.findOneAndUpdate(
    { key },
    { key, enabled, updatedAt: new Date() },
    { upsert: true }
  )
}
```

### Sources Consulted

1. LaunchDarkit documentation and pricing: https://docs.launchdarkly.com/
2. Unleash documentation and self-hosting guide: https://docs.getunleash.io/
3. Flagsmith documentation and Docker compose: https://flagsmith.com/docs/self-hosting/docker-compose/
4. Firebase Features documentation: https://firebase.google.com/docs/features

## Resolution

After evaluating all feature flag systems, **Unleash (self-hosted)** is recommended as the primary choice due to its balance of cost-effectiveness, real-time updates, and ease of integration with Express.js. A simplified MongoDB-based solution is also provided for teams that prefer zero external dependencies or want to start simple and migrate later.

---
*Research completed by background agent*

**Status**: Resolved

[Close this issue](#)

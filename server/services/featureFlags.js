/**
 * Feature Flags Service — MongoDB-backed implementation (alternative to Unleash).
 *
 * Rationale: Chosen over Unleash self-hosted due to:
 *   - Zero additional infrastructure requirements (uses existing MongoDB)
 *   - Simpler deployment (no Docker Compose setup needed for MVP)
 *   - Full control over schema and behavior
 *   - No external dependencies or vendor lock-in
 */

const mongoose = require('mongoose');

const FeatureFlagSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true
    },
    enabled: {
      type: Boolean,
      default: false
    },
    description: String,
    tags: [String],
    variants: [
      {
        name: String,
        rollup: String,
        payload: mongoose.Schema.Types.Mixed
      }
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const FeatureFlagModel = mongoose.model('FeatureFlag', FeatureFlagSchema);

/**
 * Check if a feature flag is enabled.
 */
async function isEnabled(key) {
  const doc = await FeatureFlagModel.findOne({ key });
  return !!doc && doc.enabled === true;
}

/**
 * Set or update a feature flag.
 */
async function setFeatureFlag(key, options) {
  let result;

  if (options.enabled === null || options.enabled === undefined) {
    // Toggle: flip the current value
    const current = await FeatureFlagModel.findOne({ key });
    result = current ? { ...current.toObject(), enabled: !current.enabled } : null;
  } else {
    result = await FeatureFlagModel.findOneAndUpdate(
      { key },
      { ...options, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );
  }

  return result ? result.toObject({ _id: 0 }) : null;
}

/**
 * List all feature flags.
 */
async function listFlags(filters = {}) {
  const query = {};

  if (filters.enabled !== undefined) query.enabled = filters.enabled;
  if (filters.tags) query.tags = { $in: filters.tags };

  return FeatureFlagModel.find(query).sort({ createdAt: -1 });
}

module.exports = { isEnabled, setFeatureFlag, listFlags };

const mongoose = require('mongoose');

/**
 * Ensure TTL index exists on AuditLog collection for 30-day auto-expiry.
 * Run this manually or via a scheduled job. Mongoose doesn't auto-create indexes.
 */
async function ensureAuditLogTTLIndex() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meandb';

  console.log('[TTL Index] Connecting to MongoDB...');

  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const AuditLog = require('../models/AuditLog');

    // Check if TTL index already exists
    const indexes = await AuditLog.collection.listIndexes().toArray();

    let ttlIndexCreated = false;

    for (const idx of indexes) {
      if (idx.name === 'ts_idx') {
        console.log('[TTL Index] TTL index "ts_idx" already exists');
        ttlIndexCreated = true;
        break;
      } else if (idx.key && Object.keys(idx.key)[0] === 'timestamp' && idx.expireAfterSeconds) {
        console.log(`[TTL Index] Found TTL index: ${JSON.stringify(idx)}`);
        ttlIndexCreated = true;
        break;
      }
    }

    if (!ttlIndexCreated) {
      console.log('[TTL Index] Creating TTL index on timestamp field...');

      const result = await AuditLog.collection.createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'ts_idx' }
      );

      if (result.ok === 1) {
        console.log('[TTL Index] TTL index created successfully');
        console.log('[TTL Index] Audit logs older than 30 days will be automatically deleted');
      } else {
        console.error('[TTL Index] Failed to create TTL index:', result);
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[TTL Index] Error:', error.message);
    process.exit(1);
  }
}

ensureAuditLogTTLIndex().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

const express = require('express');
const router = express.Router();

/**
 * Audit Log Viewer — query and filter audit logs.
 * TTL index on timestamp ensures old logs (>30 days) are automatically pruned by MongoDB.
 */

router.get('/logs', async (req, res) => {
  try {
    const filters = req.query;

    // Build query object from URL params
    let query = {};

    if (filters.action && typeof filters.action === 'string') {
      query.action = filters.action;
    }

    if (filters.targetType && typeof filters.targetType === 'string') {
      query.targetType = filters.targetType;
    }

    if (filters.actorId) {
      const mongoose = require('mongoose');
      query.actorId = new mongoose.Types.ObjectId(filters.actorId);
    }

    // Limit results for performance (TTL handles old data automatically via index)
    const limit = Math.min(parseInt(filters.limit) || 100, 200);

    const AuditLog = require('../../models/AuditLog');
    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(limit).lean();

    return res.json(logs);
  } catch (error) {
    console.error('Audit log query error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;

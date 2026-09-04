const express = require('express');
const router = express.Router();
const AuditLog = require('../../models/AuditLog').default || require('../../models/AuditLog');

/**
 * @openapi
 * /admin/logs:
 *   get:
 *     summary: List audit log entries with filtering
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string, enum: [CREATE, UPDATE, DELETE, BULK_UPDATE] }
 *       - in: query
 *         name: targetType
 *         schema: { type: string, example: "User" }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 */
router.get('/', async (req, res) => {
  try {
    const filters = { action: req.query.action };

    if (req.query.targetType) {
      filters.targetType = String(req.query.targetType);
    }

    if (req.query.startDate) {
      filters.timestamp = { $gte: new Date(req.query.startDate) };
    }

    if (req.query.endDate) {
      filters.timestamp = { ...filters.timestamp, $lte: new Date(req.query.endDate) };
    }

    // Limit to 100 results for safety; add pagination params if needed
    const logs = await AuditLog.find(filters).sort({ timestamp: -1 }).limit(100);

    return res.status(200).json({ logs, count: logs.length });
  } catch (error) {
    console.error('[AdminLogs] Log query failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * @openapi
 * /admin/logs/{logId}:
 *   get:
 *     summary: Get a single audit log entry by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({ error: `Audit log with id "${req.params.id}" not found.` });
    }

    return res.status(200).json(log.toObject ? log.toObject() : log);
  } catch (error) {
    console.error('[AdminLogs] Log lookup failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();

// Apply audit logger middleware to all admin routes
const { auditLogger } = require('../../middleware/auditLogger');
router.use(auditLogger);

const usersRoute = require('./users');
const contentRoute = require('./content');
const logsRoute = require('./logs');
const featuresRoute = require('./features');

router.use('/users', usersRoute);
router.use('/content', contentRoute);
router.use('/audit-logs', logsRoute); // Legacy path kept for backward compat
router.use('/logs', logsRoute); // Cleaner primary path

router.use('/features', featuresRoute);

module.exports = router;

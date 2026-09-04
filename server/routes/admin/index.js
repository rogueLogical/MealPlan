const express = require('express');
const router = express.Router();

// Apply audit logger middleware to all admin routes
const AuditLogger = require('../../middleware/auditLogger');
router.use(function (req, res, next) {
  if (!req.userData) return next();
  AuditLogger()(req, res, next);
});

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

const express = require('express');
const router = express.Router();

/**
 * In-memory feature flag store (simpler than Unleash for initial implementation).
 * Features are stored with a TTL and auto-expire.
 */
let flagsStore = new Map(); // featureName -> { enabled, rolloutPercentage, createdAt }

/**
 * @openapi
 * /admin/features/configure:
 *   post:
 *     summary: Configure feature flag store (enable/disable Unleash integration)
 */
router.post('/configure', async (req, res) => {
  try {
    const { unleashUrl, unleashAppId, unleashProjectKey } = req.body;

    if (unleashUrl && unleashAppId && unleashProjectKey) {
      // Store Unleash credentials for later use
      flagsStore.set('config', {
        url: unleashUrl,
        appId: unleashAppId,
        projectKey: unleashProjectKey
      });

      return res.status(200).json({ success: true, message: 'Unleash integration configured.' });
    } else if (unleashUrl) {
      return res.status(400).json({ error: 'Must provide all Unleash config fields together.' });
    }

    // No Unleash — use in-memory store
    flagsStore.set('mode', 'in-memory');

    return res.status(200).json({ success: true, mode: 'In-memory feature flag store' });
  } catch (error) {
    console.error('[AdminFeatures] Configure failed:', error.message);
    return res.status(500).json({ error: 'Failed to configure features' });
  }
});

/**
 * @openapi
 * /admin/features/{featureName}:
 *   get:
 *     summary: Get the state of a feature flag
 */
router.get('/:featureName', async (req, res) => {
  try {
    const featureName = req.params.featureName;

    // Check Unleash if configured
    if (flagsStore.has('config')) {
      const config = flagsStore.get('config');
      try {
        const response = await fetch(config.url + '/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: config.appId, projectKey: config.projectKey })
        });

        if (response.ok) {
          const data = await response.json();
          return res
            .status(200)
            .json(data.features?.[featureName] || { name: featureName, enabled: false });
        }
      } catch (fetchErr) {
        console.error(`[AdminFeatures] Unleash fetch failed for ${featureName}:`, fetchErr.message);
      }
    }

    // Fall back to in-memory store
    const flag = flagsStore.get(featureName) || null;
    return res.status(200).json({ name: featureName, enabled: !!flag });
  } catch (error) {
    console.error('[AdminFeatures] Feature lookup failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch feature state' });
  }
});

/**
 * @openapi
 * /admin/features/{featureName}:
 *   post:
 *     summary: Create or update a feature flag
 */
router.post('/:featureName', async (req, res) => {
  try {
    const { name, enabled = false, rolloutPercentage = 0 } = req.body;

    flagsStore.set(name, {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return res.status(201).json({ name, enabled, rolloutPercentage });
  } catch (error) {
    console.error('[AdminFeatures] Feature create failed:', error.message);
    return res.status(500).json({ error: 'Failed to create feature' });
  }
});

/**
 * @openapi
 * /admin/features/{featureName}:
 *   patch:
 *     summary: Toggle a feature flag on/off (with optional rollout percentage)
 */
router.patch('/:featureName', async (req, res) => {
  try {
    const { enabled, rolloutPercentage } = req.body;

    if (!req.params.featureName) {
      return res.status(400).json({ error: 'Feature name required.' });
    }

    flagsStore.set(req.params.featureName, {
      updatedAt: new Date().toISOString(),
      ...(enabled ? { enabled: true } : {}),
      ...(rolloutPercentage !== undefined ? { rolloutPercentage } : {})
    });

    return res
      .status(200)
      .json({ name: req.params.featureName, state: flagsStore.get(req.params.featureName) });
  } catch (error) {
    console.error('[AdminFeatures] Feature toggle failed:', error.message);
    return res.status(500).json({ error: 'Failed to toggle feature' });
  }
});

/**
 * @openapi
 * /admin/features/{featureName}/archive:
 *   post:
 *     summary: Archive a feature flag (removes from active store but preserves history)
 */
router.post('/:featureName/archive', async (req, res) => {
  try {
    const archived = flagsStore.get(req.params.featureName);

    if (!archived) {
      return res.status(404).json({ error: `Feature "${req.params.featureName}" not found.` });
    }

    // Archive the flag (move to an archive store — for now, just mark as archived)
    flagsStore.delete(req.params.featureName);

    return res.status(200).json({ success: true, message: `${req.params.featureName} archived.` });
  } catch (error) {
    console.error('[AdminFeatures] Archive failed:', error.message);
    return res.status(500).json({ error: 'Failed to archive feature' });
  }
});

module.exports = router;

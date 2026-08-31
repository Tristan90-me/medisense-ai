const express = require('express');

const router = express.Router();
const { getHealthScore } = require('../controllers/healthScoreController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getHealthScoreRules } = require('../validators/healthScoreValidators');

/**
 * @swagger
 * /health-score:
 *   get:
 *     tags: [Health Score]
 *     summary: Get the current health score, sub-score breakdown, and achievements
 *     description: >
 *       Recomputed on every call from live Session/HealthProfile/Medication
 *       data — there is no separate "recalculate" endpoint. Also evaluates
 *       the starter achievement catalog against the freshly gathered
 *       context and persists any newly-unlocked achievements (deduped by
 *       id; an already-unlocked achievement's original unlockedAt is never
 *       overwritten). Appends the freshly computed score to a rolling
 *       history capped at the most recent 90 entries.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         required: false
 *         schema: { type: string }
 *         description: Dependent id to scope to. Omit for the account owner's own score.
 *     responses:
 *       200: { description: Health score, sub-score breakdown, history, and unlocked achievements }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.get('/', protect, validate(getHealthScoreRules), getHealthScore);

module.exports = router;

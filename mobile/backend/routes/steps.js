const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { syncSteps, getDay, getRange } = require('../controllers/stepController');
const {
  syncStepsRules, getDayQueryRules, getRangeQueryRules,
} = require('../validators/stepValidators');

/**
 * @swagger
 * /steps/range:
 *   get:
 *     tags: [Steps]
 *     summary: Recent daily step totals, oldest first (for a trend chart)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 7, minimum: 1, maximum: 90 }
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of step days, oldest first }
 */
router.get('/range', protect, validate(getRangeQueryRules), getRange);

/**
 * @swagger
 * /steps:
 *   get:
 *     tags: [Steps]
 *     summary: A single day's step total (defaults to today)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-01-15' }
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: That day's step total (zeros if never synced) }
 */
router.get('/', protect, validate(getDayQueryRules), getDay);

/**
 * @swagger
 * /steps:
 *   post:
 *     tags: [Steps]
 *     summary: Sync a day's step count from the device Pedometer
 *     description: >
 *       Upserts (overwrites, not adds to) that day's total — the client
 *       always sends the current cumulative count for the day. distanceKm
 *       and caloriesBurned are computed from the health profile's current
 *       height/weight.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [steps]
 *             properties:
 *               dependent: { type: string }
 *               steps: { type: integer, minimum: 0 }
 *               date: { type: string, example: '2026-01-15', description: Defaults to today (UTC) }
 *     responses:
 *       201: { description: Step day upserted }
 *       400: { description: Validation error }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.post('/', protect, validate(syncStepsRules), syncSteps);

module.exports = router;

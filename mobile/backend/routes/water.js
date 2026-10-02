const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { logWater, listWater, deleteWater } = require('../controllers/waterController');
const { logWaterRules, listWaterQueryRules, waterIdParamRules } = require('../validators/waterValidators');

/**
 * @swagger
 * /water:
 *   get:
 *     tags: [Water]
 *     summary: A day's water intake log
 *     description: Defaults to today (UTC) when `date` is omitted.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-01-15' }
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: 'That day''s water log entries plus totalMl' }
 */
router.get('/', protect, validate(listWaterQueryRules), listWater);

/**
 * @swagger
 * /water:
 *   post:
 *     tags: [Water]
 *     summary: Log a water intake event
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amountMl]
 *             properties:
 *               dependent: { type: string }
 *               amountMl: { type: number, minimum: 1, maximum: 5000 }
 *               loggedAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Water log entry created }
 *       400: { description: Validation error }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.post('/', protect, validate(logWaterRules), logWater);

/**
 * @swagger
 * /water/{id}:
 *   delete:
 *     tags: [Water]
 *     summary: Remove a water log entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Water log entry removed }
 *       404: { description: Water log entry not found or not owned by this user }
 */
router.delete('/:id', protect, validate(waterIdParamRules), deleteWater);

module.exports = router;

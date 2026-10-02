const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  logMetric, listMetrics, getLatest, deleteMetric,
} = require('../controllers/bodyMetricController');
const {
  logMetricRules, listMetricsQueryRules, metricIdParamRules,
} = require('../validators/bodyMetricValidators');

/**
 * @swagger
 * /body-metrics/latest:
 *   get:
 *     tags: [Body Metrics]
 *     summary: Most recent weight plus a computed BMI
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: 'Latest body metric entry (if any) and a computed bmi' }
 */
router.get('/latest', protect, validate(listMetricsQueryRules), getLatest);

/**
 * @swagger
 * /body-metrics:
 *   get:
 *     tags: [Body Metrics]
 *     summary: Body metric history (weight, measurements, body fat %)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of body metric entries, most recent first }
 */
router.get('/', protect, validate(listMetricsQueryRules), listMetrics);

/**
 * @swagger
 * /body-metrics:
 *   post:
 *     tags: [Body Metrics]
 *     summary: Log a body metric check-in
 *     description: At least one of weightKg, bodyFatPct, or a measurement is required.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Body metric entry created }
 *       400: { description: Validation error }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.post('/', protect, validate(logMetricRules), logMetric);

/**
 * @swagger
 * /body-metrics/{id}:
 *   delete:
 *     tags: [Body Metrics]
 *     summary: Remove a body metric entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Body metric entry removed }
 *       404: { description: Body metric entry not found or not owned by this user }
 */
router.delete('/:id', protect, validate(metricIdParamRules), deleteMetric);

module.exports = router;

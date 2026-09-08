const express = require('express');
const router = express.Router();
const { getTrends } = require('../controllers/communityController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getTrendsRules } = require('../validators/communityValidators');

/**
 * @swagger
 * /community/trends:
 *   get:
 *     tags: [Community]
 *     summary: Anonymized community symptom & severity trends
 *     description: >
 *       Aggregates recent sessions across ALL users into privacy-preserving,
 *       anonymized trend buckets. Every bucket is counted by DISTINCT USER,
 *       never by raw session/occurrence count, so a single person submitting
 *       many sessions about the same symptom can never inflate a trend past
 *       a contribution of 1. Any bucket backed by fewer than 10 distinct
 *       users is omitted entirely from the response (not shown with a low
 *       count) — a hard privacy floor, not a display choice. When fewer than
 *       10 people total used the app in the window, `insufficientData: true`
 *       is returned with empty bucket arrays.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: days
 *         required: false
 *         schema: { type: string, enum: ["7", "30"], default: "7" }
 *         description: Trend window, in days.
 *     responses:
 *       200:
 *         description: Anonymized trend data for the requested window.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 trends:
 *                   type: object
 *                   properties:
 *                     windowDays: { type: integer, example: 7 }
 *                     totalDistinctUsers: { type: integer, nullable: true, example: 42 }
 *                     topSymptoms:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           symptom: { type: string, example: headache }
 *                           userCount: { type: integer, example: 15 }
 *                           percentage: { type: number, example: 35.7 }
 *                     severityBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           severityLevel: { type: string, example: Moderate }
 *                           userCount: { type: integer, example: 12 }
 *                           percentage: { type: number, example: 28.6 }
 *                     insufficientData: { type: boolean, example: false }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/trends', protect, validate(getTrendsRules), getTrends);

module.exports = router;

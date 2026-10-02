const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getToday, getWeeklySummary } = require('../controllers/dashboardController');
const { getTodayQueryRules, getWeeklyQueryRules } = require('../validators/dashboardValidators');

/**
 * @swagger
 * /dashboard/today:
 *   get:
 *     tags: [Dashboard]
 *     summary: Unified daily view — steps, workouts, macros, water, energy balance
 *     description: >
 *       Defaults to today; `date` also works as a "day summary" for any past
 *       day. `energy` is the Daily Energy Ledger (calories consumed vs.
 *       burned vs. goal). `nutritionScore` is null with a `reason` when no
 *       calorie goal has been set yet (see /goals).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-01-15' }
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: The day's unified dashboard view }
 */
router.get('/today', protect, validate(getTodayQueryRules), getToday);

/**
 * @swagger
 * /dashboard/weekly:
 *   get:
 *     tags: [Dashboard]
 *     summary: Last 7 days (today inclusive), averaged, plus a per-day breakdown
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: Weekly averages and per-day trend data }
 */
router.get('/weekly', protect, validate(getWeeklyQueryRules), getWeeklySummary);

module.exports = router;

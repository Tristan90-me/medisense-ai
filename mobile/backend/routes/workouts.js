const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  logWorkout, listWorkouts, getPersonalRecords, getWorkout, deleteWorkout,
} = require('../controllers/workoutController');
const {
  logWorkoutRules, listWorkoutsQueryRules, dependentQueryRules, workoutIdParamRules,
} = require('../validators/workoutValidators');

/**
 * @swagger
 * /workouts/records:
 *   get:
 *     tags: [Workouts]
 *     summary: This user's current personal records
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of current PRs (strength weight, cardio distance, cardio pace) }
 */
router.get('/records', protect, validate(dependentQueryRules), getPersonalRecords);

/**
 * @swagger
 * /workouts:
 *   get:
 *     tags: [Workouts]
 *     summary: List workout logs
 *     description: A single day when `date` is given, otherwise the 50 most recent.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-01-15' }
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of workout logs }
 */
router.get('/', protect, validate(listWorkoutsQueryRules), listWorkouts);

/**
 * @swagger
 * /workouts:
 *   post:
 *     tags: [Workouts]
 *     summary: Log a completed workout
 *     description: >
 *       caloriesBurned is estimated from the workout type, duration, and the
 *       logger's current weight (see utils/workoutMath.js). Any personal
 *       records this workout sets (heaviest lift per exercise, longest
 *       distance, fastest pace) are applied automatically and returned in
 *       `newRecords`.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Workout logged, with any newly-set personal records }
 *       400: { description: Validation error, or an unknown exercise id }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.post('/', protect, validate(logWorkoutRules), logWorkout);

/**
 * @swagger
 * /workouts/{id}:
 *   get:
 *     tags: [Workouts]
 *     summary: Get one workout log
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The workout log }
 *       404: { description: Workout log not found or not owned by this user }
 */
router.get('/:id', protect, validate(workoutIdParamRules), getWorkout);

/**
 * @swagger
 * /workouts/{id}:
 *   delete:
 *     tags: [Workouts]
 *     summary: Remove a workout log
 *     description: Does not roll back any personal record this workout set — a PR remains the best-ever-recorded value.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workout log removed }
 *       404: { description: Workout log not found or not owned by this user }
 */
router.delete('/:id', protect, validate(workoutIdParamRules), deleteWorkout);

module.exports = router;

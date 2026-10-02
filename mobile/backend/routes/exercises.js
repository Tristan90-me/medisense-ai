const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { search, getExercise } = require('../controllers/exerciseController');
const { searchExercisesRules, exerciseIdParamRules } = require('../validators/exerciseValidators');

/**
 * @swagger
 * /exercises:
 *   get:
 *     tags: [Exercises]
 *     summary: Search the exercise library
 *     description: All params optional — an empty query returns the seeded library, capped at 50.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [chest, back, shoulders, arms, legs, core, cardio, full_body, other] }
 *       - in: query
 *         name: equipment
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of exercises }
 */
router.get('/', protect, validate(searchExercisesRules), search);

/**
 * @swagger
 * /exercises/{id}:
 *   get:
 *     tags: [Exercises]
 *     summary: Get one exercise
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The exercise }
 *       404: { description: Exercise not found }
 */
router.get('/:id', protect, validate(exerciseIdParamRules), getExercise);

module.exports = router;

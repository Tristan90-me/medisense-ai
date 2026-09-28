const express = require('express');
const router = express.Router();
const { getGoals, updateGoals } = require('../controllers/goalController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getGoalsRules, updateGoalsRules } = require('../validators/goalValidators');

/**
 * @swagger
 * /goals:
 *   get:
 *     tags: [Goals]
 *     summary: Get fitness and nutrition goals plus derived energy numbers
 *     description: >
 *       Returns the fitness goal, the nutrition goal, and BMR/TDEE/BMI derived
 *       from the person's health profile. `energy.missing` lists profile inputs
 *       still needed (e.g. activityLevel) before targets can be auto-calculated.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200: { description: Goals and energy summary }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.get('/', protect, validate(getGoalsRules), getGoals);

/**
 * @swagger
 * /goals:
 *   put:
 *     tags: [Goals]
 *     summary: Create or update fitness and/or nutrition goals
 *     description: >
 *       Either half may be sent. Unless `nutrition.calorieTarget` is supplied,
 *       the calorie target is recalculated from the health profile (TDEE plus
 *       the goal adjustment, clamped to a safety floor). Send
 *       `nutrition.useRecommended: true` to return a custom target to automatic.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dependent: { type: string }
 *               fitness:
 *                 type: object
 *                 properties:
 *                   goalType: { type: string, enum: [weight_loss, muscle_gain, endurance, flexibility, maintain] }
 *                   targetWeightKg: { type: number }
 *                   dailyStepGoal: { type: integer }
 *                   weeklyWorkoutGoal: { type: integer }
 *               nutrition:
 *                 type: object
 *                 properties:
 *                   goalMode: { type: string, enum: [lose, maintain, gain] }
 *                   dietPreset: { type: string, enum: [balanced, keto, low_carb, mediterranean, high_protein, vegan] }
 *                   calorieTarget: { type: integer }
 *                   waterGoalMl: { type: integer }
 *                   addBackExercise: { type: boolean }
 *                   useRecommended: { type: boolean }
 *                   macroSplit: { type: object }
 *     responses:
 *       200: { description: Updated goals and energy summary }
 *       400: { description: Validation error }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.put('/', protect, validate(updateGoalsRules), updateGoals);

module.exports = router;

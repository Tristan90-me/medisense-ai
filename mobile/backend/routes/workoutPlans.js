const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  listPlans, getPlan, createPlan, updatePlan, deletePlan,
} = require('../controllers/workoutPlanController');
const {
  createPlanRules, updatePlanRules, planIdParamRules,
} = require('../validators/workoutPlanValidators');

/**
 * @swagger
 * /workout-plans:
 *   get:
 *     tags: [Workout Plans]
 *     summary: List this user's workout plans
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of workout plans }
 */
router.get('/', protect, listPlans);

/**
 * @swagger
 * /workout-plans:
 *   post:
 *     tags: [Workout Plans]
 *     summary: Create a multi-day workout plan
 *     description: Every referenced exercise id must already exist in the library, checked before saving.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *     responses:
 *       201: { description: Workout plan created }
 *       400: { description: Validation error, or an unknown exercise id }
 */
router.post('/', protect, validate(createPlanRules), createPlan);

/**
 * @swagger
 * /workout-plans/{id}:
 *   get:
 *     tags: [Workout Plans]
 *     summary: Get one workout plan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The workout plan }
 *       404: { description: Workout plan not found or not owned by this user }
 */
router.get('/:id', protect, validate(planIdParamRules), getPlan);

/**
 * @swagger
 * /workout-plans/{id}:
 *   put:
 *     tags: [Workout Plans]
 *     summary: Update a workout plan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated workout plan }
 *       400: { description: Validation error, or an unknown exercise id }
 *       404: { description: Workout plan not found or not owned by this user }
 */
router.put('/:id', protect, validate(updatePlanRules), updatePlan);

/**
 * @swagger
 * /workout-plans/{id}:
 *   delete:
 *     tags: [Workout Plans]
 *     summary: Remove a workout plan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workout plan removed }
 *       404: { description: Workout plan not found or not owned by this user }
 */
router.delete('/:id', protect, validate(planIdParamRules), deletePlan);

module.exports = router;

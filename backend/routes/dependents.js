const express = require('express');
const router = express.Router();
const {
  getDependents, createDependent, updateDependent, deleteDependent,
} = require('../controllers/dependentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createDependentRules, updateDependentRules, dependentIdParamRules,
} = require('../validators/dependentValidators');

/**
 * @swagger
 * /dependents:
 *   get:
 *     tags: [Dependents]
 *     summary: List the current user's dependents (family members)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of dependents owned by the current user }
 */
router.get('/', protect, getDependents);

/**
 * @swagger
 * /dependents:
 *   post:
 *     tags: [Dependents]
 *     summary: Add a dependent
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, relationship]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               relationship: { type: string, enum: [child, spouse, parent, sibling, other] }
 *               dateOfBirth: { type: string, format: date }
 *               sex: { type: string, enum: [male, female, other, prefer_not_to_say] }
 *     responses:
 *       201: { description: Dependent created }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/', protect, validate(createDependentRules), createDependent);

/**
 * @swagger
 * /dependents/{id}:
 *   put:
 *     tags: [Dependents]
 *     summary: Update a dependent
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated dependent }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.put('/:id', protect, validate([...dependentIdParamRules, ...updateDependentRules]), updateDependent);

/**
 * @swagger
 * /dependents/{id}:
 *   delete:
 *     tags: [Dependents]
 *     summary: Remove a dependent
 *     description: Also deletes that dependent's HealthProfile row. Sessions/medications/health-score history referencing this dependent are retained, not cascade-deleted.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Dependent removed }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.delete('/:id', protect, validate(dependentIdParamRules), deleteDependent);

module.exports = router;

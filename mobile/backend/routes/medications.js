const express = require('express');
const router = express.Router();
const {
  getMedications, createMedication, updateMedication, deleteMedication,
} = require('../controllers/medicationController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createMedicationRules, updateMedicationRules, medicationIdParamRules, listMedicationsQueryRules,
} = require('../validators/medicationValidators');

/**
 * @swagger
 * /medications:
 *   get:
 *     tags: [Medications]
 *     summary: List medications
 *     description: >
 *       With `dependent`, scopes to that one person's medications
 *       (ownership-checked). Without it, returns the union across self and
 *       every dependent under this account in one call. active:false records
 *       are always included — this is a tracker, not a disappearing to-do list.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         required: false
 *         schema: { type: string }
 *         description: Dependent id to scope to. Omit for self + all dependents.
 *     responses:
 *       200: { description: Array of medications }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.get('/', protect, validate(listMedicationsQueryRules), getMedications);

/**
 * @swagger
 * /medications:
 *   post:
 *     tags: [Medications]
 *     summary: Add a medication
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 200 }
 *               dosage: { type: string }
 *               frequency: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               reminderTimes: { type: array, items: { type: string, example: '08:00' } }
 *               active: { type: boolean, default: true }
 *               dependent: { type: string, description: Dependent id, or omit for self }
 *     responses:
 *       201: { description: Medication created }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.post('/', protect, validate(createMedicationRules), createMedication);

/**
 * @swagger
 * /medications/{id}:
 *   put:
 *     tags: [Medications]
 *     summary: Update a medication
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated medication }
 *       404: { description: Medication not found or not owned by this user }
 */
router.put('/:id', protect, validate([...medicationIdParamRules, ...updateMedicationRules]), updateMedication);

/**
 * @swagger
 * /medications/{id}:
 *   delete:
 *     tags: [Medications]
 *     summary: Remove a medication
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Medication removed }
 *       404: { description: Medication not found or not owned by this user }
 */
router.delete('/:id', protect, validate(medicationIdParamRules), deleteMedication);

module.exports = router;

const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getProfileRules, updateProfileRules } = require('../validators/profileValidators');

/**
 * @swagger
 * /profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get the current user's health profile
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *         description: Optional dependent id — returns that dependent's profile instead of the caller's own. Must be owned by the caller.
 *     responses:
 *       200: { description: The health profile (fields may be null/empty if not yet filled in) }
 *       401: { description: Missing or invalid token }
 *       404: { description: Profile not found, or the given dependent id isn't owned by the caller }
 */
router.get('/', protect, validate(getProfileRules), getProfile);

/**
 * @swagger
 * /profile:
 *   put:
 *     tags: [Profile]
 *     summary: Create or update the current user's health profile
 *     description: All fields are optional and can be filled in incrementally across multiple visits.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dependent: { type: string, description: Optional dependent id — updates that dependent's profile instead of the caller's own. Must be owned by the caller. }
 *               dateOfBirth: { type: string, format: date }
 *               sex: { type: string, enum: [male, female, other, prefer_not_to_say] }
 *               weight: { type: number, minimum: 0 }
 *               weightUnit: { type: string, enum: [kg, lbs] }
 *               height: { type: number, minimum: 0 }
 *               heightUnit: { type: string, enum: [cm, ft] }
 *               bloodType: { type: string, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", unknown] }
 *               preExistingConditions: { type: array, items: { type: string } }
 *               allergies: { type: array, items: { type: string } }
 *               currentMedications: { type: array, items: { type: string } }
 *               familyHistory: { type: array, items: { type: string } }
 *               smokingStatus: { type: string, enum: [never, former, current] }
 *               alcoholUse: { type: string, enum: [none, occasional, moderate, heavy] }
 *     responses:
 *       200: { description: Updated health profile }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Missing or invalid token }
 */
router.put('/', protect, validate(updateProfileRules), updateProfile);

module.exports = router;

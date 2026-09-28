const express = require('express');
const router = express.Router();
const {
  getContacts, createContact, updateContact, deleteContact,
} = require('../controllers/emergencyContactController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createContactRules, updateContactRules, contactIdParamRules,
} = require('../validators/emergencyContactValidators');

/**
 * @swagger
 * /emergency-contacts:
 *   get:
 *     tags: [Emergency Contacts]
 *     summary: List the current user's emergency contacts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of emergency contacts owned by the current user }
 */
router.get('/', protect, getContacts);

/**
 * @swagger
 * /emergency-contacts:
 *   post:
 *     tags: [Emergency Contacts]
 *     summary: Add an emergency contact
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               relationship: { type: string }
 *               phone: { type: string, minLength: 5, maxLength: 20 }
 *               email: { type: string, format: email }
 *               isPrimary: { type: boolean, default: false }
 *     responses:
 *       201: { description: Emergency contact created }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/', protect, validate(createContactRules), createContact);

/**
 * @swagger
 * /emergency-contacts/{id}:
 *   put:
 *     tags: [Emergency Contacts]
 *     summary: Update an emergency contact
 *     description: Multiple contacts may have isPrimary set at the same time — this is deliberate, not exactly one primary is enforced.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated emergency contact }
 *       404: { description: Emergency contact not found or not owned by this user }
 */
router.put('/:id', protect, validate([...contactIdParamRules, ...updateContactRules]), updateContact);

/**
 * @swagger
 * /emergency-contacts/{id}:
 *   delete:
 *     tags: [Emergency Contacts]
 *     summary: Remove an emergency contact
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Emergency contact removed }
 *       404: { description: Emergency contact not found or not owned by this user }
 */
router.delete('/:id', protect, validate(contactIdParamRules), deleteContact);

module.exports = router;

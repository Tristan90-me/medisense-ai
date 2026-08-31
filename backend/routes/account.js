const express = require('express');
const router = express.Router();
const {
  getAccount, updateAccount, changePassword, listTrustedDevices,
  revokeTrustedDevice, deleteAccount,
} = require('../controllers/accountController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  updateAccountRules, changePasswordRules, deleteAccountRules, deviceIdParamRules,
} = require('../validators/accountValidators');

/**
 * @swagger
 * /account:
 *   get:
 *     tags: [Account]
 *     summary: Get the current user's account details
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user (password stripped) }
 */
router.get('/', protect, getAccount);

/**
 * @swagger
 * /account:
 *   put:
 *     tags: [Account]
 *     summary: Update account name and/or email
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Updated user }
 *       400: { description: Validation error or email already in use, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.put('/', protect, validate(updateAccountRules), updateAccount);

/**
 * @swagger
 * /account/change-password:
 *   post:
 *     tags: [Account]
 *     summary: Change the current user's password
 *     description: Clears all trusted ("remember me") devices as a security measure once the password is changed.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: Password changed }
 *       401: { description: Current password is incorrect, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/change-password', protect, validate(changePasswordRules), changePassword);

/**
 * @swagger
 * /account/trusted-devices:
 *   get:
 *     tags: [Account]
 *     summary: List trusted ("remember me") devices for the current user
 *     description: Never returns the raw device token, only its id and timestamps.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of trusted devices }
 */
router.get('/trusted-devices', protect, listTrustedDevices);

/**
 * @swagger
 * /account/trusted-devices/{id}:
 *   delete:
 *     tags: [Account]
 *     summary: Revoke a trusted device
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Device revoked }
 *       404: { description: Device not found or not owned by this user }
 */
router.delete('/trusted-devices/:id', protect, validate(deviceIdParamRules), revokeTrustedDevice);

/**
 * @swagger
 * /account:
 *   delete:
 *     tags: [Account]
 *     summary: Delete the current user's account
 *     description: Password-confirmed. Cascades — hard-deletes HealthProfile, Session, and Dependent (and dependents' HealthProfile) rows for this user. This is deliberately a broad cascade, unlike Dependents' conservative non-cascade deletion, because self-service full account deletion is a materially different, more complete action.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string }
 *     responses:
 *       200: { description: Account deleted }
 *       401: { description: Password is incorrect, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.delete('/', protect, validate(deleteAccountRules), deleteAccount);

module.exports = router;

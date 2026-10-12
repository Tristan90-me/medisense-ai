const express = require('express');
const router = express.Router();
const { createShareLink, revokeShareLink, getSharedSession } = require('../controllers/shareController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sessionIdParamRules, tokenParamRules } = require('../validators/shareValidators');

/**
 * @swagger
 * /share/session/{id}:
 *   post:
 *     tags: [Share]
 *     summary: Create a short-lived, read-only share link for a completed session's assessment
 *     description: >
 *       The resulting link exposes only severity, reported symptoms, possible
 *       conditions, recommendations, and care urgency — never the raw
 *       conversation. Expires 7 days after creation.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Share link created }
 *       400: { description: Session has no assessment to share yet }
 *       404: { description: Session not found or not owned by this user }
 */
router.post('/session/:id', protect, validate(sessionIdParamRules), createShareLink);

/**
 * @swagger
 * /share/{token}:
 *   delete:
 *     tags: [Share]
 *     summary: Revoke a share link before it expires
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Revoked }
 *       404: { description: Share link not found or not owned by this user }
 */
router.delete('/:token', protect, validate(tokenParamRules), revokeShareLink);

/**
 * @swagger
 * /share/{token}:
 *   get:
 *     tags: [Share]
 *     summary: Read a shared session's assessment (public, no auth required)
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The shared assessment subset }
 *       404: { description: Link is invalid, revoked, or expired }
 */
router.get('/:token', validate(tokenParamRules), getSharedSession);

module.exports = router;

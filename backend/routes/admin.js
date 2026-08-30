const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getStats,
  getUsers,
  getUserDetail,
  toggleUserStatus,
  getAllSessions,
  inviteAdmin,
  getPendingInvites,
  revokeInvite,
} = require('../controllers/adminController');
const validate = require('../middleware/validate');
const {
  listUsersRules, userIdParamRules, listSessionsRules, inviteAdminRules, inviteIdParamRules,
} = require('../validators/adminValidators');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get dashboard summary stats
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Aggregate counts (users, sessions, emergencies, etc.) }
 *       403: { description: Authenticated but not an admin }
 */
router.get('/stats', getStats);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List consumer users
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches against name/email.
 *     responses:
 *       200: { description: Paginated list of users }
 *       403: { description: Authenticated but not an admin }
 */
router.get('/users', validate(listUsersRules), getUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get a single user's detail
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User detail including profile and session summary }
 *       404: { description: User not found }
 */
router.get('/users/:id', validate(userIdParamRules), getUserDetail);

/**
 * @swagger
 * /admin/users/{id}/toggle:
 *   patch:
 *     tags: [Admin]
 *     summary: Toggle a user's active/suspended status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated user with new status }
 *       404: { description: User not found }
 */
router.patch('/users/:id/toggle', validate(userIdParamRules), toggleUserStatus);

/**
 * @swagger
 * /admin/sessions:
 *   get:
 *     tags: [Admin]
 *     summary: List symptom-check sessions across all users
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [Low, Moderate, High, Critical] }
 *       - in: query
 *         name: emergency
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, completed, abandoned] }
 *     responses:
 *       200: { description: Paginated list of sessions across all users }
 */
router.get('/sessions', validate(listSessionsRules), getAllSessions);

/**
 * @swagger
 * /admin/invites:
 *   post:
 *     tags: [Admin]
 *     summary: Invite a new admin
 *     description: >
 *       Creates a placeholder user (role admin, unverified, unusable password) and emails
 *       an accept-invite link. Retrying with the same email while a prior invite is still
 *       pending resends rather than erroring; if the email send itself fails, the invite
 *       record is still created and 201 is returned with a message noting delivery may
 *       have failed, rather than a misleading 500.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               email: { type: string, format: email }
 *     responses:
 *       201: { description: Invite created (and email sent, or attempted) }
 *       400: { description: Validation error, or email already belongs to an active admin, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/invites', validate(inviteAdminRules), inviteAdmin);

/**
 * @swagger
 * /admin/invites:
 *   get:
 *     tags: [Admin]
 *     summary: List pending (unaccepted, unexpired) admin invites
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of pending invites }
 */
router.get('/invites', getPendingInvites);

/**
 * @swagger
 * /admin/invites/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Revoke a pending admin invite
 *     description: Only removes a genuinely still-pending invite — cannot be used to delete an active admin account.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Invite revoked }
 *       404: { description: No pending invite with that id }
 */
router.delete('/invites/:id', validate(inviteIdParamRules), revokeInvite);

module.exports = router;

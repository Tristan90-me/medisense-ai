const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getStats,
  getUsers,
  getUserDetail,
  toggleUserStatus,
  getAllSessions,
  getFlaggedSessions,
  reviewSession,
  exportUsersCsv,
  exportSessionsCsv,
  inviteAdmin,
  getPendingInvites,
  revokeInvite,
} = require('../controllers/adminController');
const { getAuditLog } = require('../controllers/auditLogController');
const {
  getSettings, updateSetting, previewPrompt,
} = require('../controllers/systemSettingController');
const validate = require('../middleware/validate');
const {
  listUsersRules, userIdParamRules, listSessionsRules, inviteAdminRules, inviteIdParamRules,
  flaggedSessionsQueryRules, reviewSessionRules, sessionIdParamRules,
} = require('../validators/adminValidators');
const { getAuditLogRules } = require('../validators/auditLogValidators');
const { updateSettingRules, previewPromptRules } = require('../validators/systemSettingValidators');

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
 * /admin/sessions/flagged:
 *   get:
 *     tags: [Admin]
 *     summary: List sessions flagged for moderation review
 *     description: >
 *       A session is auto-flagged (flaggedForReview: true) the moment the LLM
 *       declares an emergency OR the independent rule-based triage layer
 *       disagrees with the LLM's own severity call (severityMismatch). The
 *       flag is permanent once set — reviewing a session records who/when/notes
 *       without ever clearing it.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, reviewed] }
 *         description: pending = reviewedAt is null, reviewed = reviewedAt is set.
 *     responses:
 *       200: { description: Paginated list of flagged sessions }
 *       403: { description: Authenticated but not an admin }
 */
router.get('/sessions/flagged', validate(flaggedSessionsQueryRules), getFlaggedSessions);

/**
 * @swagger
 * /admin/sessions/{id}/review:
 *   patch:
 *     tags: [Admin]
 *     summary: Mark a flagged session as reviewed
 *     description: Sets reviewedBy/reviewedAt/reviewNotes. Does NOT clear flaggedForReview — that flag is a permanent historical record.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewNotes: { type: string, maxLength: 1000 }
 *     responses:
 *       200: { description: Updated session }
 *       404: { description: Session not found }
 */
router.patch('/sessions/:id/review', validate([...sessionIdParamRules, ...reviewSessionRules]), reviewSession);

/**
 * @swagger
 * /admin/export/users.csv:
 *   get:
 *     tags: [Admin]
 *     summary: Export all users matching the given filter as CSV
 *     description: >
 *       Same optional filter as GET /admin/users (search), but with no
 *       pagination — every matching row is streamed. Columns: name, email,
 *       role, isActive, createdAt, sessionCount.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 */
router.get('/export/users.csv', validate(listUsersRules), exportUsersCsv);

/**
 * @swagger
 * /admin/export/sessions.csv:
 *   get:
 *     tags: [Admin]
 *     summary: Export all sessions matching the given filter as CSV
 *     description: >
 *       Same optional filters as GET /admin/sessions (severity, emergency,
 *       status), but with no pagination — every matching row is streamed.
 *       Columns: user name/email, mode, status, severityLevel, severityScore,
 *       emergencyDetected, flaggedForReview, createdAt.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 */
router.get('/export/sessions.csv', validate(listSessionsRules), exportSessionsCsv);

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

/**
 * @swagger
 * /admin/audit-log:
 *   get:
 *     tags: [Admin]
 *     summary: List audit log entries for admin actions
 *     description: >
 *       Paginated, most-recent-first log of sensitive admin actions (invites,
 *       revocations, user status changes, session reviews, exports, settings
 *       changes). Written via utils/auditLogger.js at each sensitive write
 *       site — never derived after the fact.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *         description: Exact match, e.g. "admin.invite", "user.toggle_status".
 *       - in: query
 *         name: actor
 *         schema: { type: string }
 *         description: Filter to actions performed by this admin user id.
 *       - in: query
 *         name: targetType
 *         schema: { type: string }
 *         description: Exact match, e.g. "User", "Session", "SystemSetting".
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: ISO8601 lower bound (inclusive) on createdAt.
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: ISO8601 upper bound (inclusive) on createdAt.
 *     responses:
 *       200: { description: Paginated list of audit log entries }
 *       403: { description: Authenticated but not an admin }
 */
router.get('/audit-log', validate(getAuditLogRules), getAuditLog);

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     tags: [Admin]
 *     summary: List all system settings
 *     description: >
 *       Returns every SystemSetting document (one per key, e.g.
 *       'systemPrompt', 'emergencyKeywords') — a small, low-cardinality
 *       collection, not paginated.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of setting documents }
 *       403: { description: Authenticated but not an admin }
 */
router.get('/settings', getSettings);

/**
 * @swagger
 * /admin/settings/{key}:
 *   put:
 *     tags: [Admin]
 *     summary: Create or update a system setting (upsert)
 *     description: >
 *       This is a DIFFERENT path prefix than the admin-invite management
 *       page (which uses /admin/invites*) — no route collision. `key`
 *       examples: 'systemPrompt' (string), 'emergencyKeywords' (string array).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value: {}
 *     responses:
 *       200: { description: Upserted setting document }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.put('/settings/:key', validate(updateSettingRules), updateSetting);

/**
 * @swagger
 * /admin/settings/preview-prompt:
 *   post:
 *     tags: [Admin]
 *     summary: Preview a DRAFT (unsaved) AI system prompt's behavior
 *     description: >
 *       Runs the given draft prompt against a single fixed test message
 *       ("I have a mild headache, what should I do?") and returns the real
 *       (mocked-in-tests) model response, WITHOUT persisting the prompt
 *       anywhere. Intended as a required test step before saving a new
 *       systemPrompt setting, since it directly controls emergency-detection
 *       wording.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt: { type: string, minLength: 1, maxLength: 8000 }
 *     responses:
 *       200: { description: The model's raw response text under the draft prompt }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/settings/preview-prompt', validate(previewPromptRules), previewPrompt);

module.exports = router;

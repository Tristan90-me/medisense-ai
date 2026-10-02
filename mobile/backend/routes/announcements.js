const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createAndBroadcast, listAnnouncements, deleteAnnouncement, getCriticalPreview,
} = require('../controllers/announcementController');
const {
  createAnnouncementRules, announcementIdParamRules, criticalPreviewRules,
} = require('../validators/announcementValidators');

// Mixed access on one resource — POST/DELETE need adminOnly, GET is plain
// protect — so middleware is applied per-route here rather than at the
// router level (unlike routes/admin.js, which is entirely
// protect+adminOnly at the router level).

/**
 * @swagger
 * /announcements:
 *   post:
 *     tags: [Announcements]
 *     summary: Create and broadcast an in-app announcement (admin only)
 *     description: >
 *       In-app only — no push notification/VAPID infrastructure. Every
 *       authenticated consumer sees the announcement the next time they load
 *       their dashboard's notification bell. Writes an audit log entry
 *       (announcement.create).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               body: { type: string, maxLength: 2000 }
 *               audience: { type: string, enum: [all, critical, user], default: all, description: 'all: every user. critical: users with an emergency/Critical-severity session in the trailing window. user: a single targetUserId.' }
 *               targetUserId: { type: string, description: 'Required when audience is "user" — the recipient User id.' }
 *               criticalWindowDays: { type: integer, minimum: 1, maximum: 365, default: 30, description: 'Only used when audience is "critical" — how many trailing days to scan for emergency/Critical sessions.' }
 *     responses:
 *       201: { description: Announcement created and broadcast }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Authenticated but not an admin }
 *       404: { description: targetUserId not found (audience "user" only) }
 */
router.post('/', protect, adminOnly, validate(createAnnouncementRules), createAndBroadcast);

/**
 * @swagger
 * /announcements/critical-preview:
 *   get:
 *     tags: [Announcements]
 *     summary: Preview how many/which users a 'critical' audience send would reach (admin only)
 *     description: >
 *       Read-only — runs the same emergency/Critical-severity-session lookup
 *       used by a 'critical' broadcast, without creating or sending anything,
 *       so an admin can see the reach before confirming a bulk send.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, maximum: 365, default: 30 }
 *     responses:
 *       200: { description: 'Recipient count plus a small sample (name/email)' }
 *       403: { description: Authenticated but not an admin }
 */
router.get('/critical-preview', protect, adminOnly, validate(criticalPreviewRules), getCriticalPreview);

/**
 * @swagger
 * /announcements:
 *   get:
 *     tags: [Announcements]
 *     summary: List recent announcements
 *     description: >
 *       Any authenticated user (consumer or admin) can read the announcement
 *       feed. Returns the most recent 50, newest first — a notification
 *       feed, not a paginated archive.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of announcements, most recent first }
 */
router.get('/', protect, listAnnouncements);

/**
 * @swagger
 * /announcements/{id}:
 *   delete:
 *     tags: [Announcements]
 *     summary: Retract an announcement (admin only)
 *     description: >
 *       Any admin can retract any announcement — it's a shared broadcast,
 *       not a personal resource, so there's no ownership check. Writes an
 *       audit log entry (announcement.delete).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Announcement removed }
 *       403: { description: Authenticated but not an admin }
 *       404: { description: Announcement not found }
 */
router.delete('/:id', protect, adminOnly, validate(announcementIdParamRules), deleteAnnouncement);

module.exports = router;

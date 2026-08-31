const express = require('express');
const router = express.Router();
const {
  startSession, sendMessage, sendMessageStream, getSummary,
  getSessions, getSession, assistantChat,
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  startSessionRules, sendMessageRules, sessionIdParamRules, assistantChatRules,
} = require('../validators/aiValidators');

/**
 * @swagger
 * /ai/session/start:
 *   post:
 *     tags: [AI]
 *     summary: Start a guided symptom-check session
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode: { type: string, enum: [quick, full], description: Defaults to a standard guided flow if omitted. }
 *               dependentId: { type: string, description: Optional dependent id — starts/resumes a session about that dependent instead of the caller. Must be owned by the caller. }
 *     responses:
 *       201: { description: New session created, with the AI's opening message }
 *       401: { description: Missing or invalid token }
 *       404: { description: The given dependentId isn't owned by the caller }
 */
router.post('/session/start', protect, validate(startSessionRules), startSession);

/**
 * @swagger
 * /ai/session/message:
 *   post:
 *     tags: [AI]
 *     summary: Send a message within a symptom-check session (non-streaming)
 *     description: >
 *       Returns the full AI reply in one response, with bracket-tagged metadata
 *       ([EMERGENCY], [SEVERITY], [SYMPTOMS], [DIAGNOSIS], [SUGGESTIONS]) parsed
 *       out into structured fields, plus an independent rule-based triage
 *       cross-check (`ruleBasedTriage`/`severityMismatch`) computed server-side
 *       from the session's extracted symptoms — never derived from the LLM's
 *       own output, so it can catch a severity call the LLM under-calls.
 *       See /ai/session/message/stream for the SSE equivalent.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, message]
 *             properties:
 *               sessionId: { type: string, description: MongoDB ObjectId of an existing session. }
 *               message: { type: string, maxLength: 4000 }
 *     responses:
 *       200:
 *         description: AI reply plus parsed metadata (emergency flag, severity, symptoms, diagnosis, suggestions, rule-based triage)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 emergency: { type: boolean }
 *                 severity: { type: object, nullable: true }
 *                 symptoms: { type: object, nullable: true }
 *                 diagnosis: { type: object, nullable: true }
 *                 suggestions: { type: array, items: { type: string } }
 *                 sessionStatus: { type: string, enum: [active, completed, abandoned] }
 *                 ruleBasedTriage:
 *                   type: object
 *                   description: Independent, keyword-rule-based red-flag check — never derived from the LLM's own output.
 *                   properties:
 *                     level: { type: string, enum: [Low, Critical] }
 *                     score: { type: number }
 *                     matchedRules: { type: array, items: { type: string } }
 *                 severityMismatch:
 *                   type: boolean
 *                   description: True only when the rule-based check found a Critical red flag that the LLM's own severity/emergency output did not reflect — the moderation auto-flag trigger.
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Session not found or not owned by this user }
 */
router.post('/session/message', protect, validate(sendMessageRules), sendMessage);

/**
 * @swagger
 * /ai/session/message/stream:
 *   post:
 *     tags: [AI]
 *     summary: Send a message within a symptom-check session (SSE streaming)
 *     description: >
 *       Same input as /ai/session/message, but the reply streams back as
 *       Server-Sent Events (text/event-stream) token-by-token. Bracket-tagged
 *       metadata is only parsed once from the fully accumulated text after the
 *       stream completes, sent as a final `event: done` payload.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, message]
 *             properties:
 *               sessionId: { type: string }
 *               message: { type: string, maxLength: 4000 }
 *     responses:
 *       200: { description: "text/event-stream of reply chunks, terminated by a `done` event carrying the same fields as /ai/session/message's 200 response (including ruleBasedTriage/severityMismatch)", content: { text/event-stream: {} } }
 *       400: { description: Validation error }
 *       404: { description: Session not found or not owned by this user }
 */
router.post('/session/message/stream', protect, validate(sendMessageRules), sendMessageStream);

/**
 * @swagger
 * /ai/session/{id}/summary:
 *   get:
 *     tags: [AI]
 *     summary: Get an AI-generated summary of a completed session
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId of the session.
 *     responses:
 *       200: { description: Generated summary text }
 *       404: { description: Session not found or not owned by this user }
 */
router.get('/session/:id/summary', protect, validate(sessionIdParamRules), getSummary);

/**
 * @swagger
 * /ai/sessions:
 *   get:
 *     tags: [AI]
 *     summary: List the current user's symptom-check sessions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of session summaries, most recent first }
 */
router.get('/sessions', protect, getSessions);

/**
 * @swagger
 * /ai/session/{id}:
 *   get:
 *     tags: [AI]
 *     summary: Get a single session's full message history
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Full session with all messages }
 *       404: { description: Session not found or not owned by this user }
 */
router.get('/session/:id', protect, validate(sessionIdParamRules), getSession);

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: Send a message to the floating assistant (general Q&A, not a guided session)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, maxLength: 4000 }
 *               history:
 *                 type: array
 *                 description: Prior turns of this conversation, oldest first, for context.
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, assistant] }
 *                     content: { type: string }
 *     responses:
 *       200: { description: Assistant's reply }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/chat', protect, validate(assistantChatRules), assistantChat);

module.exports = router;

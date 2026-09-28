const express = require('express');
const router = express.Router();
const {
  adminLogin, adminResendOtp, adminVerifyOtp, acceptAdminInvite, getMe,
} = require('../controllers/authAdminController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  adminLoginRules, adminResendOtpRules, adminVerifyOtpRules, acceptAdminInviteRules,
} = require('../validators/adminAuthValidators');

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Admin login (step 1 of 2 — sends an OTP)
 *     description: >
 *       Completely separate from consumer /auth/login. Rejects a wrong password, an unknown
 *       email, AND a correct-password-but-non-admin account with the identical generic
 *       message — never reveals which case it was. No trusted-device bypass exists here;
 *       OTP is always required.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: OTP sent }
 *       401: { description: Invalid credentials (also returned for a valid non-admin account), content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/login', validate(adminLoginRules), adminLogin);

/**
 * @swagger
 * /admin/auth/resend-otp:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Resend the admin login OTP
 *     description: Same safe pattern as the consumer resend-otp — only sends if there's a genuinely live pending OTP for an admin account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Generic success response, sent or not }
 */
router.post('/resend-otp', validate(adminResendOtpRules), adminResendOtp);

/**
 * @swagger
 * /admin/auth/verify-otp:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Admin login (step 2 of 2 — verify the OTP)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, example: "123456", minLength: 6, maxLength: 6 }
 *     responses:
 *       200: { description: Login complete — returns a JWT and the admin user object }
 *       400: { description: Incorrect or expired code }
 *       404: { description: No admin account with that email }
 *       429: { description: Too many incorrect attempts }
 */
router.post('/verify-otp', validate(adminVerifyOtpRules), adminVerifyOtp);

/**
 * @swagger
 * /admin/auth/accept-invite:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Accept an admin invite and set a password
 *     description: Public endpoint — the only way an admin account becomes usable other than the CLI bootstrap script. The invite token is single-use.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string, description: Raw token from the invite email link. }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: Password set — the account can now log in }
 *       400: { description: Invite link invalid, expired, or already used }
 */
router.post('/accept-invite', validate(acceptAdminInviteRules), acceptAdminInvite);

/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     tags: [Admin Auth]
 *     summary: Get the current admin user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The authenticated admin user }
 *       401: { description: Missing or invalid token }
 *       403: { description: Token is valid but does not belong to an admin }
 */
router.get('/me', protect, adminOnly, getMe);

module.exports = router;

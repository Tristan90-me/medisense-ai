const express = require('express');
const router = express.Router();
const {
  register, verifyEmail, resendVerification,
  login, resendOtp, verifyOtp, getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  registerRules, verifyEmailRules, resendVerificationRules,
  loginRules, resendOtpRules, verifyOtpRules,
} = require('../validators/authValidators');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a consumer account
 *     description: Creates an unverified account and emails a verification link. Role is always "user" — there is no way to self-register as admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Jane Doe }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       201: { description: Account created, verification email sent }
 *       400: { description: Validation error or email already registered, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/register', validate(registerRules), register);

/**
 * @swagger
 * /auth/verify-email/{token}:
 *   get:
 *     tags: [Auth]
 *     summary: Verify an email address
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: Raw token from the verification email link (hashed and compared server-side).
 *     responses:
 *       200: { description: Email verified }
 *       400: { description: Link invalid or expired }
 */
router.get('/verify-email/:token', validate(verifyEmailRules), verifyEmail);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the email verification link
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
 *       200: { description: Verification email resent }
 *       404: { description: No account with that email }
 */
router.post('/resend-verification', validate(resendVerificationRules), resendVerification);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in (step 1 of 2 — sends an OTP)
 *     description: Verifies email/password. If `deviceToken` matches a trusted device, skips the OTP step and returns a JWT immediately (`step:"done"`); otherwise emails a 6-digit code (`step:"otp"`).
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
 *               deviceToken: { type: string, description: Optional trusted-device token from a previous "remember me" login. }
 *     responses:
 *       200: { description: "OTP sent, or login completed if the device is trusted" }
 *       401: { description: Invalid credentials, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Email not verified (code EMAIL_NOT_VERIFIED) }
 */
router.post('/login', validate(loginRules), login);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the login OTP
 *     description: Only actually sends a new code if the account has a genuinely live pending OTP (mid-login-flow) — otherwise responds identically without sending anything, so this can't be used to probe account existence.
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
router.post('/resend-otp', validate(resendOtpRules), resendOtp);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Log in (step 2 of 2 — verify the OTP)
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
 *               rememberDays: { type: integer, enum: [7, 14], description: Optional — registers this device as trusted for N days. }
 *     responses:
 *       200: { description: Login complete — returns a JWT and the user object }
 *       400: { description: Incorrect or expired code }
 *       429: { description: Too many incorrect attempts }
 */
router.post('/verify-otp', validate(verifyOtpRules), verifyOtp);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current consumer user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The authenticated user }
 *       401: { description: Missing or invalid token }
 */
router.get('/me', protect, getMe);

module.exports = router;

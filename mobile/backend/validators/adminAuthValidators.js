const { body } = require('express-validator');

exports.adminLoginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.adminResendOtpRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
];

exports.adminVerifyOtpRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits').isNumeric().withMessage('Code must be numeric'),
];

exports.acceptAdminInviteRules = [
  body('token').trim().notEmpty().withMessage('Invite token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

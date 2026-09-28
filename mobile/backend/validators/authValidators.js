const { body, param } = require('express-validator');

exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

exports.verifyEmailRules = [
  param('token').trim().notEmpty().withMessage('Verification token is required'),
];

exports.resendVerificationRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
];

exports.loginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.resendOtpRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
];

exports.verifyOtpRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits').isNumeric().withMessage('Code must be numeric'),
  body('rememberDays').optional().isIn([7, 14]).withMessage('rememberDays must be 7 or 14'),
];

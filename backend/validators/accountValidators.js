const { body, param } = require('express-validator');

exports.updateAccountRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
  body('email').optional().trim().isEmail().withMessage('Invalid email').normalizeEmail(),
];

exports.changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').notEmpty().withMessage('New password is required').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

exports.deleteAccountRules = [
  body('password').notEmpty().withMessage('Password is required'),
];

exports.deviceIdParamRules = [
  param('id').isMongoId().withMessage('Invalid device id'),
];

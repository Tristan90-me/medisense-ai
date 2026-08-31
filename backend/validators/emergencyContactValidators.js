const { body, param } = require('express-validator');

// Phone is checked permissively (length only) rather than with isMobilePhone,
// which is too strict for real international formats (spaces, dashes,
// parentheses, extensions, etc.).
exports.createContactRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('relationship').optional({ nullable: true }).trim().isString(),
  body('phone').trim().notEmpty().withMessage('Phone is required').isLength({ min: 5, max: 20 }),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
  body('isPrimary').optional().isBoolean().withMessage('isPrimary must be a boolean'),
];

exports.updateContactRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
  body('relationship').optional({ nullable: true }).trim().isString(),
  body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty').isLength({ min: 5, max: 20 }),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
  body('isPrimary').optional().isBoolean().withMessage('isPrimary must be a boolean'),
];

exports.contactIdParamRules = [
  param('id').isMongoId().withMessage('Invalid emergency contact id'),
];

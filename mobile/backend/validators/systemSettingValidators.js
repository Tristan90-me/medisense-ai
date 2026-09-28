const { param, body } = require('express-validator');

exports.updateSettingRules = [
  param('key').isString().notEmpty().withMessage('key is required'),
  body('value').exists().withMessage('value is required'),
];

exports.previewPromptRules = [
  body('prompt').isString().isLength({ min: 1, max: 8000 }).withMessage('prompt must be between 1 and 8000 characters'),
];

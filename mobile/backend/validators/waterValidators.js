const { body, param, query } = require('express-validator');

exports.logWaterRules = [
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
  body('amountMl').isFloat({ min: 1, max: 5000 }).withMessage('amountMl must be between 1 and 5000'),
  body('loggedAt').optional({ nullable: true }).isISO8601().withMessage('loggedAt must be a valid date'),
];

exports.listWaterQueryRules = [
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.waterIdParamRules = [
  param('id').isMongoId().withMessage('Invalid water log id'),
];

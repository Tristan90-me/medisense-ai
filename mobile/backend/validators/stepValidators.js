const { body, query } = require('express-validator');

exports.syncStepsRules = [
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
  body('steps').isInt({ min: 0 }).withMessage('steps must be a non-negative integer'),
  body('date').optional({ nullable: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
];

exports.getDayQueryRules = [
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.getRangeQueryRules = [
  query('days').optional().isInt({ min: 1, max: 90 }).withMessage('days must be between 1 and 90'),
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

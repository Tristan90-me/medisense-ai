const { query } = require('express-validator');

exports.getTodayQueryRules = [
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.getWeeklyQueryRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

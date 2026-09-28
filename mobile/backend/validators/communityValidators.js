const { query } = require('express-validator');

exports.getTrendsRules = [
  query('days').optional().isIn(['7', '30']).withMessage('days must be 7 or 30'),
];

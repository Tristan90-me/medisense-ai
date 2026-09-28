const { query } = require('express-validator');

exports.getHealthScoreRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

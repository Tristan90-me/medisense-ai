const { body, query } = require('express-validator');

exports.estimateMealPhotoRules = [
  body('context').optional({ nullable: true }).trim().isLength({ max: 300 }),
];

exports.getSuggestionQueryRules = [
  query('kind').optional().isIn(['meal', 'workout']).withMessage('kind must be meal or workout'),
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

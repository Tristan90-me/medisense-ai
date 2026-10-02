const { param, query } = require('express-validator');

exports.searchExercisesRules = [
  query('q').optional({ nullable: true }).trim().isLength({ max: 100 }),
  query('category').optional({ nullable: true }).isIn(['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body', 'other']).withMessage('Invalid category'),
  query('equipment').optional({ nullable: true }).trim().isLength({ max: 50 }),
];

exports.exerciseIdParamRules = [
  param('id').isMongoId().withMessage('Invalid exercise id'),
];

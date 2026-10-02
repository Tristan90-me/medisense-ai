const { body, param } = require('express-validator');

exports.createPlanRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('days').isArray({ min: 1 }).withMessage('At least one day is required'),
  body('days.*.dayNumber').isInt({ min: 1 }).withMessage('dayNumber must be at least 1'),
  body('days.*.label').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('days.*.isRestDay').optional().isBoolean(),
  body('days.*.exercises').optional().isArray(),
  body('days.*.exercises.*.exercise').optional().isMongoId().withMessage('Invalid exercise id'),
  body('days.*.exercises.*.targetSets').optional({ nullable: true }).isFloat({ min: 0 }),
  body('days.*.exercises.*.targetReps').optional({ nullable: true }).isFloat({ min: 0 }),
  body('days.*.exercises.*.targetWeightKg').optional({ nullable: true }).isFloat({ min: 0 }),
  body('days.*.exercises.*.notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('active').optional().isBoolean(),
];

exports.updatePlanRules = [
  param('id').isMongoId().withMessage('Invalid workout plan id'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 200 }),
  body('days').optional().isArray({ min: 1 }).withMessage('At least one day is required'),
  body('days.*.dayNumber').optional().isInt({ min: 1 }).withMessage('dayNumber must be at least 1'),
  body('days.*.label').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('days.*.isRestDay').optional().isBoolean(),
  body('days.*.exercises').optional().isArray(),
  body('days.*.exercises.*.exercise').optional().isMongoId().withMessage('Invalid exercise id'),
  body('days.*.exercises.*.targetSets').optional({ nullable: true }).isFloat({ min: 0 }),
  body('days.*.exercises.*.targetReps').optional({ nullable: true }).isFloat({ min: 0 }),
  body('days.*.exercises.*.targetWeightKg').optional({ nullable: true }).isFloat({ min: 0 }),
  body('days.*.exercises.*.notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('active').optional().isBoolean(),
];

exports.planIdParamRules = [
  param('id').isMongoId().withMessage('Invalid workout plan id'),
];

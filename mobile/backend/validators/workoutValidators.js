const { body, param, query } = require('express-validator');

exports.logWorkoutRules = [
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
  body('type').isIn(['strength', 'cardio', 'flexibility', 'other']).withMessage('Invalid type'),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('durationMin').isFloat({ min: 1 }).withMessage('durationMin must be a positive number'),
  body('loggedAt').optional({ nullable: true }).isISO8601().withMessage('loggedAt must be a valid date'),

  body('exercises').optional().isArray(),
  body('exercises.*.exercise').isMongoId().withMessage('Invalid exercise id'),
  body('exercises.*.sets').optional().isArray(),
  body('exercises.*.sets.*.reps').optional({ nullable: true }).isFloat({ min: 0 }),
  body('exercises.*.sets.*.weightKg').optional({ nullable: true }).isFloat({ min: 0 }),

  body('cardio').optional().isObject(),
  body('cardio.distanceKm').if(body('type').equals('cardio')).isFloat({ min: 0.01 }).withMessage('cardio.distanceKm must be a positive number'),

  body('workoutPlan').optional({ nullable: true }).isMongoId().withMessage('Invalid workoutPlan id'),
  body('planDayNumber').optional({ nullable: true }).isInt({ min: 1 }),
  body('notes').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

exports.listWorkoutsQueryRules = [
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.dependentQueryRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.workoutIdParamRules = [
  param('id').isMongoId().withMessage('Invalid workout log id'),
];

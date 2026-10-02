const { body, param, query } = require('express-validator');

exports.logMealRules = [
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
  body('mealType').isIn(['breakfast', 'lunch', 'dinner', 'snack']).withMessage('Invalid mealType'),
  body('kind').isIn(['food', 'recipe', 'quick_add']).withMessage('Invalid kind'),
  body('loggedAt').optional({ nullable: true }).isISO8601().withMessage('loggedAt must be a valid date'),

  // kind: 'food'
  body('foodKind').if(body('kind').equals('food')).isIn(['FoodItem', 'CustomFood']).withMessage('Invalid foodKind'),
  body('food').if(body('kind').equals('food')).isMongoId().withMessage('Invalid food id'),
  body('grams').if(body('kind').equals('food')).isFloat({ min: 0.1 }).withMessage('grams must be a positive number'),
  body('servingLabel').optional({ nullable: true }).trim().isLength({ max: 100 }),

  // kind: 'recipe'
  body('recipe').if(body('kind').equals('recipe')).isMongoId().withMessage('Invalid recipe id'),
  body('servingsOfRecipe').if(body('kind').equals('recipe')).isFloat({ min: 0.01 }).withMessage('servingsOfRecipe must be a positive number'),

  // kind: 'quick_add'
  body('name').if(body('kind').equals('quick_add')).trim().notEmpty().withMessage('name is required').isLength({ max: 200 }),
  body('quickAdd').if(body('kind').equals('quick_add')).isObject().withMessage('quickAdd is required'),
  body('quickAdd.calories').if(body('kind').equals('quick_add')).isFloat({ min: 0 }).withMessage('quickAdd.calories must be a non-negative number'),
  body('quickAdd.carbsG').if(body('kind').equals('quick_add')).isFloat({ min: 0 }).withMessage('quickAdd.carbsG must be a non-negative number'),
  body('quickAdd.proteinG').if(body('kind').equals('quick_add')).isFloat({ min: 0 }).withMessage('quickAdd.proteinG must be a non-negative number'),
  body('quickAdd.fatG').if(body('kind').equals('quick_add')).isFloat({ min: 0 }).withMessage('quickAdd.fatG must be a non-negative number'),
];

exports.listMealsQueryRules = [
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.dependentQueryRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.updateMealRules = [
  param('id').isMongoId().withMessage('Invalid meal log id'),
  body('mealType').optional().isIn(['breakfast', 'lunch', 'dinner', 'snack']).withMessage('Invalid mealType'),
  body('isFavourite').optional().isBoolean().withMessage('isFavourite must be a boolean'),
  body('grams').optional().isFloat({ min: 0.1 }).withMessage('grams must be a positive number'),
];

exports.mealIdParamRules = [
  param('id').isMongoId().withMessage('Invalid meal log id'),
];

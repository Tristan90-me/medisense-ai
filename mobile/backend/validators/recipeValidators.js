const { body, param } = require('express-validator');

exports.createRecipeRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('servings').optional().isFloat({ min: 1 }).withMessage('servings must be at least 1'),
  body('ingredients').isArray({ min: 1 }).withMessage('At least one ingredient is required'),
  body('ingredients.*.foodKind').isIn(['FoodItem', 'CustomFood']).withMessage('Invalid ingredient foodKind'),
  body('ingredients.*.food').isMongoId().withMessage('Invalid ingredient food id'),
  body('ingredients.*.grams').isFloat({ min: 0 }).withMessage('ingredient grams must be a non-negative number'),
  body('ingredients.*.label').optional().trim().isLength({ max: 200 }),
];

exports.updateRecipeRules = [
  param('id').isMongoId().withMessage('Invalid recipe id'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 200 }),
  body('servings').optional().isFloat({ min: 1 }).withMessage('servings must be at least 1'),
  body('ingredients').optional().isArray({ min: 1 }).withMessage('At least one ingredient is required'),
  body('ingredients.*.foodKind').optional().isIn(['FoodItem', 'CustomFood']).withMessage('Invalid ingredient foodKind'),
  body('ingredients.*.food').optional().isMongoId().withMessage('Invalid ingredient food id'),
  body('ingredients.*.grams').optional().isFloat({ min: 0 }).withMessage('ingredient grams must be a non-negative number'),
  body('ingredients.*.label').optional().trim().isLength({ max: 200 }),
];

exports.recipeIdParamRules = [
  param('id').isMongoId().withMessage('Invalid recipe id'),
];

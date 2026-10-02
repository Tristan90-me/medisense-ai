const { body, param, query } = require('express-validator');
const { NUTRITION_FIELDS } = require('../utils/nutritionMath');

// Generates one rule per nutrition field so this always matches
// nutritionMath's field list instead of a hand-copied, driftable list.
const per100gRules = (prefix) => NUTRITION_FIELDS.map((f) => body(`${prefix}.${f}`)
  .optional({ nullable: true })
  .isFloat({ min: 0 })
  .withMessage(`${prefix}.${f} must be a non-negative number`));

exports.searchFoodsRules = [
  query('q').trim().notEmpty().withMessage('q is required').isLength({ min: 1, max: 100 }),
];

exports.barcodeParamRules = [
  param('code').trim().notEmpty().matches(/^[0-9]{4,20}$/).withMessage('Invalid barcode'),
];

exports.createCustomFoodRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('brand').optional({ nullable: true }).trim().isLength({ max: 200 }),
  ...per100gRules('per100g'),
  body('servingOptions').optional().isArray().withMessage('servingOptions must be an array'),
  body('servingOptions.*.label').optional().trim().notEmpty().withMessage('servingOptions[].label is required'),
  body('servingOptions.*.grams').optional().isFloat({ min: 0 }).withMessage('servingOptions[].grams must be a non-negative number'),
];

exports.updateCustomFoodRules = [
  param('id').isMongoId().withMessage('Invalid custom food id'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 200 }),
  body('brand').optional({ nullable: true }).trim().isLength({ max: 200 }),
  ...per100gRules('per100g'),
  body('servingOptions').optional().isArray().withMessage('servingOptions must be an array'),
  body('servingOptions.*.label').optional().trim().notEmpty().withMessage('servingOptions[].label is required'),
  body('servingOptions.*.grams').optional().isFloat({ min: 0 }).withMessage('servingOptions[].grams must be a non-negative number'),
];

exports.customFoodIdParamRules = [
  param('id').isMongoId().withMessage('Invalid custom food id'),
];

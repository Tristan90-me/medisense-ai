const { body, param } = require('express-validator');

const RELATIONSHIPS = ['child', 'spouse', 'parent', 'sibling', 'other'];
const SEX_VALUES = ['male', 'female', 'other', 'prefer_not_to_say'];

exports.createDependentRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('relationship').isIn(RELATIONSHIPS).withMessage('Invalid relationship'),
  body('dateOfBirth').optional({ nullable: true }).isISO8601().withMessage('dateOfBirth must be a valid date'),
  body('sex').optional({ nullable: true }).isIn(SEX_VALUES).withMessage('Invalid sex value'),
];

exports.updateDependentRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
  body('relationship').optional().isIn(RELATIONSHIPS).withMessage('Invalid relationship'),
  body('dateOfBirth').optional({ nullable: true }).isISO8601().withMessage('dateOfBirth must be a valid date'),
  body('sex').optional({ nullable: true }).isIn(SEX_VALUES).withMessage('Invalid sex value'),
];

exports.dependentIdParamRules = [
  param('id').isMongoId().withMessage('Invalid dependent id'),
];

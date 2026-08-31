const { body, query } = require('express-validator');

exports.getProfileRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

// All fields are optional (the profile form can be filled in partially/over
// multiple visits), but whichever are present must be well-formed —
// mirrors backend/models/HealthProfile.js's own enums as a first line of
// defense before Mongoose validation runs.
exports.updateProfileRules = [
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
  body('dateOfBirth').optional({ nullable: true }).isISO8601().withMessage('dateOfBirth must be a valid date'),
  body('sex').optional({ nullable: true }).isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Invalid sex value'),
  body('weight').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
  body('weightUnit').optional({ nullable: true }).isIn(['kg', 'lbs']).withMessage('weightUnit must be kg or lbs'),
  body('height').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Height must be a positive number'),
  body('heightUnit').optional({ nullable: true }).isIn(['cm', 'ft']).withMessage('heightUnit must be cm or ft'),
  body('bloodType').optional({ nullable: true }).isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).withMessage('Invalid blood type'),
  body('preExistingConditions').optional().isArray().withMessage('preExistingConditions must be an array'),
  body('allergies').optional().isArray().withMessage('allergies must be an array'),
  body('currentMedications').optional().isArray().withMessage('currentMedications must be an array'),
  body('familyHistory').optional().isArray().withMessage('familyHistory must be an array'),
  body('smokingStatus').optional({ nullable: true }).isIn(['never', 'former', 'current']).withMessage('Invalid smokingStatus'),
  body('alcoholUse').optional({ nullable: true }).isIn(['none', 'occasional', 'moderate', 'heavy']).withMessage('Invalid alcoholUse'),
];

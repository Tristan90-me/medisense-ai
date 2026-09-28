const { body, param, query } = require('express-validator');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

exports.createMedicationRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('dosage').optional({ nullable: true }).trim().isString(),
  body('frequency').optional({ nullable: true }).trim().isString(),
  body('startDate').optional({ nullable: true }).isISO8601().withMessage('startDate must be a valid date'),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('endDate must be a valid date'),
  body('reminderTimes').optional().isArray().withMessage('reminderTimes must be an array'),
  body('reminderTimes.*').matches(TIME_REGEX).withMessage('reminderTimes entries must be "HH:mm"'),
  body('active').optional().isBoolean().withMessage('active must be a boolean'),
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.updateMedicationRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 200 }),
  body('dosage').optional({ nullable: true }).trim().isString(),
  body('frequency').optional({ nullable: true }).trim().isString(),
  body('startDate').optional({ nullable: true }).isISO8601().withMessage('startDate must be a valid date'),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('endDate must be a valid date'),
  body('reminderTimes').optional().isArray().withMessage('reminderTimes must be an array'),
  body('reminderTimes.*').matches(TIME_REGEX).withMessage('reminderTimes entries must be "HH:mm"'),
  body('active').optional().isBoolean().withMessage('active must be a boolean'),
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.medicationIdParamRules = [
  param('id').isMongoId().withMessage('Invalid medication id'),
];

exports.listMedicationsQueryRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

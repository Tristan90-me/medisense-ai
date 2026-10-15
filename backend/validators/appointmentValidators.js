const { body, param, query } = require('express-validator');

exports.createAppointmentRules = [
  body('doctorName').trim().notEmpty().withMessage('Doctor name is required').isLength({ max: 200 }),
  body('specialty').optional({ nullable: true }).trim().isString().isLength({ max: 200 }),
  body('dateTime').notEmpty().withMessage('Date and time are required').isISO8601().withMessage('dateTime must be a valid date'),
  body('location').optional({ nullable: true }).trim().isString().isLength({ max: 300 }),
  body('notes').optional({ nullable: true }).trim().isString().isLength({ max: 1000 }),
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.updateAppointmentRules = [
  body('doctorName').optional().trim().notEmpty().withMessage('Doctor name cannot be empty').isLength({ max: 200 }),
  body('specialty').optional({ nullable: true }).trim().isString().isLength({ max: 200 }),
  body('dateTime').optional().isISO8601().withMessage('dateTime must be a valid date'),
  body('location').optional({ nullable: true }).trim().isString().isLength({ max: 300 }),
  body('notes').optional({ nullable: true }).trim().isString().isLength({ max: 1000 }),
  body('status').optional().isIn(['scheduled', 'cancelled']).withMessage('Invalid status'),
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.appointmentIdParamRules = [
  param('id').isMongoId().withMessage('Invalid appointment id'),
];

exports.listAppointmentsQueryRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

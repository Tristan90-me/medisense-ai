const { query } = require('express-validator');

exports.getAuditLogRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('actor').optional().isMongoId().withMessage('Invalid actor id'),
  query('targetType').optional().isString(),
  query('action').optional().isString(),
  query('from').optional().isISO8601().withMessage('from must be an ISO8601 date'),
  query('to').optional().isISO8601().withMessage('to must be an ISO8601 date'),
];

const { query, param, body } = require('express-validator');

exports.listUsersRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('search').optional().isString(),
];

exports.userIdParamRules = [
  param('id').isMongoId().withMessage('Invalid user id'),
];

exports.listSessionsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('severity').optional().isIn(['Low', 'Moderate', 'High', 'Critical']).withMessage('Invalid severity'),
  query('emergency').optional().isIn(['true', 'false']).withMessage('emergency must be true or false'),
  query('status').optional().isIn(['active', 'completed', 'abandoned']).withMessage('Invalid status'),
];

exports.flaggedSessionsQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'reviewed']).withMessage('Invalid status'),
];

exports.reviewSessionRules = [
  body('reviewNotes').optional({ nullable: true }).isString().isLength({ max: 1000 }).withMessage('reviewNotes must be at most 1000 characters'),
];

exports.inviteAdminRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
];

exports.inviteIdParamRules = [
  param('id').isMongoId().withMessage('Invalid invite id'),
];

exports.sessionIdParamRules = [
  param('id').isMongoId().withMessage('Invalid session id'),
];

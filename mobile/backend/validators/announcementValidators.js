const { body, param, query } = require('express-validator');

exports.createAnnouncementRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title must be 200 characters or fewer'),
  body('body').trim().notEmpty().withMessage('Body is required').isLength({ max: 2000 }).withMessage('Body must be 2000 characters or fewer'),
  body('audience').optional().isIn(['all', 'critical', 'user']).withMessage('Invalid audience'),
  body('targetUserId')
    .if(body('audience').equals('user'))
    .notEmpty().withMessage('targetUserId is required when audience is "user"')
    .bail()
    .isMongoId().withMessage('Invalid targetUserId'),
  body('criticalWindowDays').optional().isInt({ min: 1, max: 365 }).withMessage('criticalWindowDays must be between 1 and 365'),
];

exports.announcementIdParamRules = [
  param('id').isMongoId().withMessage('Invalid announcement id'),
];

exports.criticalPreviewRules = [
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
];

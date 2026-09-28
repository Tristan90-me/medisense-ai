const { body, param } = require('express-validator');

exports.createAnnouncementRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title must be 200 characters or fewer'),
  body('body').trim().notEmpty().withMessage('Body is required').isLength({ max: 2000 }).withMessage('Body must be 2000 characters or fewer'),
];

exports.announcementIdParamRules = [
  param('id').isMongoId().withMessage('Invalid announcement id'),
];

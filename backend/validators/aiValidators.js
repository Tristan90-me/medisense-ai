const { body, param } = require('express-validator');

exports.startSessionRules = [
  body('mode').optional().isIn(['quick', 'full']).withMessage('mode must be quick or full'),
];

exports.sendMessageRules = [
  body('sessionId').isMongoId().withMessage('A valid sessionId is required'),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 4000 }).withMessage('Message is too long'),
];

exports.sessionIdParamRules = [
  param('id').isMongoId().withMessage('Invalid session id'),
];

exports.assistantChatRules = [
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 4000 }).withMessage('Message is too long'),
  body('history').optional().isArray().withMessage('history must be an array'),
];

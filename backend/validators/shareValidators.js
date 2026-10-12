const { param } = require('express-validator');

exports.sessionIdParamRules = [
  param('id').isMongoId().withMessage('Invalid session id'),
];

// Share tokens are 32-byte hex strings (crypto.randomBytes(32).toString('hex')),
// always exactly 64 lowercase-hex characters — never a Mongo ObjectId.
exports.tokenParamRules = [
  param('token').isLength({ min: 64, max: 64 }).withMessage('Invalid token').isHexadecimal().withMessage('Invalid token'),
];

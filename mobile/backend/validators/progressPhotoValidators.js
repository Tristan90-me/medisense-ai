const { body, param, query } = require('express-validator');

// Same multipart convention as photoLogValidators.js — multer populates
// req.body before this runs.
exports.uploadProgressPhotoRules = [
  body('caption').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.photoIdParamRules = [
  param('id').isMongoId().withMessage('Invalid photo id'),
];

exports.listPhotosQueryRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

const { body, param, query } = require('express-validator');

// These validate req.body fields that arrive alongside the uploaded file via
// multipart/form-data — multer populates req.body with the non-file text
// fields before this runs (upload.single('photo') is wired ahead of
// validate(...) in the route), so express-validator's body() checks work
// exactly as they would on a normal JSON body.
exports.uploadPhotoRules = [
  body('caption').optional({ nullable: true }).trim().isLength({ max: 300 }).withMessage('Caption must be 300 characters or fewer'),
  // Free text (see models/PhotoLog.js) — the dropdown's presets are a
  // frontend-only convenience, not a server-enforced set.
  body('bodyRegion').optional({ nullable: true }).trim().isLength({ max: 60 }).withMessage('Body region must be 60 characters or fewer'),
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
  body('subjectSex').optional({ nullable: true }).isIn(['male', 'female']).withMessage('Invalid subjectSex'),
  body('linkedSessionId').optional({ nullable: true }).isMongoId().withMessage('Invalid session id'),
];

exports.photoIdParamRules = [
  param('id').isMongoId().withMessage('Invalid photo id'),
];

exports.listPhotosQueryRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.linkSessionRules = [
  body('sessionId').isMongoId().withMessage('A valid sessionId is required'),
];

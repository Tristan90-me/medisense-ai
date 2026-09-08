const { query } = require('express-validator');

exports.searchNearbyRules = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a number between -90 and 90'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be a number between -180 and 180'),
  query('radius').optional().isInt({ min: 500, max: 20000 }).withMessage('radius must be an integer between 500 and 20000 (meters)'),
  query('type').optional().isIn(['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist']).withMessage('Invalid facility type'),
];

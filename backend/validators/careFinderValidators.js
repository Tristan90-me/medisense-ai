const { query } = require('express-validator');

exports.searchNearbyRules = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a number between -90 and 90'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be a number between -180 and 180'),
  query('radius').optional().isInt({ min: 500, max: 20000 }).withMessage('radius must be an integer between 500 and 20000 (meters)'),
  query('type').optional().isIn(['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist']).withMessage('Invalid facility type'),
];

exports.geocodeRules = [
  query('q').trim().isLength({ min: 2, max: 200 }).withMessage('q must be between 2 and 200 characters'),
];

exports.reverseGeocodeRules = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a number between -90 and 90'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be a number between -180 and 180'),
];

exports.getDirectionsRules = [
  query('fromLat').isFloat({ min: -90, max: 90 }).withMessage('fromLat must be a number between -90 and 90'),
  query('fromLng').isFloat({ min: -180, max: 180 }).withMessage('fromLng must be a number between -180 and 180'),
  query('toLat').isFloat({ min: -90, max: 90 }).withMessage('toLat must be a number between -90 and 90'),
  query('toLng').isFloat({ min: -180, max: 180 }).withMessage('toLng must be a number between -180 and 180'),
];

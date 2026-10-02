const { body, param, query } = require('express-validator');

exports.logMetricRules = [
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
  body('weightKg').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  body('bodyFatPct').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('measurements').optional({ nullable: true }).isObject(),
  body('measurements.chestCm').optional({ nullable: true }).isFloat({ min: 0 }),
  body('measurements.waistCm').optional({ nullable: true }).isFloat({ min: 0 }),
  body('measurements.hipsCm').optional({ nullable: true }).isFloat({ min: 0 }),
  body('measurements.armsCm').optional({ nullable: true }).isFloat({ min: 0 }),
  body('measurements.thighsCm').optional({ nullable: true }).isFloat({ min: 0 }),
  body('loggedAt').optional({ nullable: true }).isISO8601().withMessage('loggedAt must be a valid date'),
  // Mirrors the model's own pre-validate check (models/BodyMetric.js) as a
  // first line of defense, so an empty check-in 400s instead of 500ing.
  body().custom((value) => {
    const hasMeasurement = value.measurements
      && Object.values(value.measurements).some((v) => v !== undefined && v !== null && v !== '');
    if (value.weightKg == null && value.bodyFatPct == null && !hasMeasurement) {
      throw new Error('At least one of weightKg, bodyFatPct, or a measurement is required');
    }
    return true;
  }),
];

exports.listMetricsQueryRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.metricIdParamRules = [
  param('id').isMongoId().withMessage('Invalid body metric id'),
];

const mongoose = require('mongoose');

// One flat document per check-in — same event-log style as MealLog/
// WaterIntake. Every measurement is optional (a check-in might be
// weight-only, or a full tape-measure day), but at least one must be
// present or the entry carries no information.
const BodyMetricSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  loggedAt: { type: Date, default: Date.now },
  weightKg: { type: Number, min: 0, max: 500 },
  measurements: {
    chestCm: { type: Number, min: 0 },
    waistCm: { type: Number, min: 0 },
    hipsCm: { type: Number, min: 0 },
    armsCm: { type: Number, min: 0 },
    thighsCm: { type: Number, min: 0 },
  },
  bodyFatPct: { type: Number, min: 0, max: 100 },
}, { timestamps: true });

// No `next` callback param — this mongoose version's document middleware
// treats a function by its declared arity, and a 1-arg function here is
// invoked without a real callback (throws "next is not a function").
// Throwing directly is the callback-free idiom and works the same way.
BodyMetricSchema.pre('validate', function requireAtLeastOneField() {
  const m = this.measurements || {};
  const hasMeasurement = Object.values(m).some((v) => v != null);
  if (this.weightKg == null && this.bodyFatPct == null && !hasMeasurement) {
    throw new Error('At least one of weightKg, bodyFatPct, or a measurement is required');
  }
});

BodyMetricSchema.index({ user: 1, dependent: 1, loggedAt: -1 });

module.exports = mongoose.model('BodyMetric', BodyMetricSchema);

const mongoose = require('mongoose');

// One document per (user, dependent, day) — a device Pedometer sync sends
// the day's running total, which overwrites (not appends to) that day's
// row, unlike WaterIntake/MealLog's multiple-events-per-day style.
// distanceKm/caloriesBurned are computed once at sync time from that day's
// steps plus the profile's current height/weight (see utils/energy.js) and
// stored as a snapshot — consistent with how MealLog/WorkoutLog snapshot
// their own derived numbers rather than recomputing retroactively.
const StepDaySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  steps: { type: Number, required: true, min: 0 },
  distanceKm: { type: Number, min: 0, default: 0 },
  caloriesBurned: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

StepDaySchema.index({ user: 1, dependent: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StepDay', StepDaySchema);

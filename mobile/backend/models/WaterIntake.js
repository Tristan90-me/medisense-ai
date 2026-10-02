const mongoose = require('mongoose');

// One document per log event (a tap of "+250ml"), summed per day by the
// controller — same flat-event style as MealLog, rather than one
// incrementally-updated per-day total document.
const WaterIntakeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  loggedAt: { type: Date, default: Date.now },
  amountMl: { type: Number, required: true, min: 1, max: 5000 },
}, { timestamps: true });

WaterIntakeSchema.index({ user: 1, dependent: 1, loggedAt: -1 });

module.exports = mongoose.model('WaterIntake', WaterIntakeSchema);

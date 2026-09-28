const mongoose = require('mongoose');
const { DIET_PRESETS } = require('../utils/energy');

const NutritionGoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // null = the account owner's own goals; set = a dependent's goals.
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  goalMode: { type: String, enum: ['lose', 'maintain', 'gain'], default: 'maintain' },
  dietPreset: { type: String, enum: Object.keys(DIET_PRESETS), default: 'balanced' },
  calorieTarget: { type: Number, min: 500, max: 10000 },
  // True once the user typed their own calorie target; auto-recalculation
  // from TDEE then leaves it alone.
  calorieTargetIsCustom: { type: Boolean, default: false },
  // True when the recommended target was raised to the safety floor.
  floorApplied: { type: Boolean, default: false },
  macroSplit: {
    carbsPct: { type: Number, min: 0, max: 100 },
    proteinPct: { type: Number, min: 0, max: 100 },
    fatPct: { type: Number, min: 0, max: 100 },
  },
  macroTargets: {
    carbsG: { type: Number, min: 0 },
    proteinG: { type: Number, min: 0 },
    fatG: { type: Number, min: 0 },
  },
  waterGoalMl: { type: Number, default: 2000, min: 250, max: 10000 },
  // When true, logged exercise burn is added back to the day's budget and the
  // target is built from the sedentary baseline (see dailyEnergyLedger).
  addBackExercise: { type: Boolean, default: false },
}, { timestamps: true });

NutritionGoalSchema.index({ user: 1, dependent: 1 }, { unique: true });

module.exports = mongoose.model('NutritionGoal', NutritionGoalSchema);

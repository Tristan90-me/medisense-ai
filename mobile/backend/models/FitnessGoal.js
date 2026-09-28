const mongoose = require('mongoose');

const FitnessGoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // null = the account owner's own goals; set = a dependent's goals.
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  goalType: {
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'endurance', 'flexibility', 'maintain'],
    default: 'maintain',
  },
  // Shared with the nutrition side: one weight target, stored once, in kg.
  targetWeightKg: { type: Number, min: 20, max: 500 },
  dailyStepGoal: { type: Number, default: 10000, min: 1000, max: 100000 },
  weeklyWorkoutGoal: { type: Number, default: 3, min: 0, max: 14 },
}, { timestamps: true });

FitnessGoalSchema.index({ user: 1, dependent: 1 }, { unique: true });

module.exports = mongoose.model('FitnessGoal', FitnessGoalSchema);

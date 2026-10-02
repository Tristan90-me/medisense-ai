const mongoose = require('mongoose');

const PlanExerciseSchema = new mongoose.Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  targetSets: { type: Number, min: 0 },
  targetReps: { type: Number, min: 0 },
  targetWeightKg: { type: Number, min: 0 },
  notes: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const PlanDaySchema = new mongoose.Schema({
  dayNumber: { type: Number, required: true, min: 1 },
  label: { type: String, trim: true, maxlength: 100 },
  isRestDay: { type: Boolean, default: false },
  exercises: { type: [PlanExerciseSchema], default: [] },
}, { _id: false });

// A multi-day program (e.g. a 5-day split). Owned by the account, not
// per-dependent-locked to one profile — same reasoning as Recipe: a
// household's training program is reusable, not tied to one person's log.
const WorkoutPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  days: { type: [PlanDaySchema], validate: (v) => v.length > 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

WorkoutPlanSchema.index({ user: 1 });

module.exports = mongoose.model('WorkoutPlan', WorkoutPlanSchema);

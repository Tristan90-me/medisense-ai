const mongoose = require('mongoose');

const SetSchema = new mongoose.Schema({
  reps: { type: Number, min: 0 },
  weightKg: { type: Number, min: 0 },
}, { _id: false });

const LoggedExerciseSchema = new mongoose.Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  // Snapshot so the log still reads sensibly if the exercise is ever renamed.
  name: { type: String, required: true, trim: true },
  sets: { type: [SetSchema], default: [] },
}, { _id: false });

// One document per completed workout — a strength session logs `exercises`
// (sets/reps/weight), a cardio session logs `cardio` (distance/pace), a
// flexibility session just uses durationMin. No heart rate field: out of
// scope for now (would need native HealthKit/Google Fit integration and an
// EAS dev build rather than plain Expo Go — see the plan's risk notes).
const WorkoutLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  loggedAt: { type: Date, default: Date.now },
  type: { type: String, enum: ['strength', 'cardio', 'flexibility', 'other'], required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  durationMin: { type: Number, required: true, min: 1 },
  exercises: { type: [LoggedExerciseSchema], default: [] },
  cardio: {
    distanceKm: { type: Number, min: 0 },
    // Minutes per km, computed once at log time from distanceKm/durationMin.
    avgPaceMinPerKm: { type: Number, min: 0 },
  },
  // Computed once at log time from utils/workoutMath.js + the logger's
  // current weight — a snapshot, not recomputed if their weight later changes.
  caloriesBurned: { type: Number, min: 0, default: 0 },
  workoutPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutPlan', default: null },
  planDayNumber: { type: Number, min: 1, default: null },
  notes: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

WorkoutLogSchema.index({ user: 1, dependent: 1, loggedAt: -1 });

module.exports = mongoose.model('WorkoutLog', WorkoutLogSchema);

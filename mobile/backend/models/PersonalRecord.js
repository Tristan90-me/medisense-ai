const mongoose = require('mongoose');

// One row per (user, dependent, kind, exercise) holding the CURRENT best —
// upserted (replaced, not appended) whenever a new WorkoutLog beats it, so
// "what's my PR for X" is always a single cheap lookup rather than a
// max-aggregation over full history. `exercise` is null for the two cardio
// kinds, which aren't tied to a specific Exercise document.
//
// Simplification: cardio PRs are tracked as "longest single-session
// distance" and "fastest average pace" regardless of that session's
// distance — a real app would bucket pace PRs by distance (5k pace vs.
// marathon pace aren't comparable), deferred as a later refinement.
const PersonalRecordSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  kind: { type: String, enum: ['strength_weight', 'cardio_distance', 'cardio_pace'], required: true },
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', default: null },
  // strength_weight: kg (higher is better). cardio_distance: km (higher is
  // better). cardio_pace: min/km (LOWER is better) — see utils/personalRecords.js
  // for the kind-aware "is this better than the current PR" comparison.
  value: { type: Number, required: true, min: 0 },
  achievedAt: { type: Date, default: Date.now },
  workoutLog: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutLog' },
}, { timestamps: true });

PersonalRecordSchema.index(
  { user: 1, dependent: 1, kind: 1, exercise: 1 },
  { unique: true, partialFilterExpression: { exercise: { $type: 'objectId' } } },
);
PersonalRecordSchema.index(
  { user: 1, dependent: 1, kind: 1 },
  { unique: true, partialFilterExpression: { exercise: null } },
);

module.exports = mongoose.model('PersonalRecord', PersonalRecordSchema);

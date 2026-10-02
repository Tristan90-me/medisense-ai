const mongoose = require('mongoose');

// Shared reference data, seeded from wger's open exercise database
// (scripts/seedExercises.js) — not user-owned or user-editable, mirroring
// FoodItem's "shared cache" role but for a curated seed set rather than an
// on-demand external lookup.
const ExerciseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  category: {
    type: String,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body', 'other'],
    default: 'other',
  },
  equipment: [{ type: String, trim: true }],
  // Determines which WorkoutLog shape applies when this exercise is logged:
  // 'strength' -> sets of reps/weight, 'cardio' -> distance/duration,
  // 'flexibility' -> duration only.
  exerciseType: { type: String, enum: ['strength', 'cardio', 'flexibility'], default: 'strength' },
  instructions: { type: String, trim: true, maxlength: 4000 },
  source: { type: String, enum: ['wger', 'custom'], default: 'wger' },
  // wger's numeric exercise id — dedup key when re-running the seed script.
  externalId: { type: String, trim: true },
}, { timestamps: true });

ExerciseSchema.index({ source: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } });
ExerciseSchema.index({ name: 'text' });

module.exports = mongoose.model('Exercise', ExerciseSchema);

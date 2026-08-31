const mongoose = require('mongoose');

const HealthProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // null = this profile belongs to the account owner; set = a dependent's profile.
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  dateOfBirth: { type: Date },
  sex: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  weight: { type: Number },
  weightUnit: { type: String, enum: ['kg', 'lbs'], default: 'kg' },
  height: { type: Number },
  heightUnit: { type: String, enum: ['cm', 'ft'], default: 'cm' },
  bloodType: { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-','unknown'], default: 'unknown' },
  preExistingConditions: [{ type: String }],
  allergies: [{ type: String }],
  currentMedications: [{ type: String }],
  familyHistory: [{ type: String }],
  smokingStatus: { type: String, enum: ['never', 'former', 'current'], default: 'never' },
  alcoholUse: { type: String, enum: ['none', 'occasional', 'moderate', 'heavy'], default: 'none' },
  onboardingComplete: { type: Boolean, default: false },
}, { timestamps: true });

// Replaces the old single-field `unique: true` on `user` — one HealthProfile
// per (user, dependent) pair, where dependent: null means "the user's own
// profile". A missing `dependent` field on pre-existing documents is treated
// as null by MongoDB for both querying and indexing, so no backfill is
// needed — see scripts/migrateHealthProfileIndex.js for dropping the old
// index on already-provisioned databases.
HealthProfileSchema.index({ user: 1, dependent: 1 }, { unique: true });

module.exports = mongoose.model('HealthProfile', HealthProfileSchema);
const mongoose = require('mongoose');

const HealthProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
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

module.exports = mongoose.model('HealthProfile', HealthProfileSchema);
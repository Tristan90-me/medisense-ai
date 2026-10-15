const mongoose = require('mongoose');

const MedicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  name: { type: String, required: true },
  dosage: { type: String },
  frequency: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  reminderTimes: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  // One entry per "Mark as taken" tap — the raw log the adherence
  // percentage (see utils/computeAdherence.js) is calculated from. Never
  // trimmed/rotated here; the compute function only ever looks at the last
  // 7 days of it, so this can grow but stays cheap to query against.
  doseLog: [{ takenAt: { type: Date, default: Date.now }, _id: false }],
}, { timestamps: true });

module.exports = mongoose.model('Medication', MedicationSchema);

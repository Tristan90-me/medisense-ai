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
}, { timestamps: true });

module.exports = mongoose.model('Medication', MedicationSchema);

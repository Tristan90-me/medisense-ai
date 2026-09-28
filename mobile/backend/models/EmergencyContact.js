const mongoose = require('mongoose');

const EmergencyContactSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  relationship: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  isPrimary: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('EmergencyContact', EmergencyContactSchema);

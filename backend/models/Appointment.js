const mongoose = require('mongoose');

// A personal tracker, not a real booking system — this app has no
// integration with any real provider's scheduling system. `status` only
// ever distinguishes scheduled vs. cancelled; "upcoming" vs. "past" is
// derived from `dateTime` vs. now, not stored, so nothing has to remember
// to flip a flag once the date passes.
const AppointmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  doctorName: { type: String, required: true, trim: true },
  specialty: { type: String, trim: true },
  dateTime: { type: Date, required: true },
  location: { type: String, trim: true },
  notes: { type: String, trim: true },
  status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled' },
}, { timestamps: true });

module.exports = mongoose.model('Appointment', AppointmentSchema);

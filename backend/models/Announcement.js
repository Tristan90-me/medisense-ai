const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 2000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Deliberately a single-value enum for now — schema-ready for future
  // audience segmentation (e.g. by role or cohort) without a migration, but
  // nothing filters recipients by this field yet: every consumer sees every
  // announcement.
  audience: { type: String, enum: ['all'], default: 'all' },
  sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);

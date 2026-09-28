const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 2000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  audience: { type: String, enum: ['all', 'critical', 'user'], default: 'all' },
  // Snapshot of matched user ids at send time for 'critical'/'user' audiences
  // (unused for 'all') — not re-evaluated later, so a message stays
  // historically accurate even if a user's condition later changes.
  recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Denormalized recipientIds.length, so the admin list view can show a
  // count without populating a potentially large array.
  recipientCount: { type: Number, default: 0 },
  // 'user' audience only — captured once at send time so the admin list
  // still shows who a message went to even if that user is later renamed/deleted.
  targetUserSnapshot: { name: String, email: String },
  // 'critical' audience only — audit context for what window produced recipientIds.
  criticalWindowDays: { type: Number, default: null },
  sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);

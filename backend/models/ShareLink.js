const mongoose = require('mongoose');

// A short-lived, unguessable link to a read-only subset of one session —
// built for "share with a healthcare professional" (see shareController.js).
// Deliberately does NOT reference the session's raw messages; the public
// view only ever reads severity/symptoms/diagnosis fields directly off the
// Session document, never this model's own data.
const ShareLinkSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  viewCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ShareLink', ShareLinkSchema);

const mongoose = require('mongoose');

const PhotoLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  // Set only for a photo of someone who isn't the account owner AND isn't a
  // saved Dependent — a quick, no-profile-required "who is this roughly for"
  // hint used purely as AI-analysis context and a display label. Mutually
  // exclusive with `dependent` in practice (the upload form only ever sends
  // one or the other), but not enforced at the schema level since nothing
  // downstream depends on that invariant strictly holding.
  subjectSex: { type: String, enum: ['male', 'female'], default: null },
  // GridFS file id (bucket: 'photos') holding the actual image bytes — never
  // embedded on this document itself, see gridfs.js and photoLogController's
  // getPhotoImage for the dedicated streaming route.
  imageRef: { type: mongoose.Schema.Types.ObjectId, required: true },
  mimeType: { type: String, required: true },
  caption: { type: String },
  // Free text rather than a strict enum — the upload form offers the same
  // preset regions as a convenience dropdown, plus an "Other" option that
  // lets the user type anything not on the list. Nothing else in the app
  // depends on this being a closed set.
  bodyRegion: { type: String, trim: true, maxlength: 60 },
  aiAnalysis: {
    description: { type: String },
    findings: [{ type: String }],
    confidence: { type: String, enum: ['low', 'moderate', 'high'] },
    flaggedForReview: { type: Boolean, default: false },
  },
  linkedSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
}, { timestamps: true });

module.exports = mongoose.model('PhotoLog', PhotoLogSchema);

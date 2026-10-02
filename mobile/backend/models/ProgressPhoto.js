const mongoose = require('mongoose');

// Mirrors PhotoLog's shape, but stored in its own GridFS bucket
// ('progress-photos', see utils/gridfs.js) — kept as a separate collection
// and bucket rather than reusing PhotoLog, since these are fitness
// before/after shots, not symptom photos, and don't need aiAnalysis/
// linkedSessionId.
const ProgressPhotoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  imageRef: { type: mongoose.Schema.Types.ObjectId, required: true },
  mimeType: { type: String, required: true },
  caption: { type: String, trim: true, maxlength: 500 },
  takenAt: { type: Date, default: Date.now },
}, { timestamps: true });

ProgressPhotoSchema.index({ user: 1, dependent: 1, takenAt: -1 });

module.exports = mongoose.model('ProgressPhoto', ProgressPhotoSchema);

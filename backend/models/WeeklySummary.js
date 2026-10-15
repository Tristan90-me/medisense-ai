const mongoose = require('mongoose');

// One cached narrative per (user, dependent) — regenerated at most once a
// day (see aiController.getWeeklySummary) rather than on every dashboard
// load, since it's an LLM call over a rolling 7-day window that only
// meaningfully changes day to day, not request to request.
const WeeklySummarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  text: { type: String, required: true },
  stats: {
    sessionCount: Number,
    avgSeverity: { type: Number, default: null },
    trend: { type: String, enum: ['improving', 'worsening', 'steady', null], default: null },
    topSymptoms: { type: [String], default: [] },
    emergencyCount: Number,
    adherencePercentage: { type: Number, default: null },
    scoreDelta: { type: Number, default: null },
  },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

WeeklySummarySchema.index({ user: 1, dependent: 1 }, { unique: true });

module.exports = mongoose.model('WeeklySummary', WeeklySummarySchema);

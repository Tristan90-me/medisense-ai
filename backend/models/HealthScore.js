const mongoose = require('mongoose');

const HealthScoreSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // null = the account owner's own score; set = a dependent's score.
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  currentScore: { type: Number, default: 0 },
  history: [{
    date: { type: Date, default: Date.now },
    score: { type: Number },
  }],
  unlockedAchievements: [{
    id: { type: String },
    unlockedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// One HealthScore document per (user, dependent) pair, same shape as
// HealthProfile's compound index — but this is a brand-new model, so unlike
// HealthProfile there's no legacy single-field unique index to migrate away
// from. Just declared correctly from day one.
HealthScoreSchema.index({ user: 1, dependent: 1 }, { unique: true });

module.exports = mongoose.model('HealthScore', HealthScoreSchema);

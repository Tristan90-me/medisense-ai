const mongoose = require('mongoose');

// One document per setting key (NOT a singleton) — e.g. 'systemPrompt',
// 'emergencyKeywords'. `value` is intentionally Mixed since different keys
// hold different shapes (a string prompt vs. an array of keywords).
const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);

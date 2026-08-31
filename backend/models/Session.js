const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const conditionSchema = new mongoose.Schema({
  name: String,
  probability: Number,
  confidence: String,
});

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // null = a session about the account owner; set = a session about one
    // of their dependents (see models/Dependent.js).
    dependent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dependent",
      default: null,
    },
    mode: {
      type: String,
      enum: ["quick", "full"],
      default: "quick",
    },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
    messages: [messageSchema],
    symptoms: [
      {
        name: String,
        duration: String,
        onset: String,
      },
    ],
    severityScore: Number,
    severityLevel: {
      type: String,
      enum: ["Low", "Moderate", "High", "Critical"],
    },
    diagnosis: {
      conditions: [conditionSchema],
      recommendations: [String],
      seekCareUrgency: String,
    },
    emergencyDetected: { type: Boolean, default: false },
    ruleBasedTriage: {
      level: { type: String, enum: ["Low", "Critical"] },
      score: Number,
      matchedRules: [String],
    },
    // True when the independent rule-based triage layer (utils/triage.js)
    // flags a Critical red flag that the LLM's own severity/emergency
    // output did not — a same-turn safety-net disagreement worth a human
    // reviewing, not just any difference in the two scores.
    severityMismatch: { type: Boolean, default: false },
    summary: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
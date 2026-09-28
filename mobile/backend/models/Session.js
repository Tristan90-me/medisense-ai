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
    // Moderation queue flag — set true (and never automatically cleared)
    // whenever the LLM itself declares an emergency OR the independent
    // rule-based triage layer disagrees with it (severityMismatch). See
    // controllers/aiController.js for where this gets set, and
    // controllers/adminController.js's reviewSession for how it gets
    // acknowledged (reviewedAt/reviewedBy/reviewNotes) without ever flipping
    // flaggedForReview back to false — it stays a permanent record that this
    // session once needed a human look.
    flaggedForReview: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: '' },
    // Third independent signal (Phase 9) alongside the LLM's own severity
    // (utils/gemini.js) and the rule-based triage layer (utils/triage.js) —
    // a locally-run Naive Bayes classifier, see ml/symptomClassifier.js.
    // condition is null when too few recognized symptoms exist to predict
    // anything meaningful (see that file's matchedCount guard).
    mlClassification: {
      condition: { type: String, default: null },
      confidence: { type: Number, default: 0 },
      topPredictions: [{ condition: String, probability: Number, _id: false }],
    },
    summary: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
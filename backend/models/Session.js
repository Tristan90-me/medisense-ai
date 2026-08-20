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
    summary: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
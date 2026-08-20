const Session = require("../models/Session");
const HealthProfile = require("../models/HealthProfile");
const { chat, generateSummary } = require("../utils/gemini");

// ─── Start or Resume Session ───────────────────────────────────────────────
const startSession = async (req, res) => {
  try {
    const { mode = "quick" } = req.body;

    // Resume existing active session if exists
    const existing = await Session.findOne({
      user: req.user.id,
      status: "active",
    }).sort({ createdAt: -1 });

    if (existing) {
      return res.json({ session: existing, resumed: true });
    }

    const session = await Session.create({
      user: req.user.id,
      mode,
      messages: [],
    });

    res.status(201).json({ session, resumed: false });
  } catch (err) {
    console.error("startSession error:", err);
    res.status(500).json({ message: "Failed to start session" });
  }
};

// ─── Send Message ──────────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    const session = await Session.findOne({
      _id: sessionId,
      user: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Add user message
    session.messages.push({ role: "user", content: message });

    // Get health profile for risk stratification
    const healthProfile = await HealthProfile.findOne({ user: req.user.id });

    // Build history for Gemini (exclude system messages)
    const history = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Call Gemini
    const parsed = await chat(history, healthProfile);

    // Add assistant response
    session.messages.push({ role: "assistant", content: parsed.text });

    // Update session fields
    if (parsed.emergency) session.emergencyDetected = true;

    if (parsed.severity) {
      session.severityScore = parsed.severity.score;
      session.severityLevel = parsed.severity.level;
    }

    if (parsed.symptoms?.symptoms) {
      const newSymptoms = parsed.symptoms.symptoms.map((s) => ({
        name: s,
        duration: parsed.symptoms.duration || "",
        onset: parsed.symptoms.onset || "",
      }));
      // Merge without duplicates
      const existing = session.symptoms.map((s) => s.name.toLowerCase());
      newSymptoms.forEach((s) => {
        if (!existing.includes(s.name.toLowerCase())) {
          session.symptoms.push(s);
        }
      });
    }

    if (parsed.diagnosis) {
      session.diagnosis = parsed.diagnosis;
      session.status = "completed";
    }

    await session.save();

    res.json({
      message: parsed.text,
      emergency: parsed.emergency,
      severity: parsed.severity,
      symptoms: parsed.symptoms,
      diagnosis: parsed.diagnosis,
      suggestions: parsed.suggestions,
      sessionStatus: session.status,
    });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// ─── Generate Summary ──────────────────────────────────────────────────────
const getSummary = async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.summary) {
      return res.json({ summary: session.summary });
    }

    const summary = await generateSummary(session);
    session.summary = summary;
    await session.save();

    res.json({ summary });
  } catch (err) {
    console.error("getSummary error:", err);
    res.status(500).json({ message: "Failed to generate summary" });
  }
};

// ─── Get All Sessions ──────────────────────────────────────────────────────
const getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select("-messages");

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
};

// ─── Get Single Session ────────────────────────────────────────────────────
const getSession = async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch session" });
  }
};

// ─── Global Assistant Chat (session-less) ─────────────────────────────────
const assistantChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    const fullHistory = [
      ...history,
      { role: "user", content: message },
    ];

    const healthProfile = await HealthProfile.findOne({ user: req.user.id });
    const parsed = await chat(fullHistory, healthProfile);

    res.json({
      message: parsed.text,
      emergency: parsed.emergency,
      severity: parsed.severity,
      suggestions: parsed.suggestions,
    });
  } catch (err) {
    console.error("assistantChat error:", err);
    res.status(500).json({ message: "Failed to get response" });
  }
};

module.exports = {
  startSession,
  sendMessage,
  getSummary,
  getSessions,
  getSession,
  assistantChat,
};
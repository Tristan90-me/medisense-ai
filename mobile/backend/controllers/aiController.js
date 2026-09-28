const Session = require("../models/Session");
const HealthProfile = require("../models/HealthProfile");
const SystemSetting = require("../models/SystemSetting");
const { chat, chatStream, generateSummary } = require("../utils/gemini");
const { resolveDependentId } = require("../utils/resolveDependent");
const { computeTriageScore } = require("../utils/triage");
const { classifySymptoms } = require("../ml/symptomClassifier");

// Loads the admin-editable custom emergency-keyword list (see
// models/SystemSetting.js, key 'emergencyKeywords') for the rule-based
// triage cross-check. Not a hot-path-optimized cache — a small collection,
// one extra findOne per message, acceptable for this project's scale.
const getEmergencyKeywords = async () => {
  const setting = await SystemSetting.findOne({ key: "emergencyKeywords" });
  return setting?.value || [];
};

// ─── Start or Resume Session ───────────────────────────────────────────────
const startSession = async (req, res) => {
  try {
    const { mode = "quick", dependentId } = req.body;
    const dependent = await resolveDependentId(dependentId, req.user.id);

    // Resume existing active session for this same person (self or
    // dependent) if one exists — scoped by dependent too, so an in-progress
    // self session is never accidentally resumed while starting a check-in
    // for a dependent, or vice versa.
    const existing = await Session.findOne({
      user: req.user.id,
      dependent,
      status: "active",
    }).sort({ createdAt: -1 });

    if (existing) {
      return res.json({ session: existing, resumed: true });
    }

    const session = await Session.create({
      user: req.user.id,
      dependent,
      mode,
      messages: [],
    });

    res.status(201).json({ session, resumed: false });
  } catch (err) {
    console.error("startSession error:", err);
    res.status(err.statusCode || 500).json({ message: err.statusCode ? err.message : "Failed to start session" });
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

    // Get health profile for risk stratification — scoped to whichever
    // person (self or dependent) this session is about.
    const healthProfile = await HealthProfile.findOne({
      user: req.user.id,
      dependent: session.dependent || null,
    });

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

    // Independent rule-based cross-check — computed from the same
    // just-updated symptom list, never from the LLM's own severity output.
    const emergencyKeywords = await getEmergencyKeywords();
    const ruleBasedTriage = computeTriageScore(session.symptoms, healthProfile, emergencyKeywords);
    session.ruleBasedTriage = ruleBasedTriage;
    session.severityMismatch =
      ruleBasedTriage.level === "Critical" &&
      parsed.severity?.level !== "Critical" &&
      !parsed.emergency;

    // Once flagged, stays flagged permanently as a historical record — this
    // only ever flips false→true, never gets cleared automatically. Reviewing
    // (see adminController.reviewSession) sets reviewedAt without touching this.
    if (parsed.emergency || session.severityMismatch) session.flaggedForReview = true;

    // Third independent signal (Phase 9) — a locally-run classifier, never
    // informed by the LLM's own output, same spirit as ruleBasedTriage above.
    const mlClassification = classifySymptoms(session.symptoms);
    session.mlClassification = mlClassification;

    await session.save();

    res.json({
      message: parsed.text,
      emergency: parsed.emergency,
      severity: parsed.severity,
      symptoms: parsed.symptoms,
      diagnosis: parsed.diagnosis,
      suggestions: parsed.suggestions,
      sessionStatus: session.status,
      ruleBasedTriage,
      severityMismatch: session.severityMismatch,
      mlClassification,
    });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// ─── Send Message (streaming, SSE) ─────────────────────────────────────────
// Mirrors sendMessage's logic exactly, but streams the assistant's raw text
// as it arrives and only runs parseAIResponse()/session updates once the
// stream completes (bracket-tagged metadata can split across chunk
// boundaries, so it can't be parsed incrementally).
const sendMessageStream = async (req, res) => {
  const { sessionId, message } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  try {
    const session = await Session.findOne({
      _id: sessionId,
      user: req.user.id,
    });

    if (!session) {
      send({ type: "error", message: "Session not found" });
      return res.end();
    }

    session.messages.push({ role: "user", content: message });

    const healthProfile = await HealthProfile.findOne({
      user: req.user.id,
      dependent: session.dependent || null,
    });

    const history = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const parsed = await chatStream(history, healthProfile, (delta) => {
      send({ type: "chunk", text: delta });
    });

    session.messages.push({ role: "assistant", content: parsed.text });

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

    const emergencyKeywords = await getEmergencyKeywords();
    const ruleBasedTriage = computeTriageScore(session.symptoms, healthProfile, emergencyKeywords);
    session.ruleBasedTriage = ruleBasedTriage;
    session.severityMismatch =
      ruleBasedTriage.level === "Critical" &&
      parsed.severity?.level !== "Critical" &&
      !parsed.emergency;

    // Once flagged, stays flagged permanently as a historical record — this
    // only ever flips false→true, never gets cleared automatically. Reviewing
    // (see adminController.reviewSession) sets reviewedAt without touching this.
    if (parsed.emergency || session.severityMismatch) session.flaggedForReview = true;

    const mlClassification = classifySymptoms(session.symptoms);
    session.mlClassification = mlClassification;

    await session.save();

    send({
      type: "done",
      message: parsed.text,
      emergency: parsed.emergency,
      severity: parsed.severity,
      symptoms: parsed.symptoms,
      diagnosis: parsed.diagnosis,
      suggestions: parsed.suggestions,
      sessionStatus: session.status,
      ruleBasedTriage,
      severityMismatch: session.severityMismatch,
      mlClassification,
    });
    res.end();
  } catch (err) {
    console.error("sendMessageStream error:", err);
    send({ type: "error", message: "Failed to send message" });
    res.end();
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
  sendMessageStream,
  getSummary,
  getSessions,
  getSession,
  assistantChat,
};
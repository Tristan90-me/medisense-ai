const Session = require("../models/Session");
const HealthProfile = require("../models/HealthProfile");
const SystemSetting = require("../models/SystemSetting");
const Medication = require("../models/Medication");
const HealthScore = require("../models/HealthScore");
const WeeklySummary = require("../models/WeeklySummary");
const { chat, chatStream, generateSummary, generateWeeklySummary } = require("../utils/gemini");
const { resolveDependentId } = require("../utils/resolveDependent");
const { computeTriageScore } = require("../utils/triage");
const { classifySymptoms } = require("../ml/symptomClassifier");
const { computeAdherence } = require("../utils/computeAdherence");

// Loads the admin-editable custom emergency-keyword list (see
// models/SystemSetting.js, key 'emergencyKeywords') for the rule-based
// triage cross-check. Not a hot-path-optimized cache — a small collection,
// one extra findOne per message, acceptable for this project's scale.
const getEmergencyKeywords = async () => {
  const setting = await SystemSetting.findOne({ key: "emergencyKeywords" });
  return setting?.value || [];
};

// Audit-trail identifier for "which system prompt was this assessment run
// under" — not a true version history (SystemSetting overwrites the prompt
// text in place, see systemSettingController.js), but the admin-saved
// prompt's own `updatedAt` is a real, honest point-in-time marker: two
// sessions sharing this value were assessed under the exact same prompt
// text, since any edit always bumps it. 'built-in-default' covers the case
// where no admin override has ever been saved (utils/gemini.js falls back
// to MEDISENSE_SYSTEM_PROMPT in that case).
const getPromptVersion = async () => {
  const setting = await SystemSetting.findOne({ key: "systemPrompt" });
  return setting?.updatedAt ? setting.updatedAt.toISOString() : "built-in-default";
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
      promptVersion: await getPromptVersion(),
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

    if (parsed.progress?.phase) session.lastProgressPhase = parsed.progress.phase;

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
      progress: parsed.progress,
      widget: parsed.widget,
      sessionStatus: session.status,
      sessionSymptoms: session.symptoms,
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

    if (parsed.progress?.phase) session.lastProgressPhase = parsed.progress.phase;

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
      progress: parsed.progress,
      widget: parsed.widget,
      sessionStatus: session.status,
      sessionSymptoms: session.symptoms,
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

// ─── Weekly Summary ─────────────────────────────────────────────────────────
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getWeeklySummary = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.query.dependent, req.user.id);
    const scope = { user: req.user.id, dependent };

    const cached = await WeeklySummary.findOne(scope);
    if (cached && req.query.refresh !== "true" && Date.now() - cached.generatedAt.getTime() < DAY_MS) {
      return res.json({
        summary: cached.text, stats: cached.stats, generatedAt: cached.generatedAt, cached: true,
      });
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - WEEK_MS);
    const prevWindowStart = new Date(now.getTime() - 2 * WEEK_MS);

    const [thisWeekSessions, prevWeekSessions, medications, healthScoreDoc] = await Promise.all([
      Session.find({ ...scope, createdAt: { $gte: windowStart } }),
      Session.find({ ...scope, createdAt: { $gte: prevWindowStart, $lt: windowStart } }),
      Medication.find({ ...scope, active: true }),
      HealthScore.findOne(scope),
    ]);

    const sessionCount = thisWeekSessions.length;

    const avgOf = (sessions) => {
      const withSeverity = sessions.filter((s) => typeof s.severityScore === "number");
      if (!withSeverity.length) return null;
      return withSeverity.reduce((a, s) => a + s.severityScore, 0) / withSeverity.length;
    };
    const avgSeverityRaw = avgOf(thisWeekSessions);
    const avgSeverity = avgSeverityRaw != null ? +avgSeverityRaw.toFixed(1) : null;
    const prevAvgSeverity = avgOf(prevWeekSessions);

    // Same +/-0.75 threshold HealthStats.jsx uses for its own trend signal
    // — kept consistent so the two views never contradict each other.
    let trend = null;
    if (avgSeverityRaw != null && prevAvgSeverity != null) {
      const delta = avgSeverityRaw - prevAvgSeverity;
      trend = delta > 0.75 ? "worsening" : delta < -0.75 ? "improving" : "steady";
    }

    const emergencyCount = thisWeekSessions.filter((s) => s.emergencyDetected).length;

    const symptomMap = {};
    thisWeekSessions.forEach((s) => s.symptoms?.forEach((sym) => {
      symptomMap[sym.name] = (symptomMap[sym.name] || 0) + 1;
    }));
    const topSymptoms = Object.entries(symptomMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

    const adherences = medications.map((m) => computeAdherence(m, now)).filter((a) => a.trackable);
    const totalTaken = adherences.reduce((a, c) => a + c.takenCount, 0);
    const totalExpected = adherences.reduce((a, c) => a + c.expectedCount, 0);
    const adherencePercentage = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : null;

    let scoreDelta = null;
    if (healthScoreDoc?.history?.length) {
      const weekAgoEntry = healthScoreDoc.history
        .filter((h) => new Date(h.date).getTime() <= windowStart.getTime())
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (weekAgoEntry) scoreDelta = healthScoreDoc.currentScore - weekAgoEntry.score;
    }

    const stats = {
      sessionCount, avgSeverity, trend, topSymptoms, emergencyCount, adherencePercentage, scoreDelta,
    };

    const hasAnyData = sessionCount > 0 || adherencePercentage != null || (scoreDelta != null && scoreDelta !== 0);
    const text = hasAnyData
      ? await generateWeeklySummary(stats)
      : "Nothing tracked this week yet — check in on how you're feeling or log a medication dose, and your weekly recap will start building here.";

    const saved = await WeeklySummary.findOneAndUpdate(
      scope,
      { text, stats, generatedAt: now },
      { upsert: true, returnDocument: "after", runValidators: true }
    );

    res.json({
      summary: saved.text, stats: saved.stats, generatedAt: saved.generatedAt, cached: false,
    });
  } catch (err) {
    console.error("getWeeklySummary error:", err);
    res.status(err.statusCode || 500).json({ message: "Failed to generate weekly summary" });
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
  getWeeklySummary,
  getSessions,
  getSession,
  assistantChat,
};
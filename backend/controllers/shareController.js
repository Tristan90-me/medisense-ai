const crypto = require('crypto');
const ShareLink = require('../models/ShareLink');
const Session = require('../models/Session');
const Dependent = require('../models/Dependent');
const User = require('../models/User');

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Create a share link (owner-only) ──────────────────────────────────────
// Token generation mirrors User.generateVerifyToken's convention
// (crypto.randomBytes(32).toString('hex')) — 32 bytes of entropy makes the
// link itself the only real access control, there's no rate limiting
// anywhere in this app to fall back on.
exports.createShareLink = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (!session.diagnosis?.conditions?.length) {
      return res.status(400).json({ success: false, message: 'This session has no assessment to share yet' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_MS);
    const link = await ShareLink.create({ session: session._id, user: req.user._id, token, expiresAt });

    res.status(201).json({ success: true, token: link.token, expiresAt: link.expiresAt });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─── Revoke a share link (owner-only) ──────────────────────────────────────
exports.revokeShareLink = async (req, res) => {
  try {
    const link = await ShareLink.findOne({ token: req.params.token, user: req.user._id });
    if (!link) {
      return res.status(404).json({ success: false, message: 'Share link not found' });
    }
    link.revokedAt = new Date();
    await link.save();
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─── Read a shared session (public, unauthenticated) ───────────────────────
// Returns a deliberately narrow subset of the session — severity, reported
// symptoms, possible conditions, recommendations, and care urgency — never
// the raw message transcript, ruleBasedTriage internals, or mlClassification.
// This is the one thing standing between "share a clinical summary" and
// "share my entire private conversation with an AI," so the field list here
// is the actual privacy boundary, not just a display choice.
exports.getSharedSession = async (req, res) => {
  try {
    const link = await ShareLink.findOne({ token: req.params.token });
    if (!link || link.revokedAt || link.expiresAt < new Date()) {
      return res.status(404).json({ success: false, message: 'This share link is invalid or has expired' });
    }

    const session = await Session.findById(link.session);
    if (!session) {
      return res.status(404).json({ success: false, message: 'This share link is invalid or has expired' });
    }

    link.viewCount += 1;
    await link.save();

    let patientName = null;
    if (session.dependent) {
      const dep = await Dependent.findById(session.dependent);
      patientName = dep?.name || null;
    } else {
      const owner = await User.findById(session.user);
      patientName = owner?.name || null;
    }

    res.json({
      success: true,
      report: {
        patientName,
        mode: session.mode,
        createdAt: session.createdAt,
        severityScore: session.severityScore,
        severityLevel: session.severityLevel,
        symptoms: session.symptoms,
        diagnosis: session.diagnosis,
        expiresAt: link.expiresAt,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

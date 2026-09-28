const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Session = require('../models/Session');
const { logAdminAction } = require('../utils/auditLogger');

const DEFAULT_CRITICAL_WINDOW_DAYS = 30;

// Users who've had an emergency/critical-severity session within the given
// window — excludes admin accounts and deactivated accounts, since neither
// should receive (or count toward) a critical-condition outreach send.
async function findCriticalUserIds(windowDays) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const sessionUserIds = await Session.distinct('user', {
    createdAt: { $gte: since },
    $or: [{ emergencyDetected: true }, { severityLevel: 'Critical' }],
  });
  return User.find({ _id: { $in: sessionUserIds }, role: 'user', isActive: true }).select('_id name email');
}

// ── Create + broadcast an announcement (admin) ───────────────────────────────
exports.createAndBroadcast = async (req, res) => {
  try {
    const { title, body, audience = 'all', targetUserId, criticalWindowDays } = req.body;

    const doc = { title, body, createdBy: req.user._id, audience };

    if (audience === 'user') {
      const targetUser = await User.findById(targetUserId).select('name email');
      if (!targetUser) return res.status(404).json({ success: false, message: 'Target user not found' });
      doc.recipientIds = [targetUser._id];
      doc.recipientCount = 1;
      doc.targetUserSnapshot = { name: targetUser.name, email: targetUser.email };
    } else if (audience === 'critical') {
      const windowDays = criticalWindowDays || DEFAULT_CRITICAL_WINDOW_DAYS;
      const recipients = await findCriticalUserIds(windowDays);
      doc.recipientIds = recipients.map((u) => u._id);
      doc.recipientCount = recipients.length;
      doc.criticalWindowDays = windowDays;
    }

    const announcement = await Announcement.create(doc);

    try {
      await logAdminAction({
        actor: req.user._id,
        action: 'announcement.create',
        targetType: 'Announcement',
        targetId: announcement._id,
        metadata: {
          title, audience, recipientCount: doc.recipientCount || undefined, criticalWindowDays: doc.criticalWindowDays || undefined, targetUserId: audience === 'user' ? targetUserId : undefined,
        },
        ip: req.ip,
      });
    } catch (logErr) {
      console.error('logAdminAction failed (announcement.create):', logErr.message);
    }

    res.status(201).json({ success: true, announcement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Preview how many/which users a 'critical' send would reach (admin) ──────
exports.getCriticalPreview = async (req, res) => {
  try {
    const windowDays = req.query.days ? parseInt(req.query.days, 10) : DEFAULT_CRITICAL_WINDOW_DAYS;
    const recipients = await findCriticalUserIds(windowDays);
    res.json({
      success: true,
      count: recipients.length,
      sample: recipients.slice(0, 10).map((u) => ({ name: u.name, email: u.email })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── List announcements (any authenticated user) ─────────────────────────────
// A notification feed, not a paginated archive — most recent 50 is plenty
// for a first pass. Scoped to what this user should actually see: broadcasts
// to everyone, plus any targeted ('critical'/'user') send that named them.
exports.listAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({
      $or: [{ audience: 'all' }, { recipientIds: req.user._id }],
    })
      .sort({ sentAt: -1 })
      .limit(50);
    res.json({ success: true, announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Delete/retract an announcement (admin) ───────────────────────────────────
// Ownership doesn't apply — it's a shared broadcast, not a personal
// resource, so any admin can retract any announcement.
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });

    try {
      await logAdminAction({
        actor: req.user._id, action: 'announcement.delete', targetType: 'Announcement', targetId: req.params.id, ip: req.ip,
      });
    } catch (logErr) {
      console.error('logAdminAction failed (announcement.delete):', logErr.message);
    }

    res.json({ success: true, message: 'Announcement removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

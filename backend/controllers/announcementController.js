const Announcement = require('../models/Announcement');
const { logAdminAction } = require('../utils/auditLogger');

// ── Create + broadcast an announcement (admin) ───────────────────────────────
exports.createAndBroadcast = async (req, res) => {
  try {
    const { title, body } = req.body;
    const announcement = await Announcement.create({
      title, body, createdBy: req.user._id,
    });

    try {
      await logAdminAction({
        actor: req.user._id, action: 'announcement.create', targetType: 'Announcement', targetId: announcement._id, metadata: { title }, ip: req.ip,
      });
    } catch (logErr) {
      console.error('logAdminAction failed (announcement.create):', logErr.message);
    }

    res.status(201).json({ success: true, announcement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── List announcements (any authenticated user) ─────────────────────────────
// A notification feed, not a paginated archive — most recent 50 is plenty
// for a first pass.
exports.listAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
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

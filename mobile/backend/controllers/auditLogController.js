const AuditLog = require('../models/AuditLog');

// GET /admin/audit-log — paginated, optionally filtered by exact action,
// exact targetType, actor (user id), and a createdAt date range.
exports.getAuditLog = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, action, actor, targetType, from, to,
    } = req.query;

    const query = {};
    if (action) query.action = action;
    if (actor) query.actor = actor;
    if (targetType) query.targetType = targetType;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true, logs, total, page: Number(page), pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

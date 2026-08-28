const User = require('../models/User');
const Session = require('../models/Session');
const HealthProfile = require('../models/HealthProfile');

// ── Overview stats ─────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalSessions,
      completedSessions,
      emergencySessions,
      todaySessions,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Session.countDocuments(),
      Session.countDocuments({ status: 'completed' }),
      Session.countDocuments({ emergencyDetected: true }),
      Session.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    // Severity breakdown
    const severityBreakdown = await Session.aggregate([
      { $match: { severityLevel: { $exists: true, $ne: null } } },
      { $group: { _id: '$severityLevel', count: { $sum: 1 } } },
    ]);

    // Sessions per day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sessionsByDay = await Session.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalUsers,
      activeUsers,
      totalSessions,
      completedSessions,
      emergencySessions,
      todaySessions,
      severityBreakdown,
      sessionsByDay,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get all users ──────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const query = search
      ? { $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ]}
      : {};

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -loginOtp -emailVerifyToken -trustedDevices')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    // Get session counts per user
    const userIds = users.map(u => u._id);
    const sessionCounts = await Session.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    sessionCounts.forEach(s => { countMap[s._id.toString()] = s.count; });

    const enriched = users.map(u => ({
      ...u.toObject(),
      sessionCount: countMap[u._id.toString()] || 0,
    }));

    res.json({ users: enriched, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get single user detail ─────────────────────────────────────────────────
exports.getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -loginOtp -emailVerifyToken -trustedDevices');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const [profile, sessions] = await Promise.all([
      HealthProfile.findOne({ user: user._id }),
      Session.find({ user: user._id })
        .select('-messages')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    res.json({ user, profile, sessions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Toggle user active status ──────────────────────────────────────────────
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin')
      return res.status(403).json({ message: 'Cannot deactivate an admin account' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get all sessions (admin) ───────────────────────────────────────────────
exports.getAllSessions = async (req, res) => {
  try {
    const { page = 1, limit = 20, severity, emergency, status } = req.query;

    const query = {};
    if (severity) query.severityLevel = severity;
    if (emergency === 'true') query.emergencyDetected = true;
    if (status) query.status = status;

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .select('-messages')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Session.countDocuments(query),
    ]);

    res.json({ sessions, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
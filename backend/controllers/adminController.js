const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const HealthProfile = require('../models/HealthProfile');
const { sendEmail, adminInviteEmailTemplate } = require('../utils/email');

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

// ── Invite a new admin ───────────────────────────────────────────────────────
exports.inviteAdmin = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email)
      return res.status(400).json({ message: 'Name and email are required' });

    let user = await User.findOne({ email });
    if (user) {
      // Allow re-inviting an address that's still an unaccepted pending
      // invite (e.g. the first invite email failed to send) — only block
      // when the email belongs to a real, already-active account.
      const isPendingInvite = user.role === 'admin' && user.adminInviteToken && user.adminInviteExpires > Date.now();
      if (!isPendingInvite) {
        return res.status(400).json({ message: 'A user with this email already exists' });
      }
    } else {
      // Placeholder password — random and bcrypt-hashed via the pre('save') hook,
      // so login can never succeed until the invite is accepted and a real
      // password is set.
      const placeholderPassword = crypto.randomBytes(32).toString('hex');
      user = await User.create({
        name,
        email,
        password: placeholderPassword,
        role: 'admin',
        isEmailVerified: false,
        invitedBy: req.user._id,
      });
    }

    const rawToken = user.generateAdminInviteToken();
    await user.save({ validateBeforeSave: false });

    const link = `${process.env.CLIENT_URL}/admin/accept-invite?token=${rawToken}`;
    try {
      await sendEmail({
        to: user.email,
        subject: "You've been invited as a MediSense AI admin",
        html: adminInviteEmailTemplate(user.name, link, req.user.name),
      });
    } catch (emailErr) {
      // The invite record (with a working token) was already saved — don't
      // report total failure, since it's a real, resendable invite even
      // though this particular email attempt didn't go out.
      console.error('inviteAdmin email send failed:', emailErr.message);
      return res.status(201).json({ message: 'Invite created, but the email failed to send. Try inviting this address again to resend it.' });
    }

    res.status(201).json({ message: 'Invite sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── List pending admin invites ───────────────────────────────────────────────
exports.getPendingInvites = async (req, res) => {
  try {
    const invites = await User.find({
      role: 'admin',
      adminInviteToken: { $ne: null },
      adminInviteExpires: { $gt: Date.now() },
    })
      .select('name email createdAt adminInviteExpires invitedBy')
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ invites });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Revoke a pending admin invite ────────────────────────────────────────────
exports.revokeInvite = async (req, res) => {
  try {
    const invite = await User.findOne({
      _id: req.params.id,
      role: 'admin',
      adminInviteToken: { $ne: null },
      adminInviteExpires: { $gt: Date.now() },
    });
    if (!invite)
      return res.status(404).json({ message: 'Pending invite not found' });

    await invite.deleteOne();
    res.json({ message: 'Invite revoked.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail, otpEmailTemplate } = require('../utils/email');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// ── Accept admin invite (set initial password) ─────────────────────────────
exports.acceptAdminInvite = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ success: false, message: 'Token and password are required' });

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      adminInviteToken: hashed,
      adminInviteExpires: { $gt: Date.now() },
      role: 'admin',
    });

    if (!user)
      return res.status(400).json({ success: false, message: 'Invite link is invalid or has expired.' });

    user.password = password; // pre('save') hook hashes it; minlength validator should run here
    user.isEmailVerified = true;
    user.adminInviteToken = undefined;
    user.adminInviteExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password set. You can now log in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin Login (step 1 — send OTP) ─────────────────────────────────────────
// Mandatory OTP, no trusted-device bypass. Rejects a wrong password, an
// unknown email, and a correct-password-but-non-admin account with the
// identical generic message — never reveal which case it was.
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)) || user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const otp = user.generateOtp();
    await user.save({ validateBeforeSave: false });
    await sendEmail({
      to: user.email,
      subject: 'Your MediSense AI admin login code',
      html: otpEmailTemplate(user.name, otp),
    });

    res.json({ success: true, step: 'otp', message: 'A 6-digit code has been sent to your email.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin Resend Login OTP ───────────────────────────────────────────────────
// Same safe pattern as the consumer resendOtp — only sends if there's a
// genuinely live pending OTP, identical response either way.
exports.adminResendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email, role: 'admin' });
    if (user && user.loginOtp && user.loginOtpExpires > Date.now()) {
      const otp = user.generateOtp();
      await user.save({ validateBeforeSave: false });
      await sendEmail({
        to: user.email,
        subject: 'Your MediSense AI admin login code',
        html: otpEmailTemplate(user.name, otp),
      });
    }

    res.json({ success: true, message: 'If a login is in progress for that email, a new code has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin Verify OTP (step 2 — complete login) ──────────────────────────────
exports.adminVerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const user = await User.findOne({ email, role: 'admin' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.loginOtpAttempts >= 5)
      return res.status(429).json({ success: false, message: 'Too many attempts. Please log in again to get a new code.' });

    if (!user.loginOtp || user.loginOtpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Code has expired. Please log in again to get a new one.' });
    }

    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashed !== user.loginOtp) {
      user.loginOtpAttempts += 1;
      await user.save({ validateBeforeSave: false });
      const remaining = 5 - user.loginOtpAttempts;
      return res.status(400).json({ success: false, message: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
    }

    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;
    user.loginOtpAttempts = 0;
    user.lastActive = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Me ────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

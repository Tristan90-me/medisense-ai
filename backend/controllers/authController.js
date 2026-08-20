const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const { sendEmail, verificationEmailTemplate, otpEmailTemplate } = require('../utils/email');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// ── Register ──────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ 
      name, 
      email, 
      password,
      isEmailVerified: true
    });
    await HealthProfile.create({ user: user._id });

    const rawToken = user.generateVerifyToken();
    await user.save({ validateBeforeSave: false });

    const verifyLink = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify your MediSense AI email',
      html: verificationEmailTemplate(user.name, verifyLink),
    });

    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Verify Email ──────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      emailVerifyToken: hashed,
      emailVerifyExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ success: false, message: 'Verification link is invalid or has expired.' });

    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Resend Verification ───────────────────────────────────
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with that email.' });
    if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email already verified.' });

    const rawToken = user.generateVerifyToken();
    await user.save({ validateBeforeSave: false });

    const verifyLink = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify your MediSense AI email',
      html: verificationEmailTemplate(user.name, verifyLink),
    });

    res.json({ success: true, message: 'Verification email resent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Login (step 1 — send OTP) ─────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password, deviceToken } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!user.isEmailVerified)
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED' });

    // Check trusted device — skip OTP if valid
    if (deviceToken && user.isTrustedDevice(deviceToken)) {
      user.lastActive = Date.now();
      await user.save({ validateBeforeSave: false });
      const token = generateToken(user._id);
      return res.json({
        success: true,
        step: 'done',
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    }

    // Generate and send OTP
    const otp = user.generateOtp();
    await user.save({ validateBeforeSave: false });
    await sendEmail({
      to: user.email,
      subject: 'Your MediSense AI login code',
      html: otpEmailTemplate(user.name, otp),
    });

    res.json({ success: true, step: 'otp', message: 'A 6-digit code has been sent to your email.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Verify OTP (step 2 — complete login) ──────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, rememberDays } = req.body;
    if (!email || !otp)
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const user = await User.findOne({ email });
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

    // OTP correct — clear it
    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;
    user.loginOtpAttempts = 0;
    user.lastActive = Date.now();

    // Handle remember me
    let deviceToken = null;
    let deviceExpires = null;
    if (rememberDays && [7, 14].includes(Number(rememberDays))) {
      const device = user.generateDeviceToken(Number(rememberDays));
      deviceToken = device.token;
      deviceExpires = device.expiresAt;
    }

    await user.save({ validateBeforeSave: false });
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      deviceToken,
      deviceExpires,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get Me ────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};
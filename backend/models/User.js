const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true },
  lastActive: { type: Date, default: Date.now },

  // Email verification
  isEmailVerified: { type: Boolean, default: false },
  emailVerifyToken: String,
  emailVerifyExpires: Date,

  // OTP login
  loginOtp: String,
  loginOtpExpires: Date,
  loginOtpAttempts: { type: Number, default: 0 },

  // Trusted devices (remember me)
  trustedDevices: [{
    token: String,
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.generateVerifyToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerifyToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

UserSchema.methods.generateOtp = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.loginOtp = crypto.createHash('sha256').update(otp).digest('hex');
  this.loginOtpExpires = Date.now() + 10 * 60 * 1000;
  this.loginOtpAttempts = 0;
  return otp;
};

UserSchema.methods.generateDeviceToken = function (days) {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  // Clean expired tokens first
  this.trustedDevices = this.trustedDevices.filter(d => d.expiresAt > new Date());
  this.trustedDevices.push({ token, expiresAt });
  return { token, expiresAt };
};

UserSchema.methods.isTrustedDevice = function (token) {
  if (!token) return false;
  const now = new Date();
  return this.trustedDevices.some(d => d.token === token && d.expiresAt > now);
};

module.exports = mongoose.model('User', UserSchema);
const mongoose = require('mongoose');
const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const Session = require('../models/Session');
const Dependent = require('../models/Dependent');

exports.getAccount = async (req, res) => {
  try {
    // req.user is already password-stripped by the `protect` middleware.
    res.json({ success: true, user: req.user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    // Mongo duplicate-key error on the unique `email` index.
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    // req.user has its password field stripped by `protect`, so load the
    // full document here to be able to compare/re-hash it.
    const user = await User.findById(req.user._id);
    const matches = await user.matchPassword(currentPassword);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save(); // pre('save') hook re-hashes automatically

    // Changing the password invalidates any "remember me" devices as a
    // security measure — force re-authentication everywhere else.
    user.trustedDevices = [];
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listTrustedDevices = async (req, res) => {
  try {
    // Never include the raw `token` — it's a bearer credential, not display data.
    const devices = req.user.trustedDevices.map((d) => ({
      id: d._id,
      expiresAt: d.expiresAt,
      createdAt: d.createdAt,
    }));
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.revokeTrustedDevice = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, 'trustedDevices._id': req.params.id },
      { $pull: { trustedDevices: { _id: req.params.id } } },
      { returnDocument: 'after' }
    );
    if (!user) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, message: 'Device revoked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Self-service full account deletion is deliberately a broad cascade — a
// materially different, more complete action than dependentController's
// conservative non-cascade deletion of a single dependent.
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);
    const matches = await user.matchPassword(password);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Password is incorrect' });
    }

    const dependents = await Dependent.find({ owner: user._id }).select('_id');
    const dependentIds = dependents.map((d) => d._id);

    await Promise.all([
      HealthProfile.deleteMany({ user: user._id }),
      Session.deleteMany({ user: user._id }),
      Dependent.deleteMany({ owner: user._id }),
      dependentIds.length
        ? HealthProfile.deleteMany({ dependent: { $in: dependentIds } })
        : Promise.resolve(),
    ]);

    // EmergencyContact may not exist yet (4c may not be merged) — skip it
    // safely rather than failing the whole deletion if the model isn't registered.
    if (mongoose.models.EmergencyContact) {
      try {
        await mongoose.models.EmergencyContact.deleteMany({ user: user._id });
      } catch {
        // non-fatal — account deletion should still proceed
      }
    }

    await User.deleteOne({ _id: user._id });

    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

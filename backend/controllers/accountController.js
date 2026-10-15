const mongoose = require('mongoose');
const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const Session = require('../models/Session');
const Dependent = require('../models/Dependent');
const Medication = require('../models/Medication');
const PhotoLog = require('../models/PhotoLog');
const HealthScore = require('../models/HealthScore');
const ShareLink = require('../models/ShareLink');
const Appointment = require('../models/Appointment');
const WeeklySummary = require('../models/WeeklySummary');
const { deleteFile } = require('../utils/gridfs');

// Deletes every PhotoLog row for this user AND the GridFS image blob each
// one points to — PhotoLog.deleteMany alone would silently orphan the
// actual image bytes forever (see photoLogController.deletePhoto, which
// does the same two-step delete for a single photo).
const deleteAllPhotosForUser = async (userId) => {
  const photos = await PhotoLog.find({ user: userId }).select('imageRef');
  await Promise.all(photos.map((p) => deleteFile(p.imageRef)));
  await PhotoLog.deleteMany({ user: userId });
};

// Shared by deleteHealthHistory and deleteAccount — every "health activity"
// collection, scoped to this account (covers the account owner's own data
// AND their dependents', since all of these are stored with `user` set to
// the owning account regardless of which profile they're about).
const deleteHealthDataForUser = async (userId) => {
  await Promise.all([
    Session.deleteMany({ user: userId }),
    Medication.deleteMany({ user: userId }),
    HealthScore.deleteMany({ user: userId }),
    ShareLink.deleteMany({ user: userId }),
    Appointment.deleteMany({ user: userId }),
    WeeklySummary.deleteMany({ user: userId }),
    deleteAllPhotosForUser(userId),
  ]);
};

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

    await deleteHealthDataForUser(user._id);

    await Promise.all([
      HealthProfile.deleteMany({ user: user._id }),
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

// Narrower than deleteAccount — clears activity/history data (sessions,
// medications, photos, health score, share links) but keeps the account,
// health profile(s), dependents, and emergency contacts intact. For someone
// who wants a clean slate without starting over on setup.
exports.deleteHealthHistory = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);
    const matches = await user.matchPassword(password);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Password is incorrect' });
    }

    await deleteHealthDataForUser(user._id);

    res.json({ success: true, message: 'Health history deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// A plain JSON export of everything this account's data export should
// reasonably include — the account owner reading back their own data, so
// unlike the public share feature there's no need to redact anything here.
// Photo image bytes are deliberately excluded (metadata only) — including
// them would mean base64-inlining GridFS blobs into one JSON response,
// which doesn't scale and isn't what "my data as structured records" means.
exports.exportAccountData = async (req, res) => {
  try {
    const userId = req.user._id;

    // Unlike the public share feature (shareController.js), this is the
    // account owner reading back their own data — the full session
    // including its message transcript belongs in a "give me all my data"
    // export, not just the derived summary fields.
    const [healthProfiles, dependents, sessions, medications, photoLogs, emergencyContacts, appointments] = await Promise.all([
      HealthProfile.find({ user: userId }),
      Dependent.find({ owner: userId }),
      Session.find({ user: userId }),
      Medication.find({ user: userId }),
      PhotoLog.find({ user: userId }),
      mongoose.models.EmergencyContact ? mongoose.models.EmergencyContact.find({ user: userId }) : [],
      Appointment.find({ user: userId }),
    ]);

    res.setHeader('Content-Disposition', `attachment; filename="medisense-my-data-${Date.now()}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      account: { name: req.user.name, email: req.user.email, createdAt: req.user.createdAt },
      healthProfiles,
      dependents,
      sessions,
      medications,
      photoLogs,
      emergencyContacts,
      appointments,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

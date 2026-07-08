const HealthProfile = require('../models/HealthProfile');

exports.getProfile = async (req, res) => {
  try {
    const profile = await HealthProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const profile = await HealthProfile.findOneAndUpdate(
      { user: req.user._id },
      { ...req.body, onboardingComplete: true },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
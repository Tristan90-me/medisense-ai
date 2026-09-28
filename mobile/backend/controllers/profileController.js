const HealthProfile = require('../models/HealthProfile');
const { resolveDependentId } = require('../utils/resolveDependent');

exports.getProfile = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.query.dependent, req.user._id);
    const profile = await HealthProfile.findOne({ user: req.user._id, dependent });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const { dependent: _ignored, ...updates } = req.body;
    const profile = await HealthProfile.findOneAndUpdate(
      { user: req.user._id, dependent },
      { ...updates, dependent, onboardingComplete: true },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );
    res.json({ success: true, profile });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

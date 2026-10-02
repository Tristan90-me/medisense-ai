const BodyMetric = require('../models/BodyMetric');
const HealthProfile = require('../models/HealthProfile');
const { resolveDependentId } = require('../utils/resolveDependent');
const { toKg, toCm, calcBMI } = require('../utils/energy');

exports.logMetric = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const {
      weightKg, measurements, bodyFatPct, loggedAt,
    } = req.body;
    const metric = await BodyMetric.create({
      user: req.user._id, dependent, weightKg, measurements, bodyFatPct, ...(loggedAt ? { loggedAt } : {}),
    });
    res.status(201).json({ success: true, metric });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.listMetrics = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const metrics = await BodyMetric.find({ user: req.user._id, dependent }).sort({ loggedAt: -1 }).limit(200);
    res.json({ success: true, metrics });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/body-metrics/latest?dependent= — most recent logged weight (or
// the health profile's own stored weight, if no metric has one yet) plus a
// BMI computed against the profile's height.
exports.getLatest = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const [latest, profile] = await Promise.all([
      BodyMetric.findOne({ user: req.user._id, dependent, weightKg: { $ne: null } }).sort({ loggedAt: -1 }),
      HealthProfile.findOne({ user: req.user._id, dependent }),
    ]);
    const weightKg = latest?.weightKg ?? toKg(profile?.weight, profile?.weightUnit);
    const heightCm = toCm(profile?.height, profile?.heightUnit);
    res.json({ success: true, latest, bmi: calcBMI(weightKg, heightCm) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.deleteMetric = async (req, res) => {
  try {
    const metric = await BodyMetric.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!metric) return res.status(404).json({ success: false, message: 'Body metric entry not found' });
    res.json({ success: true, message: 'Body metric entry removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

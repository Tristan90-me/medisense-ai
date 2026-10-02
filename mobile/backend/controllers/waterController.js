const WaterIntake = require('../models/WaterIntake');
const { resolveDependentId } = require('../utils/resolveDependent');
const { parseDayRange } = require('../utils/dayRange');

// POST /api/water — logs one "glass tapped" event; the day's total is a sum
// over the day's events, not an incrementally-updated running total.
exports.logWater = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const { amountMl, loggedAt } = req.body;
    const entry = await WaterIntake.create({
      user: req.user._id, dependent, amountMl, ...(loggedAt ? { loggedAt } : {}),
    });
    res.status(201).json({ success: true, entry });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/water?date=YYYY-MM-DD&dependent=<id>
exports.listWater = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const { start, end } = parseDayRange(req.query.date);
    const entries = await WaterIntake.find({
      user: req.user._id, dependent, loggedAt: { $gte: start, $lt: end },
    }).sort({ loggedAt: 1 });
    res.json({
      success: true,
      date: start.toISOString().slice(0, 10),
      entries,
      totalMl: entries.reduce((sum, e) => sum + e.amountMl, 0),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.deleteWater = async (req, res) => {
  try {
    const entry = await WaterIntake.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ success: false, message: 'Water log entry not found' });
    res.json({ success: true, message: 'Water log entry removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

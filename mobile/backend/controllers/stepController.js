const StepDay = require('../models/StepDay');
const HealthProfile = require('../models/HealthProfile');
const { resolveDependentId } = require('../utils/resolveDependent');
const { parseDayRange } = require('../utils/dayRange');
const {
  toKg, toCm, stepsToCalories, stepsToDistanceKm,
} = require('../utils/energy');

// POST /api/steps — upserts a day's running step total from a device
// Pedometer sync (the client always sends the current cumulative count for
// that day, so this overwrites rather than adds). distanceKm/caloriesBurned
// are computed once here from the profile's current height/weight.
exports.syncSteps = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const { steps, date } = req.body;
    const { start } = parseDayRange(date);
    const dateStr = start.toISOString().slice(0, 10);

    const profile = await HealthProfile.findOne({ user: req.user._id, dependent });
    const weightKg = toKg(profile?.weight, profile?.weightUnit);
    const heightCm = toCm(profile?.height, profile?.heightUnit);

    const stepDay = await StepDay.findOneAndUpdate(
      { user: req.user._id, dependent, date: dateStr },
      {
        steps,
        distanceKm: stepsToDistanceKm(steps, heightCm),
        caloriesBurned: stepsToCalories(steps, weightKg),
      },
      {
        upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true,
      },
    );
    res.status(201).json({ success: true, stepDay });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/steps?date=&dependent= — a single day, defaulting to today.
exports.getDay = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const { start } = parseDayRange(req.query.date);
    const dateStr = start.toISOString().slice(0, 10);
    const stepDay = await StepDay.findOne({ user: req.user._id, dependent, date: dateStr });
    res.json({
      success: true,
      date: dateStr,
      stepDay: stepDay || {
        steps: 0, distanceKm: 0, caloriesBurned: 0,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/steps/range?days=7&dependent= — recent daily totals for a trend chart.
exports.getRange = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const days = req.query.days ? parseInt(req.query.days, 10) : 7;
    const stepDays = await StepDay.find({ user: req.user._id, dependent }).sort({ date: -1 }).limit(days);
    res.json({ success: true, stepDays: stepDays.reverse() });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

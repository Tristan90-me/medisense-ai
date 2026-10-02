const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');

// Throws a 400 before any write if a plan references an exercise id that
// doesn't exist — same validate-before-persist reasoning as recipeController.
async function validateExerciseRefs(days) {
  const ids = [...new Set((days || []).flatMap((d) => (d.exercises || []).map((e) => String(e.exercise))))];
  if (ids.length === 0) return;
  const found = await Exercise.find({ _id: { $in: ids } }).select('_id');
  const foundSet = new Set(found.map((f) => String(f._id)));
  const missing = ids.filter((id) => !foundSet.has(id));
  if (missing.length) {
    const err = new Error(`Unknown exercise id(s): ${missing.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

exports.listPlans = async (req, res) => {
  try {
    const plans = await WorkoutPlan.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPlan = async (req, res) => {
  try {
    const plan = await WorkoutPlan.findOne({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ success: false, message: 'Workout plan not found' });
    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const { name, days, active } = req.body;
    await validateExerciseRefs(days);
    const plan = await WorkoutPlan.create({
      user: req.user._id, name, days, active,
    });
    res.status(201).json({ success: true, plan });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { name, days, active } = req.body;
    if (days !== undefined) await validateExerciseRefs(days);

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (days !== undefined) updates.days = days;
    if (active !== undefined) updates.active = active;

    const plan = await WorkoutPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { returnDocument: 'after', runValidators: true },
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Workout plan not found' });
    res.json({ success: true, plan });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const plan = await WorkoutPlan.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ success: false, message: 'Workout plan not found' });
    res.json({ success: true, message: 'Workout plan removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

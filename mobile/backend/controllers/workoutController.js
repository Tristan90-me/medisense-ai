const WorkoutLog = require('../models/WorkoutLog');
const Exercise = require('../models/Exercise');
const HealthProfile = require('../models/HealthProfile');
const PersonalRecord = require('../models/PersonalRecord');
const { resolveDependentId } = require('../utils/resolveDependent');
const { parseDayRange } = require('../utils/dayRange');
const { caloriesForWorkout, paceMinPerKm } = require('../utils/workoutMath');
const { toKg } = require('../utils/energy');
const { evaluateWorkoutForRecords } = require('../utils/personalRecords');

// Resolves every logged exercise id up front, throwing before any write if
// one doesn't exist — same reasoning as recipeController/workoutPlanController.
async function resolveExercises(exercises) {
  const ids = [...new Set((exercises || []).map((e) => String(e.exercise)))];
  if (ids.length === 0) return new Map();
  const found = await Exercise.find({ _id: { $in: ids } });
  const map = new Map(found.map((f) => [String(f._id), f]));
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length) {
    const err = new Error(`Unknown exercise id(s): ${missing.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  return map;
}

// POST /api/workouts
exports.logWorkout = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const {
      type, name, durationMin, exercises, cardio, workoutPlan, planDayNumber, notes, loggedAt,
    } = req.body;

    const exerciseMap = await resolveExercises(exercises);
    const snapshotExercises = (exercises || []).map((e) => ({
      exercise: e.exercise, name: exerciseMap.get(String(e.exercise)).name, sets: e.sets || [],
    }));

    const profile = await HealthProfile.findOne({ user: req.user._id, dependent });
    const weightKg = toKg(profile?.weight, profile?.weightUnit);
    const caloriesBurned = caloriesForWorkout(type, durationMin, weightKg);

    let cardioData;
    if (type === 'cardio' && cardio?.distanceKm) {
      cardioData = { distanceKm: cardio.distanceKm, avgPaceMinPerKm: paceMinPerKm(cardio.distanceKm, durationMin) };
    }

    const workoutLog = await WorkoutLog.create({
      user: req.user._id,
      dependent,
      type,
      name,
      durationMin,
      exercises: snapshotExercises,
      cardio: cardioData,
      caloriesBurned,
      workoutPlan: workoutPlan || null,
      planDayNumber: planDayNumber || null,
      notes,
      ...(loggedAt ? { loggedAt } : {}),
    });

    const newRecords = await evaluateWorkoutForRecords(workoutLog);
    res.status(201).json({ success: true, workoutLog, newRecords });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/workouts?date=&dependent= — a single day when `date` is given,
// otherwise the 50 most recent logs.
exports.listWorkouts = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;

    if (req.query.date) {
      const { start, end } = parseDayRange(req.query.date);
      const workoutLogs = await WorkoutLog.find({
        user: req.user._id, dependent, loggedAt: { $gte: start, $lt: end },
      }).sort({ loggedAt: 1 });
      return res.json({ success: true, date: start.toISOString().slice(0, 10), workoutLogs });
    }

    const workoutLogs = await WorkoutLog.find({ user: req.user._id, dependent }).sort({ loggedAt: -1 }).limit(50);
    return res.json({ success: true, workoutLogs });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/workouts/records?dependent=
exports.getPersonalRecords = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const records = await PersonalRecord.find({ user: req.user._id, dependent }).populate('exercise', 'name category');
    res.json({ success: true, records });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.getWorkout = async (req, res) => {
  try {
    const workoutLog = await WorkoutLog.findOne({ _id: req.params.id, user: req.user._id });
    if (!workoutLog) return res.status(404).json({ success: false, message: 'Workout log not found' });
    res.json({ success: true, workoutLog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteWorkout = async (req, res) => {
  try {
    const workoutLog = await WorkoutLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!workoutLog) return res.status(404).json({ success: false, message: 'Workout log not found' });
    res.json({ success: true, message: 'Workout log removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

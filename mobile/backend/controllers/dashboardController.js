const { resolveDependentId } = require('../utils/resolveDependent');
const { gatherDay } = require('../utils/dailyDashboard');
const { parseDayRange } = require('../utils/dayRange');

// GET /api/dashboard/today?date=&dependent= — the unified steps+workouts+
// macros+water view. Defaults to today; `date` also doubles as a "day
// summary" for any past day, so there's no separate /summary/daily endpoint.
// `workouts.logs` (full WorkoutLog docs) is trimmed from the response here —
// it exists on gatherDay's return for insightController's internal use, but
// a client wanting full workout detail should hit GET /workouts?date=.
exports.getToday = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const day = await gatherDay({ user: req.user._id, dependent }, req.query.date);
    res.json({
      success: true,
      date: day.date,
      steps: day.steps,
      workouts: { count: day.workouts.count, goalPerWeek: day.workouts.goalPerWeek, caloriesBurned: day.workouts.caloriesBurned },
      water: day.water,
      nutrition: day.nutrition,
      energy: day.energy,
      nutritionScore: day.nutritionScore,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/weekly?dependent= — the last 7 days (today inclusive),
// averaged, plus a per-day breakdown for a trend chart. Runs gatherDay once
// per day rather than a single range query — simpler, and plenty fast at
// the scale of one person's week of data.
exports.getWeeklySummary = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const scope = { user: req.user._id, dependent };
    const { start: todayStart } = parseDayRange();

    const dateStrs = [];
    for (let i = 6; i >= 0; i -= 1) {
      dateStrs.push(new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    }
    const results = await Promise.all(dateStrs.map((d) => gatherDay(scope, d)));

    const totalSteps = results.reduce((sum, r) => sum + r.steps.count, 0);
    const totalCaloriesConsumed = results.reduce((sum, r) => sum + r.nutrition.consumed.calories, 0);
    const totalCaloriesBurned = results.reduce((sum, r) => sum + r.energy.burnedTotal, 0);
    const totalWaterMl = results.reduce((sum, r) => sum + r.water.totalMl, 0);
    const totalWorkouts = results.reduce((sum, r) => sum + r.workouts.count, 0);

    res.json({
      success: true,
      rangeStart: dateStrs[0],
      rangeEnd: dateStrs[6],
      workoutsLogged: totalWorkouts,
      avgStepsPerDay: Math.round(totalSteps / 7),
      avgCaloriesConsumed: Math.round(totalCaloriesConsumed / 7),
      avgCaloriesBurned: Math.round(totalCaloriesBurned / 7),
      avgWaterMl: Math.round(totalWaterMl / 7),
      days: results.map((r) => ({
        date: r.date,
        steps: r.steps.count,
        caloriesConsumed: r.nutrition.consumed.calories,
        caloriesBurned: r.energy.burnedTotal,
        waterMl: r.water.totalMl,
        workouts: r.workouts.count,
      })),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

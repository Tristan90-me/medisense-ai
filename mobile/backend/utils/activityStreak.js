const { computeStreak, toDayStr } = require('./streak');

// Consecutive-day streak of activity in `Model`, scoped by `scope` (e.g.
// {user, dependent}) over a Date-typed `dateField`, looking back at most
// `windowDays` — a streak can never exceed that, so there's no reason to
// scan further history. Used for the workout/meal-logging/hydration streaks
// surfaced through achievement context (see controllers/healthScoreController.js).
async function activityStreak(Model, scope, dateField, windowDays = 60, now = new Date()) {
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const dates = await Model.distinct(dateField, { ...scope, [dateField]: { $gte: since } });
  const activeDays = new Set(dates.map((d) => toDayStr(d)));
  return computeStreak(activeDays, now);
}

module.exports = { activityStreak };

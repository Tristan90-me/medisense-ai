const PersonalRecord = require('../models/PersonalRecord');

// Whether `newValue` beats `currentValue` for this PR kind. Higher is
// better for strength_weight/cardio_distance; LOWER is better for
// cardio_pace (a faster pace is a smaller min/km value). A missing current
// value is always beaten (first record for this exercise/kind).
function isBetter(kind, newValue, currentValue) {
  if (currentValue == null) return true;
  return kind === 'cardio_pace' ? newValue < currentValue : newValue > currentValue;
}

// Upserts a PR only if `value` actually beats the current one for
// (user, dependent, kind, exercise). Returns the PR doc when a new record
// was set, otherwise null.
async function maybeSetRecord({
  user, dependent, kind, exercise = null, value, achievedAt, workoutLog,
}) {
  if (!(value > 0)) return null;
  const filter = { user, dependent, kind, exercise };
  const existing = await PersonalRecord.findOne(filter);
  if (!isBetter(kind, value, existing?.value)) return null;
  return PersonalRecord.findOneAndUpdate(
    filter,
    { value, achievedAt, workoutLog },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

// Evaluates every PR a single WorkoutLog could set (heaviest set per
// exercise for strength; distance/pace for cardio) and applies whichever
// ones beat the existing record. Returns the array of newly-set PRs.
//
// Deletion note: removing a WorkoutLog later does not currently roll back
// or recompute a PR it set — a PR stays as the best-ever-recorded value.
// Recomputing from remaining history on delete is a reasonable future
// refinement, not done here.
async function evaluateWorkoutForRecords(workoutLog) {
  const {
    user, dependent, _id: workoutLogId, loggedAt,
  } = workoutLog;
  const newRecords = [];

  if (workoutLog.type === 'strength') {
    for (const logged of workoutLog.exercises) {
      const heaviestSet = logged.sets.reduce(
        (best, s) => (((s.weightKg || 0) > (best?.weightKg || 0)) ? s : best),
        null,
      );
      if (!heaviestSet || !(heaviestSet.weightKg > 0)) continue;
      const pr = await maybeSetRecord({
        user,
        dependent,
        kind: 'strength_weight',
        exercise: logged.exercise,
        value: heaviestSet.weightKg,
        achievedAt: loggedAt,
        workoutLog: workoutLogId,
      });
      if (pr) newRecords.push(pr);
    }
  }

  if (workoutLog.type === 'cardio' && workoutLog.cardio) {
    const { distanceKm, avgPaceMinPerKm } = workoutLog.cardio;
    if (distanceKm > 0) {
      const pr = await maybeSetRecord({
        user, dependent, kind: 'cardio_distance', value: distanceKm, achievedAt: loggedAt, workoutLog: workoutLogId,
      });
      if (pr) newRecords.push(pr);
    }
    if (avgPaceMinPerKm > 0) {
      const pr = await maybeSetRecord({
        user, dependent, kind: 'cardio_pace', value: avgPaceMinPerKm, achievedAt: loggedAt, workoutLog: workoutLogId,
      });
      if (pr) newRecords.push(pr);
    }
  }

  return newRecords;
}

module.exports = { isBetter, maybeSetRecord, evaluateWorkoutForRecords };

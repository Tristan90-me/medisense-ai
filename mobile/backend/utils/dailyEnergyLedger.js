// Combines calories eaten, calories burned and the day's goal into the one
// picture both the nutrition and fitness screens show. Pure: callers pass in
// already-aggregated numbers (DB aggregation lives with the dashboard endpoint).
//
// Double-counting trap: a TDEE built from an activity level already includes
// typical daily movement. If logged exercise is also added back to the budget,
// that movement is counted twice. So when addBackExercise is on, the goal must
// be built from the SEDENTARY baseline. controllers/goalController.js enforces
// that when it computes the calorie target; this function trusts its inputs.

const round = (n) => Math.round(n || 0);

function buildLedger({
  goalCalories,
  consumed = 0,
  burnedFromSteps = 0,
  burnedFromWorkouts = 0,
  addBackExercise = false,
}) {
  const burned = round(burnedFromSteps) + round(burnedFromWorkouts);
  const eaten = round(consumed);
  const hasGoal = typeof goalCalories === 'number' && goalCalories > 0;
  const budget = hasGoal ? goalCalories + (addBackExercise ? burned : 0) : null;

  return {
    goal: hasGoal ? round(goalCalories) : null,
    consumed: eaten,
    burnedFromSteps: round(burnedFromSteps),
    burnedFromWorkouts: round(burnedFromWorkouts),
    burnedTotal: burned,
    // Energy balance regardless of goal: positive = surplus, negative = deficit.
    net: eaten - burned,
    budget,
    remaining: budget == null ? null : round(budget - eaten),
    over: budget != null && eaten > budget,
    addBackExercise,
  };
}

module.exports = { buildLedger };

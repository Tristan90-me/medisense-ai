// Pure scoring formula for a single day's nutrition — same "no database
// access" shape as utils/computeHealthScore.js, so it's cheaply unit-testable
// in isolation from whatever gathered the numbers (utils/dailyDashboard.js).
//
// 100 points total:
//  - calorieAdherenceScore (0-40): how close consumed calories are to the
//    goal. Full credit at 0 deviation, 0 credit at 50%+ deviation in either
//    direction — both over- and under-eating are penalized equally, since
//    under-eating isn't a "better" outcome.
//  - macroBalanceScore (0-30): same deviation-based credit, averaged across
//    carbs/protein/fat (10 each), for whichever targets are set.
//  - waterScore (0-15): proportional to the day's water goal, capped at 15
//    once the goal is met (exceeding it isn't worth extra credit).
//  - loggingCompletenessScore (0-15): 5 points per distinct meal logged
//    today, capped at 15 — rewards actually tracking the day, not just
//    hitting numbers by chance.
//
// Returns { score: null, reason } when no calorie goal is set at all —
// adherence can't be scored against a target that doesn't exist, and a
// misleading partial score would be worse than admitting there's not enough
// data yet (same reasoning as communityController's insufficientData flag).
const DEVIATION_FOR_ZERO_CREDIT = 0.5; // 50% off target = 0 credit
const MACRO_FIELDS = ['carbsG', 'proteinG', 'fatG'];

const creditForDeviation = (actual, target) => {
  if (!(target > 0)) return 0;
  const deviation = Math.abs(actual - target) / target;
  return Math.max(0, 1 - deviation / DEVIATION_FOR_ZERO_CREDIT);
};

function computeNutritionScore({
  consumed, calorieTarget, macroTargets, waterMl, waterGoalMl, mealsLoggedCount,
}) {
  if (!(calorieTarget > 0)) {
    return { score: null, breakdown: null, reason: 'No calorie goal set' };
  }

  const calorieAdherenceScore = Math.round(40 * creditForDeviation(consumed?.calories || 0, calorieTarget));

  const macroCredits = MACRO_FIELDS.map((f) => creditForDeviation(consumed?.[f] || 0, macroTargets?.[f]));
  const macroBalanceScore = Math.round(10 * macroCredits.reduce((sum, c) => sum + c, 0));

  const waterScore = waterGoalMl > 0 ? Math.round(Math.min(1, (waterMl || 0) / waterGoalMl) * 15) : 0;

  const loggingCompletenessScore = Math.min(15, (mealsLoggedCount || 0) * 5);

  const score = calorieAdherenceScore + macroBalanceScore + waterScore + loggingCompletenessScore;

  return {
    score,
    breakdown: {
      calorieAdherenceScore, macroBalanceScore, waterScore, loggingCompletenessScore,
    },
  };
}

module.exports = { computeNutritionScore };

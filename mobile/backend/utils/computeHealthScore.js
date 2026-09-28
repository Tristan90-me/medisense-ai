// Pure scoring formula — deliberately has NO database access, so it can be
// unit-tested cheaply in isolation from the Mongo-query gathering that
// happens in controllers/healthScoreController.js. Takes an
// already-gathered context object and returns the total score plus its
// five-part breakdown.
const computeScore = (ctx) => {
  const profileCompletenessScore = Math.round(30 * ctx.profileCompleteness); // 0-30
  const sessionFrequencyScore = Math.min(30, ctx.sessionsLast30Days * 5); // 0-30
  const followThroughScore = ctx.totalNonAbandonedSessions > 0
    ? Math.round((20 * ctx.completedSessions) / ctx.totalNonAbandonedSessions)
    : 0; // 0-20
  const medicationTrackingScore = Math.min(10, ctx.activeMedicationsCount * 5); // 0-10
  const noCriticalFlagScore = ctx.hadCriticalOrEmergencyLast30Days ? 0 : 10; // 0-10

  const currentScore = profileCompletenessScore
    + sessionFrequencyScore
    + followThroughScore
    + medicationTrackingScore
    + noCriticalFlagScore;

  return {
    currentScore,
    breakdown: {
      profileCompletenessScore,
      sessionFrequencyScore,
      followThroughScore,
      medicationTrackingScore,
      noCriticalFlagScore,
    },
  };
};

module.exports = { computeScore };

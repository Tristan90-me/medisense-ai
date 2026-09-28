// Pure unit tests for utils/computeHealthScore.js — no DB, no HTTP. Every
// expected number below is hand-derived from the formula in the file itself
// (not just asserted against whatever the implementation happens to
// produce), per:
//   profileCompletenessScore = round(30 * profileCompleteness)                 // 0-30
//   sessionFrequencyScore    = min(30, sessionsLast30Days * 5)                 // 0-30
//   followThroughScore       = totalNonAbandonedSessions > 0
//                              ? round(20 * completedSessions / totalNonAbandonedSessions)
//                              : 0                                             // 0-20
//   medicationTrackingScore  = min(10, activeMedicationsCount * 5)             // 0-10
//   noCriticalFlagScore      = hadCriticalOrEmergencyLast30Days ? 0 : 10       // 0-10
const { computeScore } = require('../utils/computeHealthScore');

describe('computeScore', () => {
  test('a brand-new user with an all-zero context scores only the no-critical-flag baseline', () => {
    const ctx = {
      profileCompleteness: 0,
      sessionsLast30Days: 0,
      totalNonAbandonedSessions: 0,
      completedSessions: 0,
      activeMedicationsCount: 0,
      hadCriticalOrEmergencyLast30Days: false,
    };
    const { currentScore, breakdown } = computeScore(ctx);
    expect(breakdown).toEqual({
      profileCompletenessScore: 0,
      sessionFrequencyScore: 0,
      followThroughScore: 0,
      medicationTrackingScore: 0,
      noCriticalFlagScore: 10,
    });
    expect(currentScore).toBe(10);
  });

  test('a fully-engaged "great" user (complete profile, frequent completed sessions, tracked meds, no critical flags) hits exactly 100', () => {
    const ctx = {
      profileCompleteness: 1,
      sessionsLast30Days: 6,
      totalNonAbandonedSessions: 6,
      completedSessions: 6,
      activeMedicationsCount: 2,
      hadCriticalOrEmergencyLast30Days: false,
    };
    const { currentScore, breakdown } = computeScore(ctx);
    expect(breakdown).toEqual({
      profileCompletenessScore: 30, // round(30*1)
      sessionFrequencyScore: 30, // min(30, 6*5=30)
      followThroughScore: 20, // round(20*6/6)
      medicationTrackingScore: 10, // min(10, 2*5=10)
      noCriticalFlagScore: 10,
    });
    expect(currentScore).toBe(100);
  });

  test('heavy abandonment (many non-abandoned sessions, few completed) drags followThroughScore down specifically', () => {
    const ctx = {
      profileCompleteness: 0.5,
      sessionsLast30Days: 2,
      totalNonAbandonedSessions: 10,
      completedSessions: 1,
      activeMedicationsCount: 0,
      hadCriticalOrEmergencyLast30Days: false,
    };
    const { currentScore, breakdown } = computeScore(ctx);
    expect(breakdown.followThroughScore).toBe(2); // round(20*1/10) = round(2) = 2
    expect(breakdown).toEqual({
      profileCompletenessScore: 15, // round(30*0.5)
      sessionFrequencyScore: 10, // min(30, 2*5=10)
      followThroughScore: 2,
      medicationTrackingScore: 0,
      noCriticalFlagScore: 10,
    });
    expect(currentScore).toBe(37);
  });

  test('sessionFrequencyScore and medicationTrackingScore clamp at their caps instead of exceeding them', () => {
    const ctx = {
      profileCompleteness: 0,
      sessionsLast30Days: 10, // 10*5=50, would exceed the 30 cap
      totalNonAbandonedSessions: 0,
      completedSessions: 0,
      activeMedicationsCount: 5, // 5*5=25, would exceed the 10 cap
      hadCriticalOrEmergencyLast30Days: true,
    };
    const { breakdown } = computeScore(ctx);
    expect(breakdown.sessionFrequencyScore).toBe(30);
    expect(breakdown.medicationTrackingScore).toBe(10);
    expect(breakdown.noCriticalFlagScore).toBe(0);
  });

  test('followThroughScore is 0 (not NaN) when totalNonAbandonedSessions is 0', () => {
    const ctx = {
      profileCompleteness: 0,
      sessionsLast30Days: 0,
      totalNonAbandonedSessions: 0,
      completedSessions: 0,
      activeMedicationsCount: 0,
      hadCriticalOrEmergencyLast30Days: false,
    };
    const { breakdown } = computeScore(ctx);
    expect(breakdown.followThroughScore).toBe(0);
  });
});

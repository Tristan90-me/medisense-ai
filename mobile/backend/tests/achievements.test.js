// Pure check(ctx) unit tests for the fitness/nutrition achievements added in
// Phase 4 — the original 6 are already exercised indirectly through
// tests/healthScore.test.js; these target the new predicates directly.
const ACHIEVEMENTS = require('../config/achievements');

const byId = (id) => ACHIEVEMENTS.find((a) => a.id === id);

describe('fitness/nutrition achievement predicates', () => {
  test('first_workout unlocks at 1+ total workouts', () => {
    const check = byId('first_workout').check;
    expect(check({ totalWorkouts: 0 })).toBe(false);
    expect(check({ totalWorkouts: 1 })).toBe(true);
  });

  test('workout_streak_7 requires a 7+ day streak', () => {
    const check = byId('workout_streak_7').check;
    expect(check({ workoutStreak: 6 })).toBe(false);
    expect(check({ workoutStreak: 7 })).toBe(true);
    expect(check({ workoutStreak: 10 })).toBe(true);
  });

  test('nutrition_logging_streak_7 requires a 7+ day logging streak', () => {
    const check = byId('nutrition_logging_streak_7').check;
    expect(check({ loggingStreak: 6 })).toBe(false);
    expect(check({ loggingStreak: 7 })).toBe(true);
  });

  test('hydration_streak_7 requires a 7+ day hydration streak', () => {
    const check = byId('hydration_streak_7').check;
    expect(check({ hydrationStreak: 6 })).toBe(false);
    expect(check({ hydrationStreak: 7 })).toBe(true);
  });

  test('protein_goal_hit requires the exact boolean flag', () => {
    const check = byId('protein_goal_hit').check;
    expect(check({ proteinGoalHitToday: false })).toBe(false);
    expect(check({ proteinGoalHitToday: undefined })).toBe(false);
    expect(check({ proteinGoalHitToday: true })).toBe(true);
  });
});

describe('achievement catalog shape', () => {
  test('every entry has the required fields and a unique id', () => {
    const ids = new Set();
    ACHIEVEMENTS.forEach((a) => {
      expect(typeof a.id).toBe('string');
      expect(typeof a.title).toBe('string');
      expect(typeof a.description).toBe('string');
      expect(typeof a.icon).toBe('string');
      expect(typeof a.check).toBe('function');
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
    });
  });
});

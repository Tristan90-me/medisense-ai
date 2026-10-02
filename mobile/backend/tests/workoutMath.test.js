const { MET_BY_TYPE, caloriesForWorkout, paceMinPerKm } = require('../utils/workoutMath');

describe('caloriesForWorkout', () => {
  test('uses the MET value for the given type', () => {
    // estimateBurn = MET * weightKg * (minutes/60)
    expect(caloriesForWorkout('strength', 60, 80)).toBe(Math.round(MET_BY_TYPE.strength * 80));
    expect(caloriesForWorkout('cardio', 30, 70)).toBe(Math.round(MET_BY_TYPE.cardio * 70 * 0.5));
    expect(caloriesForWorkout('flexibility', 45, 60)).toBe(Math.round(MET_BY_TYPE.flexibility * 60 * 0.75));
  });

  test('falls back to the "other" MET for an unrecognized type', () => {
    expect(caloriesForWorkout('unknown', 60, 80)).toBe(Math.round(MET_BY_TYPE.other * 80));
  });

  test('returns 0 when weight is unknown', () => {
    expect(caloriesForWorkout('strength', 60, null)).toBe(0);
    expect(caloriesForWorkout('strength', 60, undefined)).toBe(0);
  });
});

describe('paceMinPerKm', () => {
  test('computes minutes per km', () => {
    expect(paceMinPerKm(5, 25)).toBe(5); // 5km in 25min -> 5 min/km
    expect(paceMinPerKm(10, 50)).toBe(5);
  });

  test('returns null for zero/negative/missing inputs', () => {
    expect(paceMinPerKm(0, 30)).toBeNull();
    expect(paceMinPerKm(5, 0)).toBeNull();
    expect(paceMinPerKm(-5, 30)).toBeNull();
    expect(paceMinPerKm(undefined, 30)).toBeNull();
  });
});

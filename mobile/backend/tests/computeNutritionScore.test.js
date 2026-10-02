const { computeNutritionScore } = require('../utils/computeNutritionScore');

describe('computeNutritionScore', () => {
  test('returns null with a reason when no calorie goal is set', () => {
    const result = computeNutritionScore({ consumed: { calories: 2000 } });
    expect(result.score).toBeNull();
    expect(result.breakdown).toBeNull();
    expect(result.reason).toMatch(/no calorie goal/i);
  });

  test('full marks when consumed exactly matches every target', () => {
    const result = computeNutritionScore({
      consumed: {
        calories: 2000, carbsG: 250, proteinG: 100, fatG: 67,
      },
      calorieTarget: 2000,
      macroTargets: {
        carbsG: 250, proteinG: 100, fatG: 67,
      },
      waterMl: 2000,
      waterGoalMl: 2000,
      mealsLoggedCount: 3,
    });
    expect(result.score).toBe(100);
    expect(result.breakdown).toEqual({
      calorieAdherenceScore: 40, macroBalanceScore: 30, waterScore: 15, loggingCompletenessScore: 15,
    });
  });

  test('calorie adherence degrades linearly and hits 0 at 50%+ deviation', () => {
    const at25pctOver = computeNutritionScore({ consumed: { calories: 2500 }, calorieTarget: 2000 });
    const at50pctOver = computeNutritionScore({ consumed: { calories: 3000 }, calorieTarget: 2000 });
    const wayOver = computeNutritionScore({ consumed: { calories: 5000 }, calorieTarget: 2000 });
    expect(at25pctOver.breakdown.calorieAdherenceScore).toBe(20); // 40 * (1 - 0.25/0.5)
    expect(at50pctOver.breakdown.calorieAdherenceScore).toBe(0);
    expect(wayOver.breakdown.calorieAdherenceScore).toBe(0); // clamped, not negative
  });

  test('under-eating is penalized the same as over-eating', () => {
    const over = computeNutritionScore({ consumed: { calories: 2400 }, calorieTarget: 2000 }); // +20%
    const under = computeNutritionScore({ consumed: { calories: 1600 }, calorieTarget: 2000 }); // -20%
    expect(over.breakdown.calorieAdherenceScore).toBe(under.breakdown.calorieAdherenceScore);
  });

  test('macro score only credits macros that have a target set', () => {
    const result = computeNutritionScore({
      consumed: { calories: 2000, proteinG: 100 },
      calorieTarget: 2000,
      macroTargets: { proteinG: 100 }, // carbsG/fatG targets absent
      mealsLoggedCount: 0,
    });
    expect(result.breakdown.macroBalanceScore).toBe(10); // only protein's 10 points earned
  });

  test('water score is proportional and caps at the goal', () => {
    const half = computeNutritionScore({ consumed: { calories: 2000 }, calorieTarget: 2000, waterMl: 1000, waterGoalMl: 2000 });
    const exceeded = computeNutritionScore({ consumed: { calories: 2000 }, calorieTarget: 2000, waterMl: 4000, waterGoalMl: 2000 });
    expect(half.breakdown.waterScore).toBe(8); // round(15 * 0.5)
    expect(exceeded.breakdown.waterScore).toBe(15); // capped, not 30
  });

  test('logging completeness is 5 points per meal, capped at 15', () => {
    const one = computeNutritionScore({ consumed: { calories: 2000 }, calorieTarget: 2000, mealsLoggedCount: 1 });
    const five = computeNutritionScore({ consumed: { calories: 2000 }, calorieTarget: 2000, mealsLoggedCount: 5 });
    expect(one.breakdown.loggingCompletenessScore).toBe(5);
    expect(five.breakdown.loggingCompletenessScore).toBe(15);
  });
});

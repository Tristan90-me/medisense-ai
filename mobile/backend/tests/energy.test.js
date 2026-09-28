// Unit tests for utils/energy.js and utils/dailyEnergyLedger.js. Pure
// functions, so no DB or app needed. Expected values are worked by hand from
// the Mifflin-St Jeor / MET formulas, not copied from the implementation.
const energy = require('../utils/energy');
const { buildLedger } = require('../utils/dailyEnergyLedger');

describe('unit conversion', () => {
  test('toKg converts lbs and rejects bad input', () => {
    expect(energy.toKg(70, 'kg')).toBe(70);
    expect(energy.toKg(154.324, 'lbs')).toBeCloseTo(70, 1);
    expect(energy.toKg(0)).toBeNull();
    expect(energy.toKg(undefined)).toBeNull();
    expect(energy.toKg('80')).toBeNull();
  });

  test('toCm treats ft as decimal feet', () => {
    expect(energy.toCm(180, 'cm')).toBe(180);
    expect(energy.toCm(6, 'ft')).toBeCloseTo(182.88, 2);
    expect(energy.toCm(-1)).toBeNull();
  });

  test('ageFromDob accounts for whether the birthday has happened', () => {
    const dob = '1990-06-15T00:00:00.000Z';
    expect(energy.ageFromDob(dob, new Date('2026-06-14T12:00:00.000Z'))).toBe(35);
    expect(energy.ageFromDob(dob, new Date('2026-06-15T12:00:00.000Z'))).toBe(36);
    expect(energy.ageFromDob(null)).toBeNull();
    expect(energy.ageFromDob('not a date')).toBeNull();
    expect(energy.ageFromDob('2999-01-01', new Date('2026-01-01'))).toBeNull();
  });
});

describe('BMR / TDEE', () => {
  test('Mifflin-St Jeor for a 30y 80kg 180cm male is 1780', () => {
    expect(energy.calcBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });

  test('Mifflin-St Jeor for a 25y 60kg 165cm female is 1345', () => {
    expect(energy.calcBMR({ sex: 'female', weightKg: 60, heightCm: 165, age: 25 })).toBe(1345);
  });

  test('other / unspecified sex uses the midpoint constant (-78)', () => {
    const input = { weightKg: 80, heightCm: 180, age: 30 };
    expect(energy.calcBMR({ ...input, sex: 'other' })).toBe(1697);
    expect(energy.calcBMR({ ...input, sex: 'prefer_not_to_say' })).toBe(1697);
  });

  test('BMR is null when an input is missing', () => {
    expect(energy.calcBMR({ sex: 'male', weightKg: null, heightCm: 180, age: 30 })).toBeNull();
    expect(energy.calcBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: null })).toBeNull();
  });

  test('TDEE applies the activity factor', () => {
    expect(energy.calcTDEE(1780, 'sedentary')).toBe(2136);
    expect(energy.calcTDEE(1780, 'moderate')).toBe(2759);
    expect(energy.calcTDEE(1780, 'very_active')).toBe(3382);
    expect(energy.calcTDEE(1780, 'unknown')).toBeNull();
    expect(energy.calcTDEE(null, 'moderate')).toBeNull();
  });
});

describe('burn estimates', () => {
  test('estimateBurn uses MET x kg x hours', () => {
    expect(energy.estimateBurn(8, 70, 30)).toBe(280);
    expect(energy.estimateBurn(0, 70, 30)).toBe(0);
    expect(energy.estimateBurn(8, 70, -5)).toBe(0);
  });

  test('stepsToCalories and stepsToDistanceKm', () => {
    expect(energy.stepsToCalories(10000, 70)).toBe(399);
    expect(energy.stepsToCalories(0, 70)).toBe(0);
    expect(energy.stepsToDistanceKm(10000, 175)).toBe(7.26);
    expect(energy.stepsToDistanceKm(10000, null)).toBe(0);
  });

  test('calcBMI rounds to one decimal', () => {
    expect(energy.calcBMI(70, 175)).toBe(22.9);
    expect(energy.calcBMI(0, 175)).toBeNull();
  });
});

describe('calorieGoal', () => {
  test('applies the goal adjustment', () => {
    expect(energy.calorieGoal(2759, 'lose', 'male')).toEqual({ target: 2259, floorApplied: false });
    expect(energy.calorieGoal(2000, 'maintain', 'male')).toEqual({ target: 2000, floorApplied: false });
    expect(energy.calorieGoal(2000, 'gain', 'male')).toEqual({ target: 2300, floorApplied: false });
  });

  test('clamps to a safety floor and says so', () => {
    expect(energy.calorieGoal(1500, 'lose', 'female')).toEqual({ target: 1200, floorApplied: true });
    expect(energy.calorieGoal(1800, 'lose', 'male')).toEqual({ target: 1500, floorApplied: true });
    expect(energy.calorieGoal(1700, 'lose', undefined)).toEqual({ target: 1350, floorApplied: true });
  });

  test('returns no target when TDEE is unknown', () => {
    expect(energy.calorieGoal(null, 'lose', 'male')).toEqual({ target: null, floorApplied: false });
  });
});

describe('macros', () => {
  test('every diet preset sums to 100%', () => {
    Object.entries(energy.DIET_PRESETS).forEach(([name, s]) => {
      expect([name, s.carbsPct + s.proteinPct + s.fatPct]).toEqual([name, 100]);
    });
  });

  test('macroTargets converts percentages to grams (4/4/9 kcal per g)', () => {
    expect(energy.macroTargets(2000, energy.DIET_PRESETS.balanced)).toEqual({
      carbsG: 250, proteinG: 100, fatG: 67,
    });
    expect(energy.macroTargets(null, energy.DIET_PRESETS.balanced)).toBeNull();
  });
});

describe('energyFromProfile', () => {
  const now = new Date('2026-01-01T12:00:00.000Z');

  test('derives everything from a complete profile', () => {
    const e = energy.energyFromProfile({
      sex: 'male',
      dateOfBirth: '1996-01-01T00:00:00.000Z',
      weight: 80,
      weightUnit: 'kg',
      height: 180,
      heightUnit: 'cm',
      activityLevel: 'moderate',
    }, now);
    expect(e).toMatchObject({
      age: 30, bmr: 1780, tdee: 2759, sedentaryTdee: 2136, bmi: 24.7, missing: [],
    });
  });

  test('reports every missing input for an empty profile', () => {
    const e = energy.energyFromProfile(null, now);
    expect(e.bmr).toBeNull();
    expect(e.tdee).toBeNull();
    expect(e.missing.sort()).toEqual(['activityLevel', 'dateOfBirth', 'height', 'sex', 'weight']);
  });

  test('sedentary baseline is still available when only activityLevel is missing', () => {
    const e = energy.energyFromProfile({
      sex: 'female', dateOfBirth: '2001-01-01T00:00:00.000Z', weight: 60, height: 165,
    }, now);
    expect(e.missing).toEqual(['activityLevel']);
    expect(e.tdee).toBeNull();
    expect(e.sedentaryTdee).not.toBeNull();
  });
});

describe('buildLedger', () => {
  test('static budget: exercise is tracked but not added back', () => {
    const l = buildLedger({
      goalCalories: 2000, consumed: 1500, burnedFromSteps: 200, burnedFromWorkouts: 300,
    });
    expect(l).toMatchObject({
      goal: 2000, consumed: 1500, burnedTotal: 500, net: 1000, budget: 2000, remaining: 500, over: false,
    });
  });

  test('add-back budget grows by what was burned', () => {
    const l = buildLedger({
      goalCalories: 2000, consumed: 1500, burnedFromSteps: 200, burnedFromWorkouts: 300, addBackExercise: true,
    });
    expect(l).toMatchObject({ budget: 2500, remaining: 1000, over: false });
  });

  test('flags going over budget with a negative remaining', () => {
    const l = buildLedger({ goalCalories: 2000, consumed: 2200 });
    expect(l).toMatchObject({ remaining: -200, over: true });
  });

  test('without a goal there is no budget, but net is still reported', () => {
    const l = buildLedger({ consumed: 1800, burnedFromWorkouts: 400 });
    expect(l).toMatchObject({ goal: null, budget: null, remaining: null, over: false, net: 1400 });
  });
});

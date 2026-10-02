const {
  NUTRITION_FIELDS, nutritionSchemaFields, scaleNutrition, sumNutrition, perServing, scaleByFactor,
} = require('../utils/nutritionMath');

const per100g = {
  calories: 200, carbsG: 20, proteinG: 10, fatG: 5, fiberG: 2, sugarG: 1,
  sodiumMg: 100, potassiumMg: 50, calciumMg: 20, ironMg: 1, vitaminCMg: 5, vitaminAMcg: 10,
};

describe('nutritionSchemaFields', () => {
  test('produces a mongoose field definition for every NUTRITION_FIELDS entry', () => {
    const fields = nutritionSchemaFields();
    expect(Object.keys(fields).sort()).toEqual([...NUTRITION_FIELDS].sort());
    NUTRITION_FIELDS.forEach((f) => {
      expect(fields[f]).toMatchObject({ type: Number, min: 0, default: 0 });
    });
  });
});

describe('scaleNutrition', () => {
  test('scales every field by grams/100', () => {
    expect(scaleNutrition(per100g, 150)).toEqual({
      calories: 300, carbsG: 30, proteinG: 15, fatG: 7.5, fiberG: 3, sugarG: 1.5,
      sodiumMg: 150, potassiumMg: 75, calciumMg: 30, ironMg: 1.5, vitaminCMg: 7.5, vitaminAMcg: 15,
    });
  });

  test('100g is a no-op scale', () => {
    expect(scaleNutrition(per100g, 100)).toEqual(per100g);
  });

  test('zero, negative, or missing grams yields all zeros', () => {
    const zeros = Object.fromEntries(NUTRITION_FIELDS.map((f) => [f, 0]));
    expect(scaleNutrition(per100g, 0)).toEqual(zeros);
    expect(scaleNutrition(per100g, -50)).toEqual(zeros);
    expect(scaleNutrition(per100g, undefined)).toEqual(zeros);
  });

  test('missing per100g fields default to 0 rather than throwing', () => {
    expect(scaleNutrition({ calories: 100 }, 200)).toMatchObject({ calories: 200, carbsG: 0, proteinG: 0 });
    expect(scaleNutrition(null, 200)).toMatchObject({ calories: 0 });
  });
});

describe('sumNutrition', () => {
  test('sums each field across a list of scaled nutrition objects', () => {
    const a = scaleNutrition(per100g, 100);
    const b = scaleNutrition(per100g, 50);
    expect(sumNutrition([a, b])).toEqual({
      calories: 300, carbsG: 30, proteinG: 15, fatG: 7.5, fiberG: 3, sugarG: 1.5,
      sodiumMg: 150, potassiumMg: 75, calciumMg: 30, ironMg: 1.5, vitaminCMg: 7.5, vitaminAMcg: 15,
    });
  });

  test('an empty list sums to all zeros', () => {
    const zeros = Object.fromEntries(NUTRITION_FIELDS.map((f) => [f, 0]));
    expect(sumNutrition([])).toEqual(zeros);
  });

  test('tolerates a null/undefined entry in the list', () => {
    const a = scaleNutrition(per100g, 100);
    expect(sumNutrition([a, null, undefined])).toEqual(a);
  });
});

describe('perServing', () => {
  test('divides the total by the serving count', () => {
    const total = scaleNutrition(per100g, 400); // 4x per100g
    expect(perServing(total, 4)).toEqual(per100g);
  });

  test('returns the total unchanged when servings is 0 or missing', () => {
    const total = scaleNutrition(per100g, 400);
    expect(perServing(total, 0)).toEqual(total);
    expect(perServing(total, undefined)).toEqual(total);
  });
});

describe('scaleByFactor', () => {
  test('scales an already-computed nutrition object by an arbitrary factor', () => {
    expect(scaleByFactor(per100g, 2.5)).toEqual({
      calories: 500, carbsG: 50, proteinG: 25, fatG: 12.5, fiberG: 5, sugarG: 2.5,
      sodiumMg: 250, potassiumMg: 125, calciumMg: 50, ironMg: 2.5, vitaminCMg: 12.5, vitaminAMcg: 25,
    });
  });

  test('a negative or non-numeric factor yields all zeros', () => {
    const zeros = Object.fromEntries(NUTRITION_FIELDS.map((f) => [f, 0]));
    expect(scaleByFactor(per100g, -1)).toEqual(zeros);
    expect(scaleByFactor(per100g, 'two')).toEqual(zeros);
    expect(scaleByFactor(null, 2)).toEqual(zeros);
  });
});

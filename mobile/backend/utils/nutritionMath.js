// Shared nutrition field shape + scaling math, used by FoodItem/CustomFood
// (stored per 100g) and MealLog (a snapshot at whatever portion was logged).
// Kept separate from utils/energy.js: energy.js is about a person's own
// BMR/TDEE/burn, this is about a food's nutrient content.

const NUTRITION_FIELDS = [
  'calories', 'carbsG', 'proteinG', 'fatG', 'fiberG', 'sugarG',
  'sodiumMg', 'potassiumMg', 'calciumMg', 'ironMg', 'vitaminCMg', 'vitaminAMcg',
];

// A mongoose schema-fragment for a nutrition sub-document, so FoodItem,
// CustomFood, and MealLog all define this the same way instead of three
// hand-copied field lists drifting apart.
function nutritionSchemaFields() {
  return Object.fromEntries(NUTRITION_FIELDS.map((f) => [f, { type: Number, min: 0, default: 0 }]));
}

// `per100g` scaled to an arbitrary gram weight, e.g. a 150g serving of a food
// whose label nutrition is given per 100g.
function scaleNutrition(per100g, grams) {
  const factor = (typeof grams === 'number' && grams > 0) ? grams / 100 : 0;
  return Object.fromEntries(
    NUTRITION_FIELDS.map((f) => [f, Math.round(((per100g && per100g[f]) || 0) * factor * 10) / 10]),
  );
}

// Sums a list of already-scaled nutrition objects (e.g. one recipe's
// ingredients, each already scaled to its own gram amount).
function sumNutrition(items) {
  const total = Object.fromEntries(NUTRITION_FIELDS.map((f) => [f, 0]));
  for (const item of items) {
    for (const f of NUTRITION_FIELDS) total[f] += (item && item[f]) || 0;
  }
  for (const f of NUTRITION_FIELDS) total[f] = Math.round(total[f] * 10) / 10;
  return total;
}

// Divides a total by a serving count, e.g. a recipe's total ingredient
// nutrition divided into however many servings it yields.
function perServing(total, servings) {
  if (!(servings > 0)) return total;
  return Object.fromEntries(
    NUTRITION_FIELDS.map((f) => [f, Math.round(((total[f] || 0) / servings) * 10) / 10]),
  );
}

// Scales an already-computed nutrition object (e.g. a recipe's per-serving
// values) by an arbitrary factor, such as "2.5 servings of this recipe."
function scaleByFactor(nutrition, factor) {
  const f = typeof factor === 'number' && factor >= 0 ? factor : 0;
  return Object.fromEntries(NUTRITION_FIELDS.map((k) => [k, Math.round(((nutrition && nutrition[k]) || 0) * f * 10) / 10]));
}

module.exports = {
  NUTRITION_FIELDS, nutritionSchemaFields, scaleNutrition, sumNutrition, perServing, scaleByFactor,
};

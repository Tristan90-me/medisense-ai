const mongoose = require('mongoose');

// Ingredient nutrition is computed on read from the referenced FoodItem/
// CustomFood (see utils/nutritionMath.js), not stored here — so editing a
// FoodItem's numbers (e.g. a correction) is reflected in every recipe that
// uses it, rather than going stale. `label` is a display-time snapshot only
// (so the ingredient list still reads sensibly if the food is later renamed).
const RecipeIngredientSchema = new mongoose.Schema({
  foodKind: { type: String, enum: ['FoodItem', 'CustomFood'], required: true },
  // refPath resolves against the sibling `foodKind` field on this same
  // subdocument.
  food: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'foodKind' },
  grams: { type: Number, required: true, min: 0 },
  label: { type: String, trim: true },
}, { _id: false });

// Owned by the account (not per-dependent) — a recipe is a reusable
// household cookbook entry, not tied to one person's meal history the way a
// MealLog is.
const RecipeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  servings: { type: Number, required: true, min: 1, default: 1 },
  ingredients: { type: [RecipeIngredientSchema], validate: (v) => v.length > 0 },
}, { timestamps: true });

RecipeSchema.index({ user: 1, name: 'text' });

module.exports = mongoose.model('Recipe', RecipeSchema);

const mongoose = require('mongoose');
const { nutritionSchemaFields } = require('../utils/nutritionMath');

// One document per logged food/recipe/quick-add — flat rather than nested
// entries inside a "meal" document, mirroring Medication/PhotoLog's style.
// This keeps single-item edit/delete and aggregations (day totals,
// most-eaten) simple queries instead of array manipulation.
//
// `nutrition` is a snapshot taken at log time (see utils/nutritionMath.js).
// Deliberately NOT recomputed from the live FoodItem/Recipe later, so a
// correction to a food's data (or the food being deleted) never rewrites
// someone's food-diary history.
const MealLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dependent: { type: mongoose.Schema.Types.ObjectId, ref: 'Dependent', default: null },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
  loggedAt: { type: Date, default: Date.now },
  kind: { type: String, enum: ['food', 'recipe', 'quick_add'], required: true },
  // 'food' only:
  foodKind: { type: String, enum: ['FoodItem', 'CustomFood'] },
  food: { type: mongoose.Schema.Types.ObjectId, refPath: 'foodKind' },
  // 'recipe' only:
  recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
  servingsOfRecipe: { type: Number, min: 0 },
  // Display fields, snapshotted at log time so history reads fine even if
  // the underlying food/recipe is later renamed or deleted.
  name: { type: String, required: true, trim: true, maxlength: 200 },
  servingLabel: { type: String, trim: true, maxlength: 100 },
  grams: { type: Number, min: 0 },
  nutrition: nutritionSchemaFields(),
  isFavourite: { type: Boolean, default: false },
}, { timestamps: true });

MealLogSchema.index({ user: 1, dependent: 1, loggedAt: -1 });

module.exports = mongoose.model('MealLog', MealLogSchema);

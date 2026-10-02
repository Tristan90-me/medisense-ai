const mongoose = require('mongoose');
const { nutritionSchemaFields } = require('../utils/nutritionMath');

// A shared cache of foods pulled from external lookups (Open Food Facts,
// USDA FoodData Central) — not user-owned. First lookup fetches + upserts
// here; every later search/barcode scan for the same item hits this
// collection instead of the external API. See utils/foodApi.js.
const FoodItemSchema = new mongoose.Schema({
  source: { type: String, enum: ['openfoodfacts', 'usda'], required: true },
  // Sparse + partial-unique below: only one of these is set depending on
  // source, and most documents will have the other be undefined.
  barcode: { type: String, trim: true },
  externalId: { type: String, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  brand: { type: String, trim: true, maxlength: 200 },
  // Nutrition normalized to "per 100g" regardless of source, so any logged
  // portion (grams) can be scaled the same way — see utils/nutritionMath.js.
  per100g: nutritionSchemaFields(),
  // Human-friendly portions as given by the source (e.g. "1 slice", "1 cup"),
  // each pre-resolved to a gram weight so logging doesn't need a unit
  // converter — supports the "log by cups/pieces/servings" requirement.
  servingOptions: [{
    label: { type: String, required: true, trim: true },
    grams: { type: Number, required: true, min: 0 },
  }],
  lastFetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

FoodItemSchema.index({ source: 1, barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } });
FoodItemSchema.index({ source: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } });
FoodItemSchema.index({ name: 'text', brand: 'text' });

module.exports = mongoose.model('FoodItem', FoodItemSchema);

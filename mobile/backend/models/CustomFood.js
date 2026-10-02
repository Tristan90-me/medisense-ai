const mongoose = require('mongoose');
const { nutritionSchemaFields } = require('../utils/nutritionMath');

// A food a user typed in by hand because it wasn't found in Open Food
// Facts/USDA — same nutrition shape as FoodItem, but owned by one user
// (never shared across accounts) since nobody has verified the numbers.
const CustomFoodSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  brand: { type: String, trim: true, maxlength: 200 },
  per100g: nutritionSchemaFields(),
  servingOptions: [{
    label: { type: String, required: true, trim: true },
    grams: { type: Number, required: true, min: 0 },
  }],
}, { timestamps: true });

CustomFoodSchema.index({ user: 1, name: 'text' });

module.exports = mongoose.model('CustomFood', CustomFoodSchema);

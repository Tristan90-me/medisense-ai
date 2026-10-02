const Recipe = require('../models/Recipe');
const FoodItem = require('../models/FoodItem');
const CustomFood = require('../models/CustomFood');
const { scaleNutrition, sumNutrition, perServing } = require('../utils/nutritionMath');

// Resolves each ingredient's food doc (CustomFood lookups are ownership-
// scoped — a recipe can never read someone else's private custom food) and
// returns { total, perServing }. Computed fresh every time rather than
// stored on the Recipe, so editing a FoodItem's numbers is reflected
// immediately in every recipe that uses it — see models/Recipe.js.
async function computeNutrition(recipe, userId) {
  const scaled = await Promise.all(recipe.ingredients.map(async (ing) => {
    const doc = ing.foodKind === 'CustomFood'
      ? await CustomFood.findOne({ _id: ing.food, user: userId })
      : await FoodItem.findById(ing.food);
    if (!doc) {
      const err = new Error(`Ingredient food not found: ${ing.food}`);
      err.statusCode = 400;
      throw err;
    }
    return scaleNutrition(doc.per100g, ing.grams);
  }));
  const total = sumNutrition(scaled);
  return { total, perServing: perServing(total, recipe.servings) };
}

// Exported so mealController can price a logged "N servings of recipe X"
// without re-implementing ingredient resolution.
exports.computeNutrition = computeNutrition;

exports.listRecipes = async (req, res) => {
  try {
    const recipes = await Recipe.find({ user: req.user._id }).sort({ createdAt: -1 });
    const withNutrition = await Promise.all(recipes.map(async (r) => ({
      ...r.toObject(), nutrition: await computeNutrition(r, req.user._id),
    })));
    res.json({ success: true, recipes: withNutrition });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.getRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, user: req.user._id });
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
    const nutrition = await computeNutrition(recipe, req.user._id);
    res.json({ success: true, recipe: { ...recipe.toObject(), nutrition } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.createRecipe = async (req, res) => {
  try {
    const { name, servings, ingredients } = req.body;
    // Validated BEFORE persisting — an ingredient pointing at a missing or
    // not-owned food must not leave a broken recipe saved anyway.
    const nutrition = await computeNutrition({ ingredients, servings: servings || 1 }, req.user._id);
    const recipe = await Recipe.create({
      user: req.user._id, name, servings, ingredients,
    });
    res.status(201).json({ success: true, recipe: { ...recipe.toObject(), nutrition } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.updateRecipe = async (req, res) => {
  try {
    const { name, servings, ingredients } = req.body;
    const existing = await Recipe.findOne({ _id: req.params.id, user: req.user._id });
    if (!existing) return res.status(404).json({ success: false, message: 'Recipe not found' });

    // Same validate-before-persist reasoning as createRecipe — compute
    // against the merged (not-yet-saved) shape first.
    const nutrition = await computeNutrition({
      ingredients: ingredients !== undefined ? ingredients : existing.ingredients,
      servings: servings !== undefined ? servings : existing.servings,
    }, req.user._id);

    if (name !== undefined) existing.name = name;
    if (servings !== undefined) existing.servings = servings;
    if (ingredients !== undefined) existing.ingredients = ingredients;
    await existing.save();

    res.json({ success: true, recipe: { ...existing.toObject(), nutrition } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true, message: 'Recipe removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

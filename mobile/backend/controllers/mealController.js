const MealLog = require('../models/MealLog');
const FoodItem = require('../models/FoodItem');
const CustomFood = require('../models/CustomFood');
const Recipe = require('../models/Recipe');
const { resolveDependentId } = require('../utils/resolveDependent');
const { parseDayRange } = require('../utils/dayRange');
const { scaleNutrition, sumNutrition, scaleByFactor } = require('../utils/nutritionMath');
const { computeNutrition: computeRecipeNutrition } = require('./recipeController');

async function resolveFoodDoc(foodKind, foodId, userId) {
  return foodKind === 'CustomFood'
    ? CustomFood.findOne({ _id: foodId, user: userId })
    : FoodItem.findById(foodId);
}

// POST /api/meals — one of three shapes depending on `kind`:
//   food:      { foodKind, food, grams, servingLabel }
//   recipe:    { recipe, servingsOfRecipe }
//   quick_add: { name, quickAdd: { calories, carbsG, proteinG, fatG } }
// Nutrition is resolved once here and stored as a snapshot on the MealLog
// (see models/MealLog.js) — never recomputed from the live food/recipe later.
exports.logMeal = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const {
      mealType, kind, loggedAt,
    } = req.body;
    const base = {
      user: req.user._id, dependent, mealType, kind, ...(loggedAt ? { loggedAt } : {}),
    };

    if (kind === 'food') {
      const {
        foodKind, food: foodId, grams, servingLabel,
      } = req.body;
      const doc = await resolveFoodDoc(foodKind, foodId, req.user._id);
      if (!doc) return res.status(404).json({ success: false, message: 'Food not found' });
      const meal = await MealLog.create({
        ...base,
        foodKind,
        food: foodId,
        grams,
        servingLabel,
        name: doc.name,
        nutrition: scaleNutrition(doc.per100g, grams),
      });
      return res.status(201).json({ success: true, meal });
    }

    if (kind === 'recipe') {
      const { recipe: recipeId, servingsOfRecipe } = req.body;
      const recipe = await Recipe.findOne({ _id: recipeId, user: req.user._id });
      if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
      const { perServing } = await computeRecipeNutrition(recipe, req.user._id);
      const meal = await MealLog.create({
        ...base,
        recipe: recipeId,
        servingsOfRecipe,
        name: recipe.name,
        servingLabel: `${servingsOfRecipe} serving${servingsOfRecipe === 1 ? '' : 's'}`,
        nutrition: scaleByFactor(perServing, servingsOfRecipe),
      });
      return res.status(201).json({ success: true, meal });
    }

    // quick_add
    const { name, quickAdd } = req.body;
    const meal = await MealLog.create({
      ...base, name, nutrition: { ...quickAdd },
    });
    return res.status(201).json({ success: true, meal });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/meals?date=YYYY-MM-DD&dependent=<id> — a day's food diary plus
// its nutrition totals. Defaults to today when `date` is omitted.
exports.listMeals = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const { start, end } = parseDayRange(req.query.date);
    const meals = await MealLog.find({
      user: req.user._id, dependent, loggedAt: { $gte: start, $lt: end },
    }).sort({ loggedAt: 1 });
    res.json({
      success: true,
      date: start.toISOString().slice(0, 10),
      meals,
      totals: sumNutrition(meals.map((m) => m.nutrition)),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/meals/favourites?dependent=<id>
exports.getFavourites = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const meals = await MealLog.find({ user: req.user._id, dependent, isFavourite: true }).sort({ loggedAt: -1 });
    res.json({ success: true, meals });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/meals/most-eaten?dependent=<id> — grouped by (case-insensitive)
// logged name across every kind, most frequent first. A simple frequency
// count rather than a food/recipe id join, so a quick-add someone repeats
// daily ("Coffee") shows up here too.
exports.getMostEaten = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const mostEaten = await MealLog.aggregate([
      { $match: { user: req.user._id, dependent } },
      {
        $group: {
          _id: { $toLower: '$name' },
          name: { $first: '$name' },
          count: { $sum: 1 },
          lastLoggedAt: { $max: '$loggedAt' },
        },
      },
      { $sort: { count: -1, lastLoggedAt: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, name: 1, count: 1, lastLoggedAt: 1 } },
    ]);
    res.json({ success: true, mostEaten });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// PUT /api/meals/:id — mealType and isFavourite are always editable; grams
// is only editable for a `food` entry (recomputes the nutrition snapshot).
// Changing which food/recipe an entry points to isn't supported — delete and
// re-log instead, so nutrition history never silently drifts.
exports.updateMeal = async (req, res) => {
  try {
    const meal = await MealLog.findOne({ _id: req.params.id, user: req.user._id });
    if (!meal) return res.status(404).json({ success: false, message: 'Meal log entry not found' });

    if (req.body.mealType !== undefined) meal.mealType = req.body.mealType;
    if (req.body.isFavourite !== undefined) meal.isFavourite = req.body.isFavourite;

    if (req.body.grams !== undefined) {
      if (meal.kind !== 'food') {
        return res.status(400).json({ success: false, message: 'grams can only be changed on a food entry' });
      }
      const doc = await resolveFoodDoc(meal.foodKind, meal.food, req.user._id);
      if (!doc) return res.status(400).json({ success: false, message: 'The underlying food no longer exists' });
      meal.grams = req.body.grams;
      meal.nutrition = scaleNutrition(doc.per100g, req.body.grams);
    }

    await meal.save();
    res.json({ success: true, meal });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.deleteMeal = async (req, res) => {
  try {
    const meal = await MealLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!meal) return res.status(404).json({ success: false, message: 'Meal log entry not found' });
    res.json({ success: true, message: 'Meal log entry removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

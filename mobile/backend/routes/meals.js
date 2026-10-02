const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  logMeal, listMeals, getFavourites, getMostEaten, updateMeal, deleteMeal,
} = require('../controllers/mealController');
const {
  logMealRules, listMealsQueryRules, dependentQueryRules, updateMealRules, mealIdParamRules,
} = require('../validators/mealValidators');

/**
 * @swagger
 * /meals/favourites:
 *   get:
 *     tags: [Meals]
 *     summary: List meal log entries flagged as a favourite
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of favourited meal log entries, most recent first }
 */
router.get('/favourites', protect, validate(dependentQueryRules), getFavourites);

/**
 * @swagger
 * /meals/most-eaten:
 *   get:
 *     tags: [Meals]
 *     summary: Top 10 most frequently logged items, by name
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: 'Array of { name, count, lastLoggedAt }, most frequent first' }
 */
router.get('/most-eaten', protect, validate(dependentQueryRules), getMostEaten);

/**
 * @swagger
 * /meals:
 *   get:
 *     tags: [Meals]
 *     summary: A day's food diary
 *     description: Defaults to today (UTC) when `date` is omitted.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-01-15' }
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: 'That day''s meal log entries plus summed nutrition totals' }
 */
router.get('/', protect, validate(listMealsQueryRules), listMeals);

/**
 * @swagger
 * /meals:
 *   post:
 *     tags: [Meals]
 *     summary: Log a food, a recipe, or a quick-add
 *     description: >
 *       Nutrition is resolved once at log time and stored as a snapshot —
 *       later edits to the underlying food/recipe never rewrite history.
 *       Shape depends on `kind`: 'food' needs foodKind/food/grams, 'recipe'
 *       needs recipe/servingsOfRecipe, 'quick_add' needs name/quickAdd.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mealType, kind]
 *             properties:
 *               dependent: { type: string }
 *               mealType: { type: string, enum: [breakfast, lunch, dinner, snack] }
 *               kind: { type: string, enum: [food, recipe, quick_add] }
 *               loggedAt: { type: string, format: date-time }
 *               foodKind: { type: string, enum: [FoodItem, CustomFood] }
 *               food: { type: string }
 *               grams: { type: number }
 *               servingLabel: { type: string }
 *               recipe: { type: string }
 *               servingsOfRecipe: { type: number }
 *               name: { type: string }
 *               quickAdd: { type: object, properties: { calories: { type: number }, carbsG: { type: number }, proteinG: { type: number }, fatG: { type: number } } }
 *     responses:
 *       201: { description: Meal log entry created }
 *       400: { description: Validation error }
 *       404: { description: Referenced food/recipe/dependent not found or not owned by this user }
 */
router.post('/', protect, validate(logMealRules), logMeal);

/**
 * @swagger
 * /meals/{id}:
 *   put:
 *     tags: [Meals]
 *     summary: Update a meal log entry
 *     description: >
 *       mealType and isFavourite are always editable. grams is only editable
 *       on a 'food' entry (recomputes its nutrition snapshot). Changing which
 *       food/recipe an entry points to isn't supported — delete and re-log.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated meal log entry }
 *       400: { description: Validation error, or grams sent for a non-food entry }
 *       404: { description: Meal log entry not found or not owned by this user }
 */
router.put('/:id', protect, validate(updateMealRules), updateMeal);

/**
 * @swagger
 * /meals/{id}:
 *   delete:
 *     tags: [Meals]
 *     summary: Remove a meal log entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Meal log entry removed }
 *       404: { description: Meal log entry not found or not owned by this user }
 */
router.delete('/:id', protect, validate(mealIdParamRules), deleteMeal);

module.exports = router;

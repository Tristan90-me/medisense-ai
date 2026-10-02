const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  listRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe,
} = require('../controllers/recipeController');
const {
  createRecipeRules, updateRecipeRules, recipeIdParamRules,
} = require('../validators/recipeValidators');

/**
 * @swagger
 * /recipes:
 *   get:
 *     tags: [Recipes]
 *     summary: List this user's recipes
 *     description: >
 *       Each recipe includes a `nutrition` field ({ total, perServing })
 *       computed fresh from its current ingredients, not stored.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of recipes with computed nutrition }
 */
router.get('/', protect, listRecipes);

/**
 * @swagger
 * /recipes:
 *   post:
 *     tags: [Recipes]
 *     summary: Create a recipe
 *     description: >
 *       Every ingredient's food must already exist — a FoodItem (shared
 *       cache) or a CustomFood owned by this user. Validated before saving,
 *       so an invalid ingredient never leaves a broken recipe behind.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, ingredients]
 *             properties:
 *               name: { type: string }
 *               servings: { type: number, default: 1 }
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [foodKind, food, grams]
 *                   properties:
 *                     foodKind: { type: string, enum: [FoodItem, CustomFood] }
 *                     food: { type: string }
 *                     grams: { type: number }
 *                     label: { type: string }
 *     responses:
 *       201: { description: Recipe created, with computed nutrition }
 *       400: { description: Validation error, or an ingredient's food doesn't exist / isn't owned by this user }
 */
router.post('/', protect, validate(createRecipeRules), createRecipe);

/**
 * @swagger
 * /recipes/{id}:
 *   get:
 *     tags: [Recipes]
 *     summary: Get one recipe with computed nutrition
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The recipe }
 *       404: { description: Recipe not found or not owned by this user }
 */
router.get('/:id', protect, validate(recipeIdParamRules), getRecipe);

/**
 * @swagger
 * /recipes/{id}:
 *   put:
 *     tags: [Recipes]
 *     summary: Update a recipe
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated recipe, with recomputed nutrition }
 *       400: { description: Validation error, or an ingredient's food doesn't exist / isn't owned by this user }
 *       404: { description: Recipe not found or not owned by this user }
 */
router.put('/:id', protect, validate(updateRecipeRules), updateRecipe);

/**
 * @swagger
 * /recipes/{id}:
 *   delete:
 *     tags: [Recipes]
 *     summary: Remove a recipe
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Recipe removed }
 *       404: { description: Recipe not found or not owned by this user }
 */
router.delete('/:id', protect, validate(recipeIdParamRules), deleteRecipe);

module.exports = router;

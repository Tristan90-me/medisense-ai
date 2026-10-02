const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  search, barcodeSearch, listCustomFoods, createCustomFood, updateCustomFood, deleteCustomFood,
} = require('../controllers/foodController');
const {
  searchFoodsRules, barcodeParamRules, createCustomFoodRules, updateCustomFoodRules, customFoodIdParamRules,
} = require('../validators/foodValidators');

/**
 * @swagger
 * /foods/search:
 *   get:
 *     tags: [Foods]
 *     summary: Search foods by name
 *     description: >
 *       Searches the shared FoodItem cache plus live Open Food Facts and USDA
 *       FoodData Central (USDA skipped if USDA_API_KEY isn't configured),
 *       caching any new results, plus this user's own custom foods.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: 'Matching foods (external + cached) and this user''s custom foods' }
 */
router.get('/search', protect, validate(searchFoodsRules), search);

/**
 * @swagger
 * /foods/barcode/{code}:
 *   get:
 *     tags: [Foods]
 *     summary: Look up a food by barcode (Open Food Facts)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The matched food }
 *       404: { description: No product found for that barcode }
 */
router.get('/barcode/:code', protect, validate(barcodeParamRules), barcodeSearch);

/**
 * @swagger
 * /foods/custom:
 *   get:
 *     tags: [Foods]
 *     summary: List this user's custom foods
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of custom foods }
 */
router.get('/custom', protect, listCustomFoods);

/**
 * @swagger
 * /foods/custom:
 *   post:
 *     tags: [Foods]
 *     summary: Add a custom food (a food not found in the external databases)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               brand: { type: string }
 *               per100g: { type: object, description: 'Nutrition per 100g, e.g. { calories, carbsG, proteinG, fatG, fiberG, sugarG, sodiumMg, potassiumMg, calciumMg, ironMg, vitaminCMg, vitaminAMcg }' }
 *               servingOptions: { type: array, items: { type: object, properties: { label: { type: string }, grams: { type: number } } } }
 *     responses:
 *       201: { description: Custom food created }
 *       400: { description: Validation error }
 */
router.post('/custom', protect, validate(createCustomFoodRules), createCustomFood);

/**
 * @swagger
 * /foods/custom/{id}:
 *   put:
 *     tags: [Foods]
 *     summary: Update a custom food
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated custom food }
 *       404: { description: Custom food not found or not owned by this user }
 */
router.put('/custom/:id', protect, validate(updateCustomFoodRules), updateCustomFood);

/**
 * @swagger
 * /foods/custom/{id}:
 *   delete:
 *     tags: [Foods]
 *     summary: Remove a custom food
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Custom food removed }
 *       404: { description: Custom food not found or not owned by this user }
 */
router.delete('/custom/:id', protect, validate(customFoodIdParamRules), deleteCustomFood);

module.exports = router;

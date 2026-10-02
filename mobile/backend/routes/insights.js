const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');
const validate = require('../middleware/validate');
const { estimateMealPhoto, getSuggestion, getDailyTip } = require('../controllers/insightController');
const { estimateMealPhotoRules, getSuggestionQueryRules } = require('../validators/insightValidators');

/**
 * @swagger
 * /insights/estimate-meal-photo:
 *   post:
 *     tags: [Insights]
 *     summary: Estimate a meal's nutrition from a photo (Gemini)
 *     description: >
 *       Does not create a meal log entry — returns an estimate for the
 *       client to prefill a quick-add form, which the user reviews and
 *       edits before saving via POST /meals.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties:
 *               photo: { type: string, format: binary, description: 'JPEG, PNG, or WEBP, up to 5MB' }
 *               context: { type: string, maxLength: 300, description: 'Optional note, e.g. "with extra rice"' }
 *     responses:
 *       200: { description: 'Estimated { description, identifiedFoods, estimatedNutrition, confidence }' }
 *       400: { description: Missing/invalid file or validation error }
 */
router.post('/estimate-meal-photo', protect, handleUploadErrors(upload.single('photo')), validate(estimateMealPhotoRules), estimateMealPhoto);

/**
 * @swagger
 * /insights/suggestion:
 *   get:
 *     tags: [Insights]
 *     summary: One Gemini suggestion (meal or workout) grounded in today's numbers
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: kind
 *         schema: { type: string, enum: [meal, workout], default: meal }
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: The suggestion text }
 */
router.get('/suggestion', protect, validate(getSuggestionQueryRules), getSuggestion);

/**
 * @swagger
 * /insights/tip:
 *   get:
 *     tags: [Insights]
 *     summary: A rotating daily wellness tip (not personalized)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The tip text }
 */
router.get('/tip', protect, getDailyTip);

module.exports = router;

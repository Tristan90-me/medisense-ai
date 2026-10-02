const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');
const validate = require('../middleware/validate');
const {
  uploadPhoto, getPhotos, getPhotoImage, deletePhoto,
} = require('../controllers/progressPhotoController');
const {
  uploadProgressPhotoRules, photoIdParamRules, listPhotosQueryRules,
} = require('../validators/progressPhotoValidators');

/**
 * @swagger
 * /progress-photos:
 *   post:
 *     tags: [Progress Photos]
 *     summary: Upload a fitness progress photo
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
 *               caption: { type: string, maxLength: 500 }
 *               dependent: { type: string }
 *     responses:
 *       201: { description: Progress photo created (metadata only) }
 *       400: { description: Missing/invalid file or validation error }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.post('/', protect, handleUploadErrors(upload.single('photo')), validate(uploadProgressPhotoRules), uploadPhoto);

/**
 * @swagger
 * /progress-photos:
 *   get:
 *     tags: [Progress Photos]
 *     summary: List progress photos
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of progress photo metadata, most recent first }
 */
router.get('/', protect, validate(listPhotosQueryRules), getPhotos);

/**
 * @swagger
 * /progress-photos/{id}/image:
 *   get:
 *     tags: [Progress Photos]
 *     summary: Get the raw image bytes
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Raw image bytes, content: { 'image/*': {} } }
 *       404: { description: Photo not found or not owned by this user }
 */
router.get('/:id/image', protect, validate(photoIdParamRules), getPhotoImage);

/**
 * @swagger
 * /progress-photos/{id}:
 *   delete:
 *     tags: [Progress Photos]
 *     summary: Remove a progress photo
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Progress photo removed }
 *       404: { description: Photo not found or not owned by this user }
 */
router.delete('/:id', protect, validate(photoIdParamRules), deletePhoto);

module.exports = router;

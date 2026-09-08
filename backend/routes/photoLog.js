const express = require('express');
const router = express.Router();
const {
  uploadPhoto, getPhotos, getPhoto, getPhotoImage, deletePhoto, linkSession,
} = require('../controllers/photoLogController');
const { protect } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');
const validate = require('../middleware/validate');
const {
  uploadPhotoRules, photoIdParamRules, listPhotosQueryRules, linkSessionRules,
} = require('../validators/photoLogValidators');

/**
 * @swagger
 * /photo-log:
 *   post:
 *     tags: [Photo Log]
 *     summary: Upload a symptom photo
 *     description: >
 *       Stores the image in GridFS and (best-effort) runs it through Gemini
 *       for a descriptive, non-diagnostic visual analysis. If analysis fails
 *       (including a temporarily invalid API key), the photo is still saved
 *       without an `aiAnalysis`.
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
 *               caption: { type: string, maxLength: 300 }
 *               bodyRegion: { type: string, maxLength: 60, description: 'Free text — the frontend offers a preset list plus an "Other" option, nothing here is server-enforced.' }
 *               dependent: { type: string, description: Dependent id. Omit for self or for an unsaved "other" subject (use subjectSex instead). }
 *               subjectSex: { type: string, enum: [male, female], description: Only meaningful when dependent is omitted and this isn't a photo of the account owner — a lightweight hint for the AI analysis and photo label, not a saved profile. }
 *               linkedSessionId: { type: string }
 *     responses:
 *       201: { description: Photo log created (metadata only — no image bytes in the response) }
 *       400: { description: Missing/invalid file or validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.post('/', protect, handleUploadErrors(upload.single('photo')), validate(uploadPhotoRules), uploadPhoto);

/**
 * @swagger
 * /photo-log:
 *   get:
 *     tags: [Photo Log]
 *     summary: List photo logs
 *     description: >
 *       With `dependent`, scopes to that one person's photos (ownership-checked).
 *       Without it, returns the union across self and every dependent under
 *       this account. Flagged-for-review photos are never filtered out.
 *       Response rows are metadata only — fetch each photo's bytes from
 *       GET /photo-log/{id}/image.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         required: false
 *         schema: { type: string }
 *         description: Dependent id to scope to. Omit for self + all dependents.
 *     responses:
 *       200: { description: Array of photo log metadata rows }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.get('/', protect, validate(listPhotosQueryRules), getPhotos);

/**
 * @swagger
 * /photo-log/{id}:
 *   get:
 *     tags: [Photo Log]
 *     summary: Get a single photo log's metadata
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Photo log metadata }
 *       404: { description: Photo not found or not owned by this user }
 */
router.get('/:id', protect, validate(photoIdParamRules), getPhoto);

/**
 * @swagger
 * /photo-log/{id}/image:
 *   get:
 *     tags: [Photo Log]
 *     summary: Get the raw image bytes for a photo log
 *     description: >
 *       Returns the raw binary image, Content-Type set from the stored
 *       mimeType. Requires the Authorization header (like every other
 *       endpoint here), so a bare `<img src>` tag cannot load it directly —
 *       fetch it as a blob and use an object URL instead.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Raw image bytes
 *         content: { 'image/*': {} }
 *       404: { description: Photo not found or not owned by this user }
 */
router.get('/:id/image', protect, validate(photoIdParamRules), getPhotoImage);

/**
 * @swagger
 * /photo-log/{id}/link-session:
 *   patch:
 *     tags: [Photo Log]
 *     summary: Link a symptom-check session to this photo
 *     description: >
 *       Records that a Quick Check or Full Assessment was started from this
 *       photo (surfaced on the photo's detail view as "Linked to a
 *       check-in"). The session must already exist and belong to this user.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId: { type: string }
 *     responses:
 *       200: { description: Photo log updated with the linked session }
 *       404: { description: Photo or session not found, or either not owned by this user }
 */
router.patch('/:id/link-session', protect, validate([...photoIdParamRules, ...linkSessionRules]), linkSession);

/**
 * @swagger
 * /photo-log/{id}:
 *   delete:
 *     tags: [Photo Log]
 *     summary: Remove a photo log
 *     description: Also deletes the underlying GridFS file — not just the metadata row.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Photo removed }
 *       404: { description: Photo not found or not owned by this user }
 */
router.delete('/:id', protect, validate(photoIdParamRules), deletePhoto);

module.exports = router;

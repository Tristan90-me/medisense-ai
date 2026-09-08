const express = require('express');
const router = express.Router();
const { searchNearby } = require('../controllers/careFinderController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { searchNearbyRules } = require('../validators/careFinderValidators');

/**
 * @swagger
 * /care-finder/nearby:
 *   get:
 *     tags: [Care Finder]
 *     summary: Find nearby care facilities
 *     description: >
 *       Queries the public OpenStreetMap Overpass API (no key/billing) for
 *       hospitals, clinics, doctors' offices, pharmacies, and dentists near a
 *       given point, normalizes the result, and sorts it by distance. Results
 *       are best-effort against OSM's crowdsourced data — some facilities may
 *       have incomplete details (no name, address, or phone) and still
 *       appear, since they're real, useful entries even when partial.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *         description: Latitude of the search origin.
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *         description: Longitude of the search origin.
 *       - in: query
 *         name: radius
 *         required: false
 *         schema: { type: integer, minimum: 500, maximum: 20000, default: 5000 }
 *         description: Search radius in meters. Defaults to 5000 (5km).
 *       - in: query
 *         name: type
 *         required: false
 *         schema: { type: string, enum: [hospital, clinic, doctors, pharmacy, dentist] }
 *         description: Restrict results to a single facility type. Omit for all types.
 *     responses:
 *       200:
 *         description: Facilities found, sorted by distance ascending.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 facilities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, example: 'node/123456' }
 *                       name: { type: string, example: 'City General Hospital' }
 *                       type: { type: string, example: hospital }
 *                       lat: { type: number }
 *                       lng: { type: number }
 *                       address: { type: string, nullable: true }
 *                       phone: { type: string, nullable: true }
 *                       openingHours: { type: string, nullable: true }
 *                       distanceKm: { type: number, example: 1.2 }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: The Overpass directory could not be reached — a best-effort third-party service, so this can happen transiently. }
 */
router.get('/nearby', protect, validate(searchNearbyRules), searchNearby);

module.exports = router;

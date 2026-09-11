const express = require('express');
const router = express.Router();
const {
  searchNearby, geocodeSearch, reverseGeocode, getDirections,
} = require('../controllers/careFinderController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  searchNearbyRules, geocodeRules, reverseGeocodeRules, getDirectionsRules,
} = require('../validators/careFinderValidators');

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

/**
 * @swagger
 * /care-finder/geocode:
 *   get:
 *     tags: [Care Finder]
 *     summary: Search for a place by name/address
 *     description: >
 *       Proxies OpenStreetMap Nominatim so a user can type a place name or
 *       address and pick a matching location, instead of being limited to
 *       their device's GPS position.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2, maxLength: 200 }
 *         description: Free-text place name or address.
 *     responses:
 *       200:
 *         description: Candidate matches, best-effort ranked by Nominatim.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       label: { type: string, example: 'Springfield, IL, USA' }
 *                       lat: { type: number }
 *                       lng: { type: number }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: The geocoding service could not be reached. }
 */
router.get('/geocode', protect, validate(geocodeRules), geocodeSearch);

/**
 * @swagger
 * /care-finder/reverse:
 *   get:
 *     tags: [Care Finder]
 *     summary: Turn a coordinate into a readable place label
 *     description: >
 *       Proxies OpenStreetMap Nominatim's reverse geocoder — used to label a
 *       location the user picked directly on the map.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: A best-effort label, or null if nothing matched (not an error — the raw coordinate is still usable).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 label: { type: string, nullable: true, example: '123 Main St, Springfield, IL' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/reverse', protect, validate(reverseGeocodeRules), reverseGeocode);

/**
 * @swagger
 * /care-finder/directions:
 *   get:
 *     tags: [Care Finder]
 *     summary: Get driving directions between two points
 *     description: >
 *       Proxies OSRM's public routing server so a route can be drawn on the
 *       app's own map instead of handing the user off to an external maps
 *       app. Driving directions only — OSRM's public demo instance has no
 *       free walking/cycling profile available.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: fromLat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: fromLng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: toLat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: toLng
 *         required: true
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: A driving route, its geometry, and simplified turn-by-turn steps.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 distanceKm: { type: number, example: 3.4 }
 *                 durationMin: { type: integer, example: 9 }
 *                 geometry:
 *                   type: array
 *                   items: { type: array, items: { type: number }, example: [40.713, -74.006] }
 *                 steps:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       instruction: { type: string, example: 'Turn right onto Broadway' }
 *                       distanceKm: { type: number, example: 0.6 }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: The routing service could not be reached or found no route. }
 */
router.get('/directions', protect, validate(getDirectionsRules), getDirections);

module.exports = router;

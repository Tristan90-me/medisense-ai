const { haversineKm } = require('../utils/geo');

// Public Overpass instance — no API key, no billing. Fair-use only: keep
// requests low-volume and always bound them with a timeout so a slow/down
// instance can never hang this endpoint.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const FETCH_TIMEOUT_MS = 15000;
const DEFAULT_RADIUS_M = 5000;

const AMENITY_LABELS = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  doctors: "Doctor's Office",
  pharmacy: 'Pharmacy',
  dentist: 'Dentist',
};

// Hospital/clinic are frequently mapped as building outlines (ways) as well
// as points, so both are queried; doctors/pharmacy/dentist are almost always
// single nodes, so only the node line is needed for those — keeps the query
// smaller and faster without losing real results.
const AMENITY_LINES = {
  hospital: (r, lat, lng) => [
    `node["amenity"="hospital"](around:${r},${lat},${lng});`,
    `way["amenity"="hospital"](around:${r},${lat},${lng});`,
  ],
  clinic: (r, lat, lng) => [
    `node["amenity"="clinic"](around:${r},${lat},${lng});`,
    `way["amenity"="clinic"](around:${r},${lat},${lng});`,
  ],
  doctors: (r, lat, lng) => [`node["amenity"="doctors"](around:${r},${lat},${lng});`],
  pharmacy: (r, lat, lng) => [`node["amenity"="pharmacy"](around:${r},${lat},${lng});`],
  dentist: (r, lat, lng) => [`node["amenity"="dentist"](around:${r},${lat},${lng});`],
};

const buildOverpassQuery = (lat, lng, radius, type) => {
  const types = type ? [type] : Object.keys(AMENITY_LINES);
  const lines = types.flatMap((t) => AMENITY_LINES[t](radius, lat, lng));
  return `[out:json][timeout:20];\n(\n  ${lines.join('\n  ')}\n);\nout center;`;
};

// addr:housenumber + addr:street + addr:city, joined sensibly — OSM data is
// frequently partial, so this degrades gracefully rather than requiring all
// three fields.
const composeAddress = (tags) => {
  const parts = [];
  const houseNumber = tags['addr:housenumber'];
  const street = tags['addr:street'];
  if (houseNumber && street) parts.push(`${houseNumber} ${street}`);
  else if (street) parts.push(street);
  if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.length ? parts.join(', ') : null;
};

// Normalizes one Overpass element into the shape the frontend consumes.
// Returns null (caller filters it out) for malformed elements that have
// neither direct coordinates (node) nor a computed center (way) — rare, but
// it happens with incomplete OSM data.
const normalizeElement = (el, originLat, originLng) => {
  const tags = el.tags || {};
  const amenity = tags.amenity;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const distanceKm = Math.round(haversineKm(originLat, originLng, lat, lng) * 10) / 10;

  return {
    id: `${el.type}/${el.id}`,
    name: tags.name || `Unnamed ${AMENITY_LABELS[amenity] || 'Facility'}`,
    type: amenity,
    lat,
    lng,
    address: composeAddress(tags),
    phone: tags.phone || tags['contact:phone'] || null,
    openingHours: tags.opening_hours || null,
    distanceKm,
  };
};

// GET /api/care-finder/nearby?lat=&lng=&radius=&type=
// lat/lng/radius/type are already validated by careFinderValidators before
// this runs. Queries the public Overpass API for nearby care facilities
// (hospital/clinic/doctors/pharmacy/dentist), normalizes + sorts by distance.
// Overpass's public instance is best-effort and can be slow or briefly
// down — a bounded timeout plus a friendly 502 keeps this endpoint from ever
// hanging or crashing when that happens.
exports.searchNearby = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = req.query.radius ? parseInt(req.query.radius, 10) : DEFAULT_RADIUS_M;
  const { type } = req.query;

  const query = buildOverpassQuery(lat, lng, radius, type);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Node's built-in fetch sends no User-Agent by default. Overpass's
        // public instance (via an Apache-level content-negotiation check)
        // returns a bare 406 Not Acceptable for requests missing one —
        // confirmed live: identical query, curl (which sends its own UA)
        // gets 200, a bare Node fetch call gets 406. A descriptive UA is
        // also the polite, expected thing to send per OSM's usage policy.
        'User-Agent': 'MediSenseAI/1.0 (health symptom checker; Care Finder feature)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: 'Unable to reach the care-facility directory right now. Please try again shortly.',
      });
    }

    const data = await response.json();
    const elements = Array.isArray(data.elements) ? data.elements : [];

    const facilities = elements
      .map((el) => normalizeElement(el, lat, lng))
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ success: true, facilities });
  } catch {
    // Covers network failure, abort-on-timeout, and malformed JSON alike —
    // callers only ever see one clear, friendly message.
    res.status(502).json({
      success: false,
      message: 'Unable to reach the care-facility directory right now. Please try again shortly.',
    });
  } finally {
    clearTimeout(timeout);
  }
};

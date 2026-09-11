const { haversineKm } = require('../utils/geo');

// Public Overpass instance — no API key, no billing. Fair-use only: keep
// requests low-volume and always bound them with a timeout so a slow/down
// instance can never hang this endpoint.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
// Nominatim (OSM's free geocoder) and OSRM's public demo routing server —
// same no-key, fair-use, be-polite-with-a-User-Agent deal as Overpass above.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OSRM_URL = 'https://router.project-osrm.org';
const USER_AGENT = 'MediSenseAI/1.0 (health symptom checker; Care Finder feature)';
const FETCH_TIMEOUT_MS = 15000;
const DEFAULT_RADIUS_M = 5000;

// Shared by every OSM-ecosystem call this controller makes (Overpass,
// Nominatim, OSRM) — same timeout/abort/User-Agent/error-shape contract so
// each endpoint below stays a few lines of route-specific logic instead of
// re-deriving fetch plumbing three times.
const fetchOsm = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'User-Agent': USER_AGENT, ...options.headers },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const AMENITY_LABELS = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  doctors: "Doctor's Office",
  pharmacy: 'Pharmacy',
  dentist: 'Dentist',
};

// Hospital/clinic used to also query `way["amenity"=...]` (building outlines)
// alongside nodes, on the theory that some facilities are only mapped as a
// polygon. The problem: Overpass's `out center;` gives a way the center of
// its bounding box, not a real centroid — for an oddly-shaped or multi-block
// hospital campus that point can land in a courtyard, an adjacent block, or
// across the street from the actual entrance. That's what was sending
// "Directions" to the wrong place. Nodes always carry an exact, real point
// (an amenity tag placed by a mapper at the actual entrance/location), so
// restricting every category to nodes trades a small number of
// building-outline-only facilities for a guarantee that every coordinate we
// return is precise.
const AMENITY_LINES = {
  hospital: (r, lat, lng) => [`node["amenity"="hospital"](around:${r},${lat},${lng});`],
  clinic: (r, lat, lng) => [`node["amenity"="clinic"](around:${r},${lat},${lng});`],
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
  // Node's built-in fetch sends no User-Agent by default. Overpass's public
  // instance (via an Apache-level content-negotiation check) returns a bare
  // 406 Not Acceptable for requests missing one — confirmed live: identical
  // query, curl (which sends its own UA) gets 200, a bare Node fetch call
  // gets 406. fetchOsm's User-Agent covers this.
  const data = await fetchOsm(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!data) {
    return res.status(502).json({
      success: false,
      message: 'Unable to reach the care-facility directory right now. Please try again shortly.',
    });
  }

  const elements = Array.isArray(data.elements) ? data.elements : [];
  const facilities = elements
    .map((el) => normalizeElement(el, lat, lng))
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({ success: true, facilities });
};

// GET /api/care-finder/geocode?q=
// Proxies Nominatim's /search — lets a user type a place name/address and
// get candidate lat/lng matches back, so Care Finder's origin isn't limited
// to GPS. `q` is pre-validated (length-bounded) by careFinderValidators.
exports.geocodeSearch = async (req, res) => {
  const { q } = req.query;
  const url = `${NOMINATIM_URL}/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
  const data = await fetchOsm(url);

  if (!data) {
    return res.status(502).json({
      success: false,
      message: 'Unable to search for that location right now. Please try again shortly.',
    });
  }

  const results = (Array.isArray(data) ? data : []).map((r) => ({
    label: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));

  res.json({ success: true, results });
};

// GET /api/care-finder/reverse?lat=&lng=
// Proxies Nominatim's /reverse — turns a map-clicked point into a readable
// label ("123 Main St, Springfield") instead of showing raw coordinates.
exports.reverseGeocode = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const url = `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const data = await fetchOsm(url);

  // A miss (open ocean, no reverse match) isn't an error — the caller can
  // still use the raw coordinates, just without a friendly label.
  res.json({ success: true, label: data?.display_name || null });
};

// Turns one OSRM maneuver into a short plain-English instruction. OSRM only
// returns structured maneuver data (type/modifier), not human text, so this
// is a small hand-rolled formatter rather than pulling in a separate
// text-instructions package — it covers the maneuver types OSRM actually
// produces, with a generic fallback for anything unusual.
const MODIFIER_VERBS = {
  uturn: 'Make a U-turn',
  'sharp left': 'Take a sharp left',
  left: 'Turn left',
  'slight left': 'Bear slightly left',
  straight: 'Continue straight',
  'slight right': 'Bear slightly right',
  right: 'Turn right',
  'sharp right': 'Take a sharp right',
};

const describeStep = (maneuver, roadName) => {
  const onto = roadName ? ` onto ${roadName}` : '';
  const on = roadName ? ` on ${roadName}` : '';

  if (maneuver.type === 'depart') return `Head out${on}`;
  if (maneuver.type === 'arrive') return 'Arrive at your destination';
  if (maneuver.type === 'roundabout' || maneuver.type === 'rotary') {
    return `Enter the roundabout${maneuver.exit ? ` and take exit ${maneuver.exit}` : ''}${onto}`;
  }

  const verb = MODIFIER_VERBS[maneuver.modifier] || 'Continue';
  return `${verb}${onto}`;
};

// GET /api/care-finder/directions?fromLat=&fromLng=&toLat=&toLng=
// Proxies OSRM's public routing server for turn-by-turn driving directions,
// so a route can be drawn on the app's own map instead of handing the user
// off to an external maps app. OSRM's public demo instance only serves the
// driving profile — there's no free walking/cycling equivalent to fall back
// on, so this is scoped to driving directions and says so, rather than
// silently mislabeling a driving route as a walking one.
exports.getDirections = async (req, res) => {
  const fromLat = parseFloat(req.query.fromLat);
  const fromLng = parseFloat(req.query.fromLng);
  const toLat = parseFloat(req.query.toLat);
  const toLng = parseFloat(req.query.toLng);

  const url = `${OSRM_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`
    + '?overview=full&geometries=geojson&steps=true';
  const data = await fetchOsm(url);

  if (!data || data.code !== 'Ok' || !data.routes?.length) {
    return res.status(502).json({
      success: false,
      message: 'Unable to calculate directions right now. Please try again shortly.',
    });
  }

  const route = data.routes[0];
  // GeoJSON coordinates are [lng, lat]; Leaflet wants [lat, lng].
  const geometry = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const steps = (route.legs[0]?.steps || []).map((step) => ({
    instruction: describeStep(step.maneuver, step.name),
    distanceKm: Math.round((step.distance / 1000) * 10) / 10,
  }));

  res.json({
    success: true,
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    durationMin: Math.round(route.duration / 60),
    geometry,
    steps,
  });
};

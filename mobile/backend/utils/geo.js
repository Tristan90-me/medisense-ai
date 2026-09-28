// Pure geo helpers — kept free of any Mongo/HTTP dependency so they're
// trivially unit-testable in isolation (see tests/geo.test.js).
const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance between two lat/lng points, in kilometers.
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

module.exports = { haversineKm };

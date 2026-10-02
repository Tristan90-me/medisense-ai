const { estimateBurn } = require('./energy');

// One MET value per broad workout type rather than per exercise — a
// deliberate MVP simplification (a real MET table varies by specific
// activity and intensity). Values are mid-range, moderate-intensity
// estimates: strength training ~5 MET, running/cycling-type cardio ~8 MET,
// flexibility/yoga ~2.5 MET, anything else ~4 MET.
const MET_BY_TYPE = {
  strength: 5,
  cardio: 8,
  flexibility: 2.5,
  other: 4,
};

function caloriesForWorkout(type, durationMin, weightKg) {
  const met = MET_BY_TYPE[type] || MET_BY_TYPE.other;
  return estimateBurn(met, weightKg, durationMin);
}

// Minutes per km — lower is faster. Returns null when either input is
// unusable, so callers don't have to special-case Infinity/NaN.
function paceMinPerKm(distanceKm, durationMin) {
  if (!(distanceKm > 0) || !(durationMin > 0)) return null;
  return Math.round((durationMin / distanceKm) * 100) / 100;
}

module.exports = { MET_BY_TYPE, caloriesForWorkout, paceMinPerKm };

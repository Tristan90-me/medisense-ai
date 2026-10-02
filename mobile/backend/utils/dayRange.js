// Turns an optional "YYYY-MM-DD" into a [start, end) UTC day boundary pair,
// defaulting to today. Shared by every "day view" endpoint (meals, water,
// and later workouts/steps) so they all bucket by day the same way.
function parseDayRange(dateStr) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

module.exports = { parseDayRange };

// Generic consecutive-day streak calculator — not fitness-specific, so it
// can back a workout streak now and a logging/hydration streak later
// (config/achievements.js) without duplicating this logic.
const toDayStr = (d) => d.toISOString().slice(0, 10);

const todayUTCString = (now = new Date()) => toDayStr(now);

// `activeDays` is any iterable of 'YYYY-MM-DD' strings (a Set is fine and
// preferred for lookup speed). Counts backward from today. If today isn't
// active yet, counting starts from yesterday instead — a streak shouldn't
// visibly reset to 0 just because today isn't over, only once yesterday
// also lapses without activity.
function computeStreak(activeDays, now = new Date()) {
  const active = activeDays instanceof Set ? activeDays : new Set(activeDays);
  let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!active.has(toDayStr(cursor))) {
    cursor = new Date(cursor.getTime() - 86400000);
  }
  let streak = 0;
  while (active.has(toDayStr(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

module.exports = { computeStreak, todayUTCString, toDayStr };

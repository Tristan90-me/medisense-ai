// Pure adherence calculation — no DB access, so it's cheaply unit-testable
// in isolation (mirrors utils/computeHealthScore.js's split between a pure
// formula and the DB-touching controller that gathers its inputs).
const ADHERENCE_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// `medication` needs reminderTimes, doseLog, startDate, createdAt. `now` is
// injectable for deterministic tests.
const computeAdherence = (medication, now = new Date()) => {
  const reminderCount = medication.reminderTimes?.length || 0;
  // No reminder times set means there's no "expected dose" to measure
  // against — showing 0% here would read as "you're failing" when really
  // adherence just isn't trackable yet.
  if (reminderCount === 0) {
    return { trackable: false, takenCount: 0, expectedCount: 0, percentage: null };
  }

  const windowStart = new Date(now.getTime() - ADHERENCE_WINDOW_DAYS * MS_PER_DAY);

  // Don't count days before the medication actually existed — a medication
  // added yesterday shouldn't look like it missed 6 days of doses it was
  // never prescribed for yet.
  const candidateStarts = [windowStart];
  if (medication.startDate) candidateStarts.push(new Date(medication.startDate));
  if (medication.createdAt) candidateStarts.push(new Date(medication.createdAt));
  const effectiveStart = new Date(Math.max(...candidateStarts.map((d) => d.getTime())));

  // floor, not ceil — a medication created moments ago is 0 elapsed days,
  // not 1. Rounding up here would show a freshly-added medication as
  // immediately "0% adherent" before a single real day has passed.
  const activeDays = Math.max(0, Math.min(
    ADHERENCE_WINDOW_DAYS,
    Math.floor((now.getTime() - effectiveStart.getTime()) / MS_PER_DAY)
  ));
  const expectedCount = activeDays * reminderCount;

  const takenCount = (medication.doseLog || []).filter((d) => {
    const t = new Date(d.takenAt).getTime();
    return t >= windowStart.getTime() && t <= now.getTime();
  }).length;

  const percentage = expectedCount > 0 ? Math.min(100, Math.round((takenCount / expectedCount) * 100)) : null;

  return { trackable: true, takenCount, expectedCount, percentage };
};

module.exports = { computeAdherence, ADHERENCE_WINDOW_DAYS };

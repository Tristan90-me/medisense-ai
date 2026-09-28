const Session = require('../models/Session');
const HealthProfile = require('../models/HealthProfile');
const Medication = require('../models/Medication');
const HealthScore = require('../models/HealthScore');
const ACHIEVEMENTS = require('../config/achievements');
const { computeScore } = require('../utils/computeHealthScore');
const { resolveDependentId } = require('../utils/resolveDependent');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_HISTORY_ENTRIES = 90;

// Fields "tracked" toward profile completeness. Array fields count as
// filled when non-empty. bloodType, smokingStatus, and alcoholUse each ship
// with a non-null schema default ('unknown' / 'never' / 'none') that is
// indistinguishable, once saved, from "the user deliberately chose this
// value" — so for those three specifically we treat the *default* value as
// NOT filled. This undercounts a genuine never-smoker/never-drinker with an
// unrecorded blood type, but the alternative (counting untouched schema
// defaults as "filled") would make every brand-new, completely untouched
// profile always score ~27% complete on those three fields alone, which is
// a worse signal for a feature whose whole point is to reward actually
// filling the profile out. All other fields count as filled whenever they
// hold any value at all.
const TRACKED_PROFILE_FIELDS = [
  'dateOfBirth', 'sex', 'weight', 'height', 'bloodType',
  'preExistingConditions', 'allergies', 'currentMedications',
  'familyHistory', 'smokingStatus', 'alcoholUse',
];

const DEFAULT_COLLIDING_FIELDS = {
  bloodType: 'unknown',
  smokingStatus: 'never',
  alcoholUse: 'none',
};

const isFilled = (profile, field) => {
  const value = profile[field];
  if (Array.isArray(value)) return value.length > 0;
  if (field in DEFAULT_COLLIDING_FIELDS) return !!value && value !== DEFAULT_COLLIDING_FIELDS[field];
  return value !== undefined && value !== null && value !== '';
};

// Fraction (0-1) of the tracked fields that are filled. No HealthProfile at
// all for this person => 0.
const computeProfileCompleteness = (profile) => {
  if (!profile) return 0;
  const filledCount = TRACKED_PROFILE_FIELDS.filter((field) => isFilled(profile, field)).length;
  return filledCount / TRACKED_PROFILE_FIELDS.length;
};

// GET /api/health-score?dependent=<id>
// Recomputed on every call from live Session/HealthProfile/Medication data
// — there is no separate "recalculate" endpoint and no caching beyond the
// persisted HealthScore document itself, which mainly exists to hold the
// rolling history and the unlocked-achievements ledger across calls.
exports.getHealthScore = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.query.dependent, req.user._id);
    const scope = { user: req.user._id, dependent };
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

    const [
      totalSessions,
      sessionsLast30Days,
      completedSessions,
      totalNonAbandonedSessions,
      criticalOrEmergencyCount,
      activeMedicationsCount,
      profile,
      existing,
    ] = await Promise.all([
      Session.countDocuments(scope),
      Session.countDocuments({ ...scope, createdAt: { $gte: thirtyDaysAgo } }),
      Session.countDocuments({ ...scope, status: 'completed' }),
      Session.countDocuments({ ...scope, status: { $ne: 'abandoned' } }),
      Session.countDocuments({
        ...scope,
        createdAt: { $gte: thirtyDaysAgo },
        $or: [{ emergencyDetected: true }, { severityLevel: 'Critical' }],
      }),
      Medication.countDocuments({ ...scope, active: true }),
      HealthProfile.findOne(scope),
      HealthScore.findOne(scope),
    ]);

    const ctx = {
      totalSessions,
      sessionsLast30Days,
      completedSessions,
      totalNonAbandonedSessions,
      hadCriticalOrEmergencyLast30Days: criticalOrEmergencyCount > 0,
      activeMedicationsCount,
      profileCompleteness: computeProfileCompleteness(profile),
    };

    const { currentScore, breakdown } = computeScore(ctx);

    // Achievements are evaluated against ctx plus currentScore and the
    // breakdown fields merged in (health_champion needs currentScore,
    // clean_bill needs noCriticalFlagScore). Dedup by id and never touch an
    // already-unlocked achievement's original unlockedAt.
    const achievementCtx = { ...ctx, currentScore, ...breakdown };
    const existingUnlocked = existing?.unlockedAchievements || [];
    const existingIds = new Set(existingUnlocked.map((a) => a.id));
    const newlyUnlocked = ACHIEVEMENTS
      .filter((a) => !existingIds.has(a.id) && a.check(achievementCtx))
      .map((a) => ({ id: a.id, unlockedAt: new Date() }));
    const unlockedAchievements = [...existingUnlocked, ...newlyUnlocked];

    const history = [
      ...(existing?.history || []),
      { date: new Date(), score: currentScore },
    ].slice(-MAX_HISTORY_ENTRIES);

    const healthScore = await HealthScore.findOneAndUpdate(
      scope,
      { currentScore, history, unlockedAchievements },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    res.json({ success: true, healthScore: { ...healthScore.toObject(), breakdown } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

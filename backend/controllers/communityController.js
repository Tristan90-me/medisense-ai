const Session = require('../models/Session');

// Hard privacy floor: any aggregate bucket (a symptom, a severity level)
// backed by fewer than this many DISTINCT users is omitted entirely from the
// response — never shown with a low count, never grayed out client-side.
// Counting by distinct user (not raw session count) is the whole point of
// this feature: one chatty user submitting many sessions about the same
// symptom must never look like "many people reported this."
const MIN_COHORT_SIZE = 10;

// ── Community trends (anonymized, privacy-floored) ──────────────────────────
exports.getTrends = async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const totalDistinctUsers = (await Session.distinct('user', { createdAt: { $gte: since } })).length;

    // Top symptoms: dedupe to {symptom, user} first so a user reporting the
    // same symptom across several sessions in the window counts once, THEN
    // group by symptom counting distinct users, THEN filter below the
    // cohort floor. Symptom names are lowercased/trimmed so "Headache" and
    // "headache" aren't split into separate buckets.
    const topSymptomsAgg = await Session.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: '$symptoms' },
      {
        $project: {
          user: 1,
          symptom: { $toLower: { $trim: { input: { $ifNull: ['$symptoms.name', ''] } } } },
        },
      },
      { $match: { symptom: { $ne: '' } } },
      { $group: { _id: { symptom: '$symptom', user: '$user' } } },
      { $group: { _id: '$_id.symptom', userCount: { $sum: 1 } } },
      { $match: { userCount: { $gte: MIN_COHORT_SIZE } } },
      { $sort: { userCount: -1 } },
      { $limit: 10 },
    ]);

    const topSymptoms = topSymptomsAgg.map((s) => ({
      symptom: s._id,
      userCount: s.userCount,
      percentage: totalDistinctUsers > 0 ? Math.round((s.userCount / totalDistinctUsers) * 1000) / 10 : 0,
    }));

    // Severity breakdown: same distinct-user-per-bucket approach. A user with
    // sessions at multiple severity levels in the window counts once per
    // level they experienced (dedupe by {severityLevel, user} first).
    const severityAgg = await Session.aggregate([
      { $match: { createdAt: { $gte: since }, severityLevel: { $exists: true, $ne: null } } },
      { $group: { _id: { severityLevel: '$severityLevel', user: '$user' } } },
      { $group: { _id: '$_id.severityLevel', userCount: { $sum: 1 } } },
      { $match: { userCount: { $gte: MIN_COHORT_SIZE } } },
      { $sort: { userCount: -1 } },
    ]);

    const severityBreakdown = severityAgg.map((s) => ({
      severityLevel: s._id,
      userCount: s.userCount,
      percentage: totalDistinctUsers > 0 ? Math.round((s.userCount / totalDistinctUsers) * 1000) / 10 : 0,
    }));

    const insufficientData = totalDistinctUsers < MIN_COHORT_SIZE;

    res.json({
      success: true,
      trends: {
        windowDays: days,
        totalDistinctUsers: insufficientData ? null : totalDistinctUsers,
        topSymptoms,
        severityBreakdown,
        insufficientData,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.MIN_COHORT_SIZE = MIN_COHORT_SIZE;

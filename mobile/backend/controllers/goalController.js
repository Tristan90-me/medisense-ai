const HealthProfile = require('../models/HealthProfile');
const FitnessGoal = require('../models/FitnessGoal');
const NutritionGoal = require('../models/NutritionGoal');
const { resolveDependentId } = require('../utils/resolveDependent');
const energyUtil = require('../utils/energy');

const FITNESS_FIELDS = ['goalType', 'targetWeightKg', 'dailyStepGoal', 'weeklyWorkoutGoal'];
const NUTRITION_FIELDS = ['goalMode', 'dietPreset', 'waterGoalMl', 'addBackExercise'];

const pick = (obj, keys) => Object.fromEntries(
  keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]),
);

async function snapshot(userId, dependent) {
  const [profile, fitnessGoal, nutritionGoal] = await Promise.all([
    HealthProfile.findOne({ user: userId, dependent }),
    FitnessGoal.findOne({ user: userId, dependent }),
    NutritionGoal.findOne({ user: userId, dependent }),
  ]);
  const e = energyUtil.energyFromProfile(profile);
  return {
    fitnessGoal,
    nutritionGoal,
    energy: { bmr: e.bmr, tdee: e.tdee, sedentaryTdee: e.sedentaryTdee, bmi: e.bmi, missing: e.missing },
  };
}

// GET /api/goals?dependent=<id>
exports.getGoals = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.query.dependent, req.user._id);
    res.json({ success: true, ...(await snapshot(req.user._id, dependent)) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// PUT /api/goals — body: { dependent?, fitness?: {...}, nutrition?: {...} }
// Upserts whichever halves are present. Unless the user supplies their own
// calorieTarget, the target is recomputed from their profile so it follows
// weight/activity changes; supplying one marks it custom and it is left alone.
exports.updateGoals = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const { fitness, nutrition } = req.body;

    if (fitness) {
      await FitnessGoal.findOneAndUpdate(
        { user: req.user._id, dependent },
        pick(fitness, FITNESS_FIELDS),
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      );
    }

    if (nutrition) {
      const [profile, existingDoc] = await Promise.all([
        HealthProfile.findOne({ user: req.user._id, dependent }),
        NutritionGoal.findOne({ user: req.user._id, dependent }),
      ]);
      const existing = existingDoc ? existingDoc.toObject() : {};
      const next = { ...existing, ...pick(nutrition, NUTRITION_FIELDS) };
      const goalMode = next.goalMode || 'maintain';
      const dietPreset = next.dietPreset || 'balanced';
      const e = energyUtil.energyFromProfile(profile);

      let calorieTarget = existing.calorieTarget;
      let calorieTargetIsCustom = existing.calorieTargetIsCustom || false;
      let floorApplied = existing.floorApplied || false;

      if (nutrition.calorieTarget != null) {
        calorieTarget = nutrition.calorieTarget;
        calorieTargetIsCustom = true;
        floorApplied = false;
      } else if (nutrition.useRecommended) {
        calorieTargetIsCustom = false;
      }

      if (!calorieTargetIsCustom) {
        // With exercise added back, the budget must start from the sedentary
        // baseline or movement is counted twice (see dailyEnergyLedger).
        const baseTdee = next.addBackExercise ? e.sedentaryTdee : e.tdee;
        const goal = energyUtil.calorieGoal(baseTdee, goalMode, profile && profile.sex);
        if (goal.target != null) {
          calorieTarget = goal.target;
          floorApplied = goal.floorApplied;
        }
      }

      // The stored split is only replaced when the request changes it, so
      // unrelated updates (e.g. water goal) don't wipe a custom split.
      let macroSplit = existing.macroSplit;
      if (nutrition.macroSplit) macroSplit = nutrition.macroSplit;
      else if (nutrition.dietPreset || !macroSplit || !macroSplit.carbsPct) macroSplit = energyUtil.DIET_PRESETS[dietPreset];

      const update = {
        ...pick(next, NUTRITION_FIELDS),
        goalMode,
        dietPreset,
        calorieTarget,
        calorieTargetIsCustom,
        floorApplied,
        macroSplit,
        macroTargets: energyUtil.macroTargets(calorieTarget, macroSplit) || undefined,
      };

      await NutritionGoal.findOneAndUpdate(
        { user: req.user._id, dependent },
        update,
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      );
    }

    res.json({ success: true, ...(await snapshot(req.user._id, dependent)) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

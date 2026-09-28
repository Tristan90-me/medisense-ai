// Single source of truth for energy maths. Both the nutrition calorie goal and
// the fitness calorie-burn estimates read from here so the two modules can
// never disagree about someone's numbers. Pure functions — no DB, no network.

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// [carbs, protein, fat] as % of calories; each row sums to 100.
const DIET_PRESETS = {
  balanced: { carbsPct: 50, proteinPct: 20, fatPct: 30 },
  keto: { carbsPct: 5, proteinPct: 25, fatPct: 70 },
  low_carb: { carbsPct: 25, proteinPct: 35, fatPct: 40 },
  mediterranean: { carbsPct: 45, proteinPct: 18, fatPct: 37 },
  high_protein: { carbsPct: 35, proteinPct: 35, fatPct: 30 },
  vegan: { carbsPct: 55, proteinPct: 15, fatPct: 30 },
};

// Below these an auto-generated target is clamped and flagged rather than
// handed to the user as-is — a deficit calculator should not silently
// recommend crash-diet intake.
const MIN_CALORIES = { female: 1200, male: 1500, other: 1350 };

const GOAL_ADJUSTMENT = { lose: -500, maintain: 0, gain: 300 };

const KCAL_PER_GRAM = { carbs: 4, protein: 4, fat: 9 };

const LBS_PER_KG = 2.20462;
const CM_PER_FOOT = 30.48;

function toKg(weight, unit = 'kg') {
  if (typeof weight !== 'number' || !(weight > 0)) return null;
  return unit === 'lbs' ? weight / LBS_PER_KG : weight;
}

// `ft` is stored as decimal feet (e.g. 5.9), not feet+inches.
function toCm(height, unit = 'cm') {
  if (typeof height !== 'number' || !(height > 0)) return null;
  return unit === 'ft' ? height * CM_PER_FOOT : height;
}

function ageFromDob(dob, now = new Date()) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthday = now.getUTCMonth() > birth.getUTCMonth()
    || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

// Mifflin-St Jeor. For 'other' / 'prefer_not_to_say' the sex constant is the
// midpoint of the male (+5) and female (-161) constants.
function calcBMR({ sex, weightKg, heightCm, age }) {
  if (![weightKg, heightCm, age].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return Math.round(base + 5);
  if (sex === 'female') return Math.round(base - 161);
  return Math.round(base - 78);
}

function calcTDEE(bmr, activityLevel) {
  const factor = ACTIVITY_FACTORS[activityLevel];
  if (bmr == null || !factor) return null;
  return Math.round(bmr * factor);
}

// Standard MET formula: kcal = MET x body-weight(kg) x hours.
function estimateBurn(met, weightKg, minutes) {
  if (![met, weightKg, minutes].every((n) => typeof n === 'number' && n > 0)) return 0;
  return Math.round(met * weightKg * (minutes / 60));
}

// ~0.57 kcal per kg of body weight per 1000 steps (about 40 kcal/1000 steps at 70 kg).
function stepsToCalories(steps, weightKg) {
  if (!(steps > 0) || !(weightKg > 0)) return 0;
  return Math.round((steps / 1000) * 0.57 * weightKg);
}

// Average stride is ~41.5% of height.
function stepsToDistanceKm(steps, heightCm) {
  if (!(steps > 0) || !(heightCm > 0)) return 0;
  return Math.round(((steps * heightCm * 0.415) / 100000) * 100) / 100;
}

function calcBMI(weightKg, heightCm) {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

// Returns { target, floorApplied }. `tdee` must already reflect the chosen
// activity level (see dailyEnergyLedger for the add-back-exercise caveat).
function calorieGoal(tdee, goalMode = 'maintain', sex) {
  if (tdee == null) return { target: null, floorApplied: false };
  const adjustment = GOAL_ADJUSTMENT[goalMode] ?? 0;
  const raw = tdee + adjustment;
  const floor = MIN_CALORIES[sex] ?? MIN_CALORIES.other;
  if (raw < floor) return { target: floor, floorApplied: true };
  return { target: Math.round(raw), floorApplied: false };
}

function macroTargets(calories, split) {
  if (!(calories > 0) || !split) return null;
  return {
    carbsG: Math.round((calories * split.carbsPct) / 100 / KCAL_PER_GRAM.carbs),
    proteinG: Math.round((calories * split.proteinPct) / 100 / KCAL_PER_GRAM.protein),
    fatG: Math.round((calories * split.fatPct) / 100 / KCAL_PER_GRAM.fat),
  };
}

// Reads the shape stored in HealthProfile and returns everything derivable
// from it, plus which inputs are missing so onboarding knows what to ask.
function energyFromProfile(profile, now = new Date()) {
  const p = profile || {};
  const weightKg = toKg(p.weight, p.weightUnit);
  const heightCm = toCm(p.height, p.heightUnit);
  const age = ageFromDob(p.dateOfBirth, now);

  const missing = [];
  if (weightKg == null) missing.push('weight');
  if (heightCm == null) missing.push('height');
  if (age == null) missing.push('dateOfBirth');
  if (!p.sex) missing.push('sex');
  if (!p.activityLevel) missing.push('activityLevel');

  const bmr = calcBMR({ sex: p.sex, weightKg, heightCm, age });
  return {
    weightKg,
    heightCm,
    age,
    bmr,
    tdee: calcTDEE(bmr, p.activityLevel),
    // Baseline with no activity credit, used when logged exercise is added back.
    sedentaryTdee: calcTDEE(bmr, 'sedentary'),
    bmi: calcBMI(weightKg, heightCm),
    missing,
  };
}

module.exports = {
  ACTIVITY_FACTORS,
  DIET_PRESETS,
  MIN_CALORIES,
  toKg,
  toCm,
  ageFromDob,
  calcBMR,
  calcTDEE,
  estimateBurn,
  stepsToCalories,
  stepsToDistanceKm,
  calcBMI,
  calorieGoal,
  macroTargets,
  energyFromProfile,
};

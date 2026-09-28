// Integration tests for GET/PUT /api/goals (routes/goals.js ->
// controllers/goalController.js). No email or Gemini involved.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const HealthProfile = require('../models/HealthProfile');
const NutritionGoal = require('../models/NutritionGoal');

async function createUser(overrides = {}) {
  return User.create({
    name: 'Test User',
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password: 'userpass123',
    role: 'user',
    isEmailVerified: true,
    ...overrides,
  });
}

const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

// Jan 1 exactly 30 years ago: always turned 30 already this calendar year, so
// age is 30 whenever the test runs.
const dobThirtyYearsAgo = () => new Date(Date.UTC(new Date().getUTCFullYear() - 30, 0, 1));

// 30y male, 80kg, 180cm, moderate: BMR 1780, TDEE 2759, sedentary TDEE 2136.
const maleProfile = (user, extra = {}) => HealthProfile.create({
  user: user._id,
  sex: 'male',
  dateOfBirth: dobThirtyYearsAgo(),
  weight: 80,
  height: 180,
  activityLevel: 'moderate',
  ...extra,
});

describe('GET /api/goals', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/goals');
    expect(res.status).toBe(401);
  });

  test('with no data returns null goals and lists the missing profile inputs', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/goals').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.fitnessGoal).toBeNull();
    expect(res.body.nutritionGoal).toBeNull();
    expect(res.body.energy.tdee).toBeNull();
    expect(res.body.energy.missing.sort()).toEqual(['activityLevel', 'dateOfBirth', 'height', 'sex', 'weight']);
  });

  test('returns derived BMR/TDEE/BMI from the health profile', async () => {
    const user = await createUser();
    await maleProfile(user);
    const res = await request(app).get('/api/goals').set(auth(user));
    expect(res.body.energy).toMatchObject({
      bmr: 1780, tdee: 2759, sedentaryTdee: 2136, bmi: 24.7, missing: [],
    });
  });
});

describe('PUT /api/goals — fitness', () => {
  test('saves fitness goals and applies defaults for the rest', async () => {
    const user = await createUser();
    const res = await request(app).put('/api/goals').set(auth(user)).send({
      fitness: { goalType: 'weight_loss', targetWeightKg: 70, dailyStepGoal: 8000 },
    });
    expect(res.status).toBe(200);
    expect(res.body.fitnessGoal).toMatchObject({
      goalType: 'weight_loss', targetWeightKg: 70, dailyStepGoal: 8000, weeklyWorkoutGoal: 3,
    });
    expect(res.body.nutritionGoal).toBeNull();
  });

  test('a second update changes only the sent fields', async () => {
    const user = await createUser();
    await request(app).put('/api/goals').set(auth(user)).send({ fitness: { dailyStepGoal: 8000, weeklyWorkoutGoal: 5 } });
    const res = await request(app).put('/api/goals').set(auth(user)).send({ fitness: { dailyStepGoal: 12000 } });
    expect(res.body.fitnessGoal).toMatchObject({ dailyStepGoal: 12000, weeklyWorkoutGoal: 5 });
  });
});

describe('PUT /api/goals — nutrition', () => {
  test('computes the calorie target and macros from the profile', async () => {
    const user = await createUser();
    await maleProfile(user);
    const res = await request(app).put('/api/goals').set(auth(user)).send({ nutrition: { goalMode: 'lose' } });
    expect(res.status).toBe(200);
    const g = res.body.nutritionGoal;
    expect(g.calorieTarget).toBe(2259);
    expect(g.calorieTargetIsCustom).toBe(false);
    expect(g.floorApplied).toBe(false);
    expect(g.dietPreset).toBe('balanced');
    expect(g.macroSplit).toMatchObject({ carbsPct: 50, proteinPct: 20, fatPct: 30 });
    expect(g.macroTargets).toEqual({ carbsG: 282, proteinG: 113, fatG: 75 });
    expect(g.waterGoalMl).toBe(2000);
  });

  test('a diet preset swaps the macro split', async () => {
    const user = await createUser();
    await maleProfile(user);
    const res = await request(app).put('/api/goals').set(auth(user)).send({
      nutrition: { goalMode: 'maintain', dietPreset: 'keto' },
    });
    expect(res.body.nutritionGoal.macroSplit).toMatchObject({ carbsPct: 5, proteinPct: 25, fatPct: 70 });
    expect(res.body.nutritionGoal.calorieTarget).toBe(2759);
  });

  test('a custom calorie target sticks until useRecommended is sent', async () => {
    const user = await createUser();
    await maleProfile(user);
    const custom = await request(app).put('/api/goals').set(auth(user)).send({ nutrition: { calorieTarget: 1800 } });
    expect(custom.body.nutritionGoal).toMatchObject({ calorieTarget: 1800, calorieTargetIsCustom: true });

    const stays = await request(app).put('/api/goals').set(auth(user)).send({ nutrition: { goalMode: 'gain' } });
    expect(stays.body.nutritionGoal.calorieTarget).toBe(1800);

    const reset = await request(app).put('/api/goals').set(auth(user)).send({ nutrition: { useRecommended: true } });
    expect(reset.body.nutritionGoal).toMatchObject({ calorieTarget: 3059, calorieTargetIsCustom: false });
  });

  test('an unrelated update does not wipe a custom macro split', async () => {
    const user = await createUser();
    await maleProfile(user);
    await request(app).put('/api/goals').set(auth(user)).send({
      nutrition: { macroSplit: { carbsPct: 40, proteinPct: 30, fatPct: 30 } },
    });
    const res = await request(app).put('/api/goals').set(auth(user)).send({ nutrition: { waterGoalMl: 3000 } });
    expect(res.body.nutritionGoal.macroSplit).toMatchObject({ carbsPct: 40, proteinPct: 30, fatPct: 30 });
    expect(res.body.nutritionGoal.waterGoalMl).toBe(3000);
  });

  test('add-back mode builds the target from the sedentary baseline', async () => {
    const user = await createUser();
    await maleProfile(user);
    const res = await request(app).put('/api/goals').set(auth(user)).send({
      nutrition: { goalMode: 'maintain', addBackExercise: true },
    });
    expect(res.body.nutritionGoal).toMatchObject({ calorieTarget: 2136, addBackExercise: true });
  });

  test('raises an aggressive deficit to the safety floor and flags it', async () => {
    const user = await createUser();
    await HealthProfile.create({
      user: user._id,
      sex: 'female',
      dateOfBirth: dobThirtyYearsAgo(),
      weight: 45,
      height: 150,
      activityLevel: 'sedentary',
    });
    const res = await request(app).put('/api/goals').set(auth(user)).send({ nutrition: { goalMode: 'lose' } });
    expect(res.body.nutritionGoal).toMatchObject({ calorieTarget: 1200, floorApplied: true });
  });

  test('without enough profile data it saves preferences but no target', async () => {
    const user = await createUser();
    const res = await request(app).put('/api/goals').set(auth(user)).send({
      nutrition: { goalMode: 'lose', dietPreset: 'vegan' },
    });
    expect(res.status).toBe(200);
    expect(res.body.nutritionGoal.calorieTarget).toBeUndefined();
    expect(res.body.nutritionGoal.dietPreset).toBe('vegan');
    expect(res.body.energy.missing.length).toBeGreaterThan(0);
  });
});

describe('PUT /api/goals — validation', () => {
  test.each([
    ['step goal too low', { fitness: { dailyStepGoal: 5 } }],
    ['unknown goal type', { fitness: { goalType: 'bulk' } }],
    ['unknown diet preset', { nutrition: { dietPreset: 'carnivore' } }],
    ['calorie target too low', { nutrition: { calorieTarget: 100 } }],
    ['macro split not summing to 100', { nutrition: { macroSplit: { carbsPct: 50, proteinPct: 50, fatPct: 50 } } }],
    ['macro split missing a field', { nutrition: { macroSplit: { carbsPct: 50, proteinPct: 50 } } }],
    ['non-boolean addBackExercise', { nutrition: { addBackExercise: 'maybe' } }],
  ])('rejects %s', async (_label, body) => {
    const user = await createUser();
    const res = await request(app).put('/api/goals').set(auth(user)).send(body);
    expect(res.status).toBe(400);
  });

  test('ignores fields outside the whitelist', async () => {
    const user = await createUser();
    const other = await createUser();
    await request(app).put('/api/goals').set(auth(user)).send({
      nutrition: { goalMode: 'maintain', user: other._id, calorieTargetIsCustom: true },
    });
    const stored = await NutritionGoal.findOne({ user: user._id });
    expect(stored).not.toBeNull();
    expect(await NutritionGoal.findOne({ user: other._id })).toBeNull();
    expect(stored.calorieTargetIsCustom).toBe(false);
  });
});

describe('dependent scoping', () => {
  test('a dependent has separate goals from the account owner', async () => {
    const user = await createUser();
    const kid = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });
    await request(app).put('/api/goals').set(auth(user)).send({ fitness: { dailyStepGoal: 15000 } });
    await request(app).put('/api/goals').set(auth(user)).send({ dependent: String(kid._id), fitness: { dailyStepGoal: 6000 } });

    const self = await request(app).get('/api/goals').set(auth(user));
    const dep = await request(app).get('/api/goals').query({ dependent: String(kid._id) }).set(auth(user));
    expect(self.body.fitnessGoal.dailyStepGoal).toBe(15000);
    expect(dep.body.fitnessGoal.dailyStepGoal).toBe(6000);
  });

  test("404s for someone else's dependent", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const kid = await Dependent.create({ owner: owner._id, name: 'Kiddo', relationship: 'child' });
    const get = await request(app).get('/api/goals').query({ dependent: String(kid._id) }).set(auth(intruder));
    const put = await request(app).put('/api/goals').set(auth(intruder)).send({
      dependent: String(kid._id), fitness: { dailyStepGoal: 9000 },
    });
    expect(get.status).toBe(404);
    expect(put.status).toBe(404);
  });
});

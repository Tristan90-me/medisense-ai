// Integration tests for /api/dashboard (routes/dashboard.js -> controllers/dashboardController.js -> utils/dailyDashboard.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const HealthProfile = require('../models/HealthProfile');
const MealLog = require('../models/MealLog');
const WaterIntake = require('../models/WaterIntake');
const WorkoutLog = require('../models/WorkoutLog');
const StepDay = require('../models/StepDay');

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

describe('GET /api/dashboard/today', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/dashboard/today');
    expect(res.status).toBe(401);
  });

  test('an empty day returns zeros and no nutrition score', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/dashboard/today').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.steps).toMatchObject({ count: 0, goal: null });
    expect(res.body.workouts).toMatchObject({ count: 0, caloriesBurned: 0 });
    expect(res.body.water).toMatchObject({ totalMl: 0, goalMl: null });
    expect(res.body.energy).toMatchObject({ goal: null, consumed: 0, budget: null });
    expect(res.body.nutritionScore.score).toBeNull();
  });

  test('a fully populated day computes the ledger and nutrition score correctly', async () => {
    const user = await createUser();
    await request(app).put('/api/goals').set(auth(user)).send({
      fitness: { dailyStepGoal: 8000 },
      nutrition: { calorieTarget: 2000, waterGoalMl: 2000 },
    });
    const dateStr = '2026-01-15';

    await MealLog.create({
      user: user._id, mealType: 'lunch', kind: 'quick_add', name: 'Lunch', nutrition: { calories: 800, proteinG: 40 }, loggedAt: new Date(`${dateStr}T12:00:00.000Z`),
    });
    await MealLog.create({
      user: user._id, mealType: 'dinner', kind: 'quick_add', name: 'Dinner', nutrition: { calories: 700, proteinG: 30 }, loggedAt: new Date(`${dateStr}T19:00:00.000Z`),
    });
    await WaterIntake.create({ user: user._id, amountMl: 1000, loggedAt: new Date(`${dateStr}T10:00:00.000Z`) });
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'Session', durationMin: 30, caloriesBurned: 200, loggedAt: new Date(`${dateStr}T08:00:00.000Z`),
    });
    await StepDay.create({
      user: user._id, date: dateStr, steps: 5000, distanceKm: 3.5, caloriesBurned: 150,
    });

    const res = await request(app).get('/api/dashboard/today').query({ date: dateStr }).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(dateStr);
    expect(res.body.steps).toMatchObject({ count: 5000, goal: 8000 });
    expect(res.body.workouts).toMatchObject({ count: 1, caloriesBurned: 200 });
    expect(res.body.water).toMatchObject({ totalMl: 1000, goalMl: 2000 });
    expect(res.body.nutrition.consumed.calories).toBe(1500);
    expect(res.body.energy).toMatchObject({
      goal: 2000, consumed: 1500, burnedFromSteps: 150, burnedFromWorkouts: 200, burnedTotal: 350, budget: 2000, remaining: 500, over: false,
    });
    expect(res.body.nutritionScore.score).toBeGreaterThan(0);
  });

  test('addBackExercise grows the calorie budget by what was burned', async () => {
    const user = await createUser();
    await request(app).put('/api/goals').set(auth(user)).send({
      nutrition: { calorieTarget: 2000, addBackExercise: true },
    });
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'Session', durationMin: 30, caloriesBurned: 300,
    });

    const res = await request(app).get('/api/dashboard/today').set(auth(user));
    expect(res.body.energy.budget).toBe(2300);
  });

  test('rejects a malformed date', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/dashboard/today').query({ date: 'not-a-date' }).set(auth(user));
    expect(res.status).toBe(400);
  });

  test('scopes to a dependent separately from the account owner', async () => {
    const user = await createUser();
    const kid = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });
    await MealLog.create({
      user: user._id, dependent: kid._id, mealType: 'lunch', kind: 'quick_add', name: 'Kid lunch', nutrition: { calories: 400 },
    });

    const self = await request(app).get('/api/dashboard/today').set(auth(user));
    const dep = await request(app).get('/api/dashboard/today').query({ dependent: String(kid._id) }).set(auth(user));
    expect(self.body.nutrition.consumed.calories).toBe(0);
    expect(dep.body.nutrition.consumed.calories).toBe(400);
  });
});

describe('GET /api/dashboard/weekly', () => {
  test('averages the last 7 days and lists a per-day breakdown', async () => {
    const user = await createUser();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await MealLog.create({
      user: user._id, mealType: 'lunch', kind: 'quick_add', name: 'A', nutrition: { calories: 1400 }, loggedAt: new Date(`${todayStr}T12:00:00.000Z`),
    });
    await MealLog.create({
      user: user._id, mealType: 'lunch', kind: 'quick_add', name: 'B', nutrition: { calories: 700 }, loggedAt: new Date(`${yesterday}T12:00:00.000Z`),
    });

    const res = await request(app).get('/api/dashboard/weekly').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(7);
    expect(res.body.rangeEnd).toBe(todayStr);
    expect(res.body.avgCaloriesConsumed).toBe(300); // (1400 + 700) / 7
    expect(res.body.days[6]).toMatchObject({ date: todayStr, caloriesConsumed: 1400 });
    expect(res.body.days[5]).toMatchObject({ date: yesterday, caloriesConsumed: 700 });
  });
});

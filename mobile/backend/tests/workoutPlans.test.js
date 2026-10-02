// Integration tests for /api/workout-plans (routes/workoutPlans.js -> controllers/workoutPlanController.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Exercise = require('../models/Exercise');
const WorkoutPlan = require('../models/WorkoutPlan');

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
const makeExercise = (name = 'Bench Press') => Exercise.create({ name, category: 'chest', source: 'custom' });

describe('POST /api/workout-plans', () => {
  test('creates a multi-day plan', async () => {
    const user = await createUser();
    const bench = await makeExercise();

    const res = await request(app).post('/api/workout-plans').set(auth(user)).send({
      name: '3-Day Split',
      days: [
        { dayNumber: 1, label: 'Push', exercises: [{ exercise: bench._id, targetSets: 3, targetReps: 10 }] },
        { dayNumber: 2, label: 'Rest', isRestDay: true },
        { dayNumber: 3, label: 'Pull', exercises: [] },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.plan.days).toHaveLength(3);
    expect(res.body.plan.days[1].isRestDay).toBe(true);
  });

  test('rejects a plan with no days', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/workout-plans').set(auth(user)).send({ name: 'Empty', days: [] });
    expect(res.status).toBe(400);
  });

  test('rejects a day referencing an unknown exercise', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/workout-plans').set(auth(user)).send({
      name: 'Broken',
      days: [{ dayNumber: 1, exercises: [{ exercise: '507f1f77bcf86cd799439011' }] }],
    });
    expect(res.status).toBe(400);
    expect(await WorkoutPlan.countDocuments()).toBe(0);
  });
});

describe('GET /api/workout-plans and /:id', () => {
  test('lists only the requester\'s own plans', async () => {
    const user = await createUser();
    const other = await createUser();
    const bench = await makeExercise();
    await WorkoutPlan.create({ user: user._id, name: 'Mine', days: [{ dayNumber: 1, exercises: [{ exercise: bench._id }] }] });
    await WorkoutPlan.create({ user: other._id, name: 'Theirs', days: [{ dayNumber: 1, exercises: [{ exercise: bench._id }] }] });

    const res = await request(app).get('/api/workout-plans').set(auth(user));
    expect(res.body.plans).toHaveLength(1);
    expect(res.body.plans[0].name).toBe('Mine');
  });

  test("404s reading someone else's plan", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const bench = await makeExercise();
    const plan = await WorkoutPlan.create({ user: owner._id, name: 'Private', days: [{ dayNumber: 1, exercises: [{ exercise: bench._id }] }] });

    const res = await request(app).get(`/api/workout-plans/${plan._id}`).set(auth(intruder));
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/workout-plans/:id', () => {
  test('updates a plan the requester owns', async () => {
    const user = await createUser();
    const bench = await makeExercise();
    const plan = await WorkoutPlan.create({ user: user._id, name: 'Original', days: [{ dayNumber: 1, exercises: [{ exercise: bench._id }] }] });

    const res = await request(app).put(`/api/workout-plans/${plan._id}`).set(auth(user)).send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.plan.name).toBe('Renamed');
  });

  test('rejects updating days to reference an unknown exercise, without persisting it', async () => {
    const user = await createUser();
    const bench = await makeExercise();
    const plan = await WorkoutPlan.create({ user: user._id, name: 'Original', days: [{ dayNumber: 1, exercises: [{ exercise: bench._id }] }] });

    const res = await request(app).put(`/api/workout-plans/${plan._id}`).set(auth(user)).send({
      days: [{ dayNumber: 1, exercises: [{ exercise: '507f1f77bcf86cd799439011' }] }],
    });
    expect(res.status).toBe(400);
    const stored = await WorkoutPlan.findById(plan._id);
    expect(String(stored.days[0].exercises[0].exercise)).toBe(String(bench._id));
  });

  test("404s updating someone else's plan", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const bench = await makeExercise();
    const plan = await WorkoutPlan.create({ user: owner._id, name: 'Private', days: [{ dayNumber: 1, exercises: [{ exercise: bench._id }] }] });

    const res = await request(app).put(`/api/workout-plans/${plan._id}`).set(auth(intruder)).send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/workout-plans/:id', () => {
  test('deletes a plan the requester owns', async () => {
    const user = await createUser();
    const bench = await makeExercise();
    const plan = await WorkoutPlan.create({ user: user._id, name: 'Delete me', days: [{ dayNumber: 1, exercises: [{ exercise: bench._id }] }] });

    const res = await request(app).delete(`/api/workout-plans/${plan._id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(await WorkoutPlan.findById(plan._id)).toBeNull();
  });
});

// Integration tests for /api/steps (routes/steps.js -> controllers/stepController.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
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

describe('POST /api/steps', () => {
  test('creates a step day, computing distance and calories from the profile', async () => {
    const user = await createUser();
    await HealthProfile.create({
      user: user._id, weight: 70, weightUnit: 'kg', height: 175, heightUnit: 'cm',
    });

    const res = await request(app).post('/api/steps').set(auth(user)).send({ steps: 10000, date: '2026-01-15' });
    expect(res.status).toBe(201);
    expect(res.body.stepDay).toMatchObject({ date: '2026-01-15', steps: 10000 });
    expect(res.body.stepDay.distanceKm).toBeGreaterThan(0);
    expect(res.body.stepDay.caloriesBurned).toBeGreaterThan(0);
  });

  test('resyncing the same day overwrites rather than adds', async () => {
    const user = await createUser();
    await request(app).post('/api/steps').set(auth(user)).send({ steps: 3000, date: '2026-01-15' });
    const res = await request(app).post('/api/steps').set(auth(user)).send({ steps: 8000, date: '2026-01-15' });

    expect(res.body.stepDay.steps).toBe(8000);
    expect(await StepDay.countDocuments({ user: user._id, date: '2026-01-15' })).toBe(1);
  });

  test('distance/calories are 0 when the profile is incomplete', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/steps').set(auth(user)).send({ steps: 5000 });
    expect(res.body.stepDay.distanceKm).toBe(0);
    expect(res.body.stepDay.caloriesBurned).toBe(0);
  });

  test('rejects a negative step count', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/steps').set(auth(user)).send({ steps: -1 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/steps', () => {
  test('defaults to today and returns zeros when nothing has synced yet', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/steps').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.stepDay).toMatchObject({ steps: 0, distanceKm: 0, caloriesBurned: 0 });
  });

  test('a specific date returns that day\'s synced total', async () => {
    const user = await createUser();
    await request(app).post('/api/steps').set(auth(user)).send({ steps: 4000, date: '2026-01-10' });
    const res = await request(app).get('/api/steps').query({ date: '2026-01-10' }).set(auth(user));
    expect(res.body.stepDay.steps).toBe(4000);
  });
});

describe('GET /api/steps/range', () => {
  test('returns recent days oldest-first', async () => {
    const user = await createUser();
    await request(app).post('/api/steps').set(auth(user)).send({ steps: 1000, date: '2026-01-01' });
    await request(app).post('/api/steps').set(auth(user)).send({ steps: 2000, date: '2026-01-02' });
    await request(app).post('/api/steps').set(auth(user)).send({ steps: 3000, date: '2026-01-03' });

    const res = await request(app).get('/api/steps/range').query({ days: 2 }).set(auth(user));
    expect(res.body.stepDays).toHaveLength(2);
    expect(res.body.stepDays[0].date).toBe('2026-01-02');
    expect(res.body.stepDays[1].date).toBe('2026-01-03');
  });
});

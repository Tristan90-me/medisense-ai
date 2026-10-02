// Integration tests for /api/body-metrics (routes/bodyMetrics.js -> controllers/bodyMetricController.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const BodyMetric = require('../models/BodyMetric');

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

describe('POST /api/body-metrics', () => {
  test('logs a weight-only check-in', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/body-metrics').set(auth(user)).send({ weightKg: 75 });
    expect(res.status).toBe(201);
    expect(res.body.metric.weightKg).toBe(75);
  });

  test('logs a measurements-only check-in', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/body-metrics').set(auth(user)).send({
      measurements: { waistCm: 80 },
    });
    expect(res.status).toBe(201);
    expect(res.body.metric.measurements.waistCm).toBe(80);
  });

  test('rejects a completely empty check-in', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/body-metrics').set(auth(user)).send({});
    expect(res.status).toBe(400);
  });

  test('rejects an out-of-range body fat percentage', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/body-metrics').set(auth(user)).send({ bodyFatPct: 150 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/body-metrics', () => {
  test('returns history most-recent-first', async () => {
    const user = await createUser();
    await BodyMetric.create({ user: user._id, weightKg: 80, loggedAt: new Date('2026-01-01') });
    await BodyMetric.create({ user: user._id, weightKg: 78, loggedAt: new Date('2026-01-05') });

    const res = await request(app).get('/api/body-metrics').set(auth(user));
    expect(res.body.metrics).toHaveLength(2);
    expect(res.body.metrics[0].weightKg).toBe(78);
  });
});

describe('GET /api/body-metrics/latest', () => {
  test('computes BMI from the latest weight and the profile height', async () => {
    const user = await createUser();
    await HealthProfile.create({ user: user._id, height: 175, heightUnit: 'cm' });
    await BodyMetric.create({ user: user._id, weightKg: 70, loggedAt: new Date('2026-01-01') });
    await BodyMetric.create({ user: user._id, weightKg: 68, loggedAt: new Date('2026-01-05') });

    const res = await request(app).get('/api/body-metrics/latest').set(auth(user));
    expect(res.body.latest.weightKg).toBe(68);
    expect(res.body.bmi).toBe(22.2); // 68 / 1.75^2
  });

  test('falls back to the profile\'s own weight when no metric has one yet', async () => {
    const user = await createUser();
    await HealthProfile.create({
      user: user._id, height: 175, heightUnit: 'cm', weight: 70, weightUnit: 'kg',
    });

    const res = await request(app).get('/api/body-metrics/latest').set(auth(user));
    expect(res.body.latest).toBeNull();
    expect(res.body.bmi).toBe(22.9);
  });
});

describe('DELETE /api/body-metrics/:id', () => {
  test("404s deleting someone else's entry", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const metric = await BodyMetric.create({ user: owner._id, weightKg: 75 });

    const res = await request(app).delete(`/api/body-metrics/${metric._id}`).set(auth(intruder));
    expect(res.status).toBe(404);
    expect(await BodyMetric.findById(metric._id)).not.toBeNull();
  });
});

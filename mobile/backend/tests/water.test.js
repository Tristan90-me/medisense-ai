// Integration tests for /api/water (routes/water.js -> controllers/waterController.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const WaterIntake = require('../models/WaterIntake');

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

describe('POST /api/water', () => {
  test('logs a water intake event', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/water').set(auth(user)).send({ amountMl: 250 });
    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({ amountMl: 250 });
  });

  test('rejects an amount outside 1-5000ml', async () => {
    const user = await createUser();
    const tooMuch = await request(app).post('/api/water').set(auth(user)).send({ amountMl: 6000 });
    const tooLittle = await request(app).post('/api/water').set(auth(user)).send({ amountMl: 0 });
    expect(tooMuch.status).toBe(400);
    expect(tooLittle.status).toBe(400);
  });

  test("404s logging against someone else's dependent", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const kid = await Dependent.create({ owner: owner._id, name: 'Kiddo', relationship: 'child' });

    const res = await request(app).post('/api/water').set(auth(intruder)).send({ amountMl: 250, dependent: String(kid._id) });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/water', () => {
  test('defaults to today and sums the day\'s intake', async () => {
    const user = await createUser();
    await request(app).post('/api/water').set(auth(user)).send({ amountMl: 250 });
    await request(app).post('/api/water').set(auth(user)).send({ amountMl: 500 });

    const res = await request(app).get('/api/water').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.totalMl).toBe(750);
  });

  test('a specific date only returns that day\'s entries', async () => {
    const user = await createUser();
    await WaterIntake.create({ user: user._id, amountMl: 250, loggedAt: new Date('2026-01-01T08:00:00.000Z') });
    await WaterIntake.create({ user: user._id, amountMl: 250, loggedAt: new Date('2026-01-02T08:00:00.000Z') });

    const res = await request(app).get('/api/water').query({ date: '2026-01-01' }).set(auth(user));
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.totalMl).toBe(250);
  });

  test('a dependent\'s water log is separate from the account owner\'s', async () => {
    const user = await createUser();
    const kid = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });
    await request(app).post('/api/water').set(auth(user)).send({ amountMl: 250 });
    await request(app).post('/api/water').set(auth(user)).send({ amountMl: 100, dependent: String(kid._id) });

    const self = await request(app).get('/api/water').set(auth(user));
    const dep = await request(app).get('/api/water').query({ dependent: String(kid._id) }).set(auth(user));
    expect(self.body.totalMl).toBe(250);
    expect(dep.body.totalMl).toBe(100);
  });
});

describe('DELETE /api/water/:id', () => {
  test('deletes a water log entry the requester owns', async () => {
    const user = await createUser();
    const logged = await request(app).post('/api/water').set(auth(user)).send({ amountMl: 250 });

    const res = await request(app).delete(`/api/water/${logged.body.entry._id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(await WaterIntake.findById(logged.body.entry._id)).toBeNull();
  });

  test("404s deleting someone else's water log entry", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const logged = await request(app).post('/api/water').set(auth(owner)).send({ amountMl: 250 });

    const res = await request(app).delete(`/api/water/${logged.body.entry._id}`).set(auth(intruder));
    expect(res.status).toBe(404);
    expect(await WaterIntake.findById(logged.body.entry._id)).not.toBeNull();
  });
});

// Integration tests for /api/exercises (routes/exercises.js -> controllers/exerciseController.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Exercise = require('../models/Exercise');

beforeAll(async () => {
  await Exercise.init();
});

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

describe('GET /api/exercises', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/exercises');
    expect(res.status).toBe(401);
  });

  test('lists the seeded library when no filters are given', async () => {
    const user = await createUser();
    await Exercise.create({ name: 'Bench Press', category: 'chest', source: 'custom' });
    await Exercise.create({ name: 'Back Squat', category: 'legs', source: 'custom' });

    const res = await request(app).get('/api/exercises').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.exercises).toHaveLength(2);
  });

  test('filters by category', async () => {
    const user = await createUser();
    await Exercise.create({ name: 'Bench Press', category: 'chest', source: 'custom' });
    await Exercise.create({ name: 'Back Squat', category: 'legs', source: 'custom' });

    const res = await request(app).get('/api/exercises').query({ category: 'legs' }).set(auth(user));
    expect(res.body.exercises).toHaveLength(1);
    expect(res.body.exercises[0].name).toBe('Back Squat');
  });

  test('rejects an invalid category', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/exercises').query({ category: 'not-a-real-category' }).set(auth(user));
    expect(res.status).toBe(400);
  });

  test('full-text searches by name', async () => {
    const user = await createUser();
    await Exercise.create({ name: 'Barbell Bench Press', category: 'chest', source: 'custom' });
    await Exercise.create({ name: 'Back Squat', category: 'legs', source: 'custom' });

    const res = await request(app).get('/api/exercises').query({ q: 'bench' }).set(auth(user));
    expect(res.body.exercises.some((e) => e.name === 'Barbell Bench Press')).toBe(true);
    expect(res.body.exercises.some((e) => e.name === 'Back Squat')).toBe(false);
  });
});

describe('GET /api/exercises/:id', () => {
  test('returns the exercise', async () => {
    const user = await createUser();
    const exercise = await Exercise.create({ name: 'Pull-Up', category: 'back', source: 'custom' });
    const res = await request(app).get(`/api/exercises/${exercise._id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.exercise.name).toBe('Pull-Up');
  });

  test('404s for a nonexistent exercise', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/exercises/507f1f77bcf86cd799439011').set(auth(user));
    expect(res.status).toBe(404);
  });
});

// Integration tests for /api/insights (routes/insights.js -> controllers/insightController.js).
// utils/gemini is fully mocked — same pattern as tests/photoLog.test.js — so
// these say nothing about whether a live Gemini call would succeed, only
// that the controller wires request/response correctly around it.
jest.mock('../utils/gemini', () => ({
  chat: jest.fn(),
  chatStream: jest.fn(),
  generateSummary: jest.fn(),
  parseAIResponse: jest.fn(),
  analyzePhoto: jest.fn(),
  analyzeMeal: jest.fn(),
  suggestFromEnergyContext: jest.fn(),
  dailyTip: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const {
  analyzeMeal, suggestFromEnergyContext, dailyTip,
} = require('../utils/gemini');

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

const FAKE_JPEG = Buffer.from('fake-jpeg-bytes-not-a-real-image');

const MOCK_ESTIMATE = {
  description: 'A plate of grilled chicken, rice, and broccoli.',
  identifiedFoods: ['grilled chicken breast', 'white rice', 'broccoli'],
  estimatedNutrition: {
    calories: 550, carbsG: 55, proteinG: 40, fatG: 15,
  },
  confidence: 'moderate',
};

describe('POST /api/insights/estimate-meal-photo', () => {
  beforeEach(() => analyzeMeal.mockReset());

  test('returns the estimate without creating a meal log', async () => {
    const user = await createUser();
    analyzeMeal.mockResolvedValue(MOCK_ESTIMATE);

    const res = await request(app)
      .post('/api/insights/estimate-meal-photo')
      .set(auth(user))
      .field('context', 'with extra rice')
      .attach('photo', FAKE_JPEG, { filename: 'meal.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.estimate).toEqual(MOCK_ESTIMATE);
    expect(analyzeMeal).toHaveBeenCalledTimes(1);
    const [bufferArg, mimeArg, contextArg] = analyzeMeal.mock.calls[0];
    expect(Buffer.isBuffer(bufferArg)).toBe(true);
    expect(mimeArg).toBe('image/jpeg');
    expect(contextArg).toBe('with extra rice');
  });

  test('requires a file', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/insights/estimate-meal-photo').set(auth(user));
    expect(res.status).toBe(400);
    expect(analyzeMeal).not.toHaveBeenCalled();
  });

  test('rejects a non-image file', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/insights/estimate-meal-photo')
      .set(auth(user))
      .attach('photo', Buffer.from('not an image'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/insights/suggestion', () => {
  beforeEach(() => suggestFromEnergyContext.mockReset());

  test('defaults to kind=meal and passes today\'s ledger to Gemini', async () => {
    const user = await createUser();
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'Run', durationMin: 30, caloriesBurned: 200,
    });
    suggestFromEnergyContext.mockResolvedValue('A protein-rich snack would round out your day nicely.');

    const res = await request(app).get('/api/insights/suggestion').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ kind: 'meal', suggestion: 'A protein-rich snack would round out your day nicely.' });
    const [ledgerArg, kindArg] = suggestFromEnergyContext.mock.calls[0];
    expect(kindArg).toBe('meal');
    expect(ledgerArg.burnedFromWorkouts).toBe(200);
  });

  test('kind=workout is passed through', async () => {
    const user = await createUser();
    suggestFromEnergyContext.mockResolvedValue('A light walk would be a good fit today.');
    const res = await request(app).get('/api/insights/suggestion').query({ kind: 'workout' }).set(auth(user));
    expect(res.body.kind).toBe('workout');
    expect(suggestFromEnergyContext.mock.calls[0][1]).toBe('workout');
  });

  test('rejects an invalid kind', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/insights/suggestion').query({ kind: 'dessert' }).set(auth(user));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/insights/tip', () => {
  test('returns the generated tip', async () => {
    const user = await createUser();
    dailyTip.mockResolvedValue('A five-minute walk after a meal can help you feel less sluggish.');
    const res = await request(app).get('/api/insights/tip').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.tip).toBe('A five-minute walk after a meal can help you feel less sluggish.');
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/insights/tip');
    expect(res.status).toBe(401);
  });
});

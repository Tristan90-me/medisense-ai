// Integration tests for GET /api/ai/weekly-summary (controllers/aiController.js
// getWeeklySummary). utils/gemini is mocked so the narrative text itself is
// controlled per test — what's actually under test here is the real-data
// aggregation (session count/trend/symptoms, medication adherence, health
// score delta) and the per-(user,dependent) daily cache.
jest.mock('../utils/gemini', () => ({
  chat: jest.fn(),
  chatStream: jest.fn(),
  generateSummary: jest.fn(),
  generateWeeklySummary: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const Session = require('../models/Session');
const Medication = require('../models/Medication');
const HealthScore = require('../models/HealthScore');
const WeeklySummary = require('../models/WeeklySummary');
const { generateWeeklySummary } = require('../utils/gemini');

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY_MS);

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

function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Session's `timestamps: true` option marks createdAt immutable, which
// mongoose's query casting silently strips from a normal updateOne — go
// through the raw driver collection to actually backdate it for the test.
async function setCreatedAt(Model, id, date) {
  await Model.collection.updateOne({ _id: id }, { $set: { createdAt: date } });
}

describe('GET /api/ai/weekly-summary', () => {
  beforeEach(() => {
    generateWeeklySummary.mockReset();
  });

  test('no tracked data this week returns a canned message without calling the LLM', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/ai/weekly-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatch(/nothing tracked/i);
    expect(res.body.stats.sessionCount).toBe(0);
    expect(generateWeeklySummary).not.toHaveBeenCalled();
  });

  test('sessions this week produce real stats and call the LLM with them', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    generateWeeklySummary.mockResolvedValue('Your week recap text.');

    await Session.create({
      user: user._id, status: 'completed', severityScore: 6, severityLevel: 'Moderate',
      symptoms: [{ name: 'headache' }],
    });
    await Session.create({
      user: user._id, status: 'completed', severityScore: 4, severityLevel: 'Low',
      symptoms: [{ name: 'headache' }],
    });

    const res = await request(app)
      .get('/api/ai/weekly-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Your week recap text.');
    expect(res.body.stats.sessionCount).toBe(2);
    expect(res.body.stats.avgSeverity).toBe(5);
    expect(res.body.stats.topSymptoms).toEqual(['headache']);
    expect(generateWeeklySummary).toHaveBeenCalledTimes(1);

    const saved = await WeeklySummary.findOne({ user: user._id, dependent: null });
    expect(saved.text).toBe('Your week recap text.');
  });

  test('a worsening severity trend compares against the prior 7-day window', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    generateWeeklySummary.mockResolvedValue('recap');

    const prev = await Session.create({ user: user._id, status: 'completed', severityScore: 2 });
    await setCreatedAt(Session, prev._id, daysAgo(10));
    await Session.create({ user: user._id, status: 'completed', severityScore: 8 });

    const res = await request(app)
      .get('/api/ai/weekly-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.trend).toBe('worsening');
  });

  test('medication adherence is aggregated across active medications', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    generateWeeklySummary.mockResolvedValue('recap');

    const med = await Medication.create({
      user: user._id,
      name: 'Amoxicillin',
      active: true,
      reminderTimes: ['08:00'],
      startDate: daysAgo(7),
      doseLog: [{ takenAt: daysAgo(1) }, { takenAt: daysAgo(2) }],
    });
    // computeAdherence also bounds its window by the record's own createdAt
    // (never counts days "before" the medication existed) — backdate it to
    // match startDate, same as a medication genuinely added a week ago.
    await setCreatedAt(Medication, med._id, daysAgo(7));

    const res = await request(app)
      .get('/api/ai/weekly-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.adherencePercentage).not.toBeNull();
    expect(res.body.stats.adherencePercentage).toBeGreaterThan(0);
  });

  test('health score delta compares current score against the entry from a week ago', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    generateWeeklySummary.mockResolvedValue('recap');

    await HealthScore.create({
      user: user._id,
      dependent: null,
      currentScore: 80,
      history: [{ date: daysAgo(10), score: 60 }],
    });
    // Need at least one real signal besides the score history itself for
    // hasAnyData to trigger the LLM call — a session this week suffices.
    await Session.create({ user: user._id, status: 'completed', severityScore: 3 });

    const res = await request(app)
      .get('/api/ai/weekly-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.scoreDelta).toBe(20);
  });

  test('caches the result and does not re-call the LLM within 24 hours', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    generateWeeklySummary.mockResolvedValue('first recap');
    await Session.create({ user: user._id, status: 'completed', severityScore: 5 });

    const first = await request(app)
      .get('/api/ai/weekly-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(first.body.cached).toBe(false);

    const second = await request(app)
      .get('/api/ai/weekly-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(second.body.summary).toBe('first recap');
    expect(generateWeeklySummary).toHaveBeenCalledTimes(1);
  });

  test('refresh=true forces regeneration even with a fresh cache', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    generateWeeklySummary.mockResolvedValueOnce('first recap').mockResolvedValueOnce('second recap');
    await Session.create({ user: user._id, status: 'completed', severityScore: 5 });

    await request(app).get('/api/ai/weekly-summary').set('Authorization', `Bearer ${token}`);

    const refreshed = await request(app)
      .get('/api/ai/weekly-summary?refresh=true')
      .set('Authorization', `Bearer ${token}`);

    expect(refreshed.body.cached).toBe(false);
    expect(refreshed.body.summary).toBe('second recap');
    expect(generateWeeklySummary).toHaveBeenCalledTimes(2);
  });

  test("rejects a dependent id that does not belong to the requesting user", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const dependent = await Dependent.create({ owner: owner._id, name: 'Sam', relationship: 'sibling' });

    const res = await request(app)
      .get(`/api/ai/weekly-summary?dependent=${dependent._id}`)
      .set('Authorization', `Bearer ${tokenFor(stranger)}`);

    expect(res.status).toBe(404);
  });
});

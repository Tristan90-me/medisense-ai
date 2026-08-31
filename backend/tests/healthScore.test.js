// Integration tests for GET /api/health-score (routes/healthScore.js ->
// controllers/healthScoreController.js). Nothing here calls email or
// Gemini, so nothing needs mocking.
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const Session = require('../models/Session');
const HealthProfile = require('../models/HealthProfile');
const Medication = require('../models/Medication');
const HealthScore = require('../models/HealthScore');
const jwt = require('jsonwebtoken');

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

describe('GET /api/health-score', () => {
  test('a fresh user with no data gets the no-critical-flag baseline score and no achievements', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/health-score')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.healthScore.currentScore).toBe(10);
    expect(res.body.healthScore.breakdown.noCriticalFlagScore).toBe(10);
    expect(res.body.healthScore.unlockedAchievements).toHaveLength(0);
    expect(res.body.healthScore.history).toHaveLength(1);
    expect(res.body.healthScore.dependent).toBeNull();
  });

  test('a fully engaged user (complete profile, frequent completed sessions, an active medication, no critical flags) unlocks the corresponding achievements', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    await HealthProfile.create({
      user: user._id,
      dependent: null,
      dateOfBirth: new Date('1990-01-01'),
      sex: 'female',
      weight: 65,
      height: 170,
      bloodType: 'O+',
      preExistingConditions: ['asthma'],
      allergies: ['pollen'],
      currentMedications: ['inhaler'],
      familyHistory: ['diabetes'],
      smokingStatus: 'former',
      alcoholUse: 'occasional',
      onboardingComplete: true,
    });

    await Promise.all(
      Array.from({ length: 4 }).map(() => Session.create({ user: user._id, status: 'completed' }))
    );

    await Medication.create({ user: user._id, name: 'Ibuprofen', active: true });

    const res = await request(app)
      .get('/api/health-score')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const unlockedIds = res.body.healthScore.unlockedAchievements.map((a) => a.id);
    expect(unlockedIds).toEqual(expect.arrayContaining([
      'first_checkin', 'profile_complete', 'consistent_tracker', 'medication_manager', 'clean_bill',
    ]));
    expect(res.body.healthScore.breakdown.profileCompletenessScore).toBe(30);
  });

  test('achievement unlocking is idempotent across repeat calls — no duplicates, unlockedAt preserved', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await Session.create({ user: user._id, status: 'completed' });

    const first = await request(app)
      .get('/api/health-score')
      .set('Authorization', `Bearer ${token}`);
    const firstUnlock = first.body.healthScore.unlockedAchievements.find((a) => a.id === 'first_checkin');
    expect(firstUnlock).toBeTruthy();

    const second = await request(app)
      .get('/api/health-score')
      .set('Authorization', `Bearer ${token}`);

    const ids = second.body.healthScore.unlockedAchievements.map((a) => a.id);
    const counts = {};
    ids.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    Object.values(counts).forEach((count) => expect(count).toBe(1));

    const secondUnlock = second.body.healthScore.unlockedAchievements.find((a) => a.id === 'first_checkin');
    expect(new Date(secondUnlock.unlockedAt).getTime()).toBe(new Date(firstUnlock.unlockedAt).getTime());
  });

  test('history grows by exactly one entry per call', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    await request(app).get('/api/health-score').set('Authorization', `Bearer ${token}`);
    const second = await request(app).get('/api/health-score').set('Authorization', `Bearer ${token}`);
    expect(second.body.healthScore.history).toHaveLength(2);
  });

  test('history is capped at the most recent 90 entries, FIFO', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    // Pre-seed 90 history entries directly, oldest (score 0) first.
    const history = Array.from({ length: 90 }, (_, i) => ({
      date: new Date(Date.now() - (90 - i) * 24 * 60 * 60 * 1000),
      score: i,
    }));
    await HealthScore.create({
      user: user._id, dependent: null, currentScore: 89, history, unlockedAchievements: [],
    });

    const res = await request(app)
      .get('/api/health-score')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.healthScore.history).toHaveLength(90);
    const scores = res.body.healthScore.history.map((h) => h.score);
    expect(scores).not.toContain(0); // the oldest entry was dropped
    expect(scores[0]).toBe(1); // former index 1 is now the oldest survivor
  });

  test("?dependent=<id> not owned by the caller returns 404", async () => {
    const userA = await createUser({ email: 'a@example.com' });
    const userB = await createUser({ email: 'b@example.com' });
    const tokenB = tokenFor(userB);
    const dependentA = await Dependent.create({ owner: userA._id, name: "A's Kid", relationship: 'child' });

    const res = await request(app)
      .get(`/api/health-score?dependent=${dependentA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test("a dependent's health score is tracked separately from the account owner's own score", async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });

    await Session.create({ user: user._id, dependent: null, status: 'completed' });
    await Session.create({ user: user._id, dependent: dependent._id, status: 'completed' });
    await Session.create({ user: user._id, dependent: dependent._id, status: 'completed' });

    const selfRes = await request(app)
      .get('/api/health-score')
      .set('Authorization', `Bearer ${token}`);
    const depRes = await request(app)
      .get(`/api/health-score?dependent=${dependent._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(selfRes.body.healthScore.dependent).toBeNull();
    expect(depRes.body.healthScore.dependent).toBe(dependent._id.toString());
    // Self has 1 session in the last 30 days, the dependent has 2 — if the
    // two scores were accidentally sharing one document this would collapse
    // to the same sessionFrequencyScore for both.
    expect(selfRes.body.healthScore.breakdown.sessionFrequencyScore).toBe(5); // min(30, 1*5)
    expect(depRes.body.healthScore.breakdown.sessionFrequencyScore).toBe(10); // min(30, 2*5)
  });

  test('an invalid dependent id is rejected with 400 by the validator', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/health-score?dependent=not-a-valid-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

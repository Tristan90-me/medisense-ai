// Integration tests for GET /api/community/trends — the privacy-floored,
// distinct-user-counted anonymized trend endpoint. No AI/gemini mocking
// needed since sessions are seeded directly rather than driven through the
// chat flow.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

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

// Creates `count` distinct users, each with one session (createdAt override
// supported) containing the given symptom name.
async function seedDistinctUsersWithSymptom(count, symptomName, createdAt = new Date()) {
  const users = [];
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const user = await createUser();
    users.push(user);
    // eslint-disable-next-line no-await-in-loop
    await Session.create({
      user: user._id,
      mode: 'quick',
      status: 'completed',
      symptoms: [{ name: symptomName }],
      createdAt,
    });
  }
  return users;
}

describe('GET /api/community/trends', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/community/trends');
    expect(res.status).toBe(401);
  });

  test('rejects an invalid days value', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/community/trends')
      .query({ days: '14' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('insufficientData: true when total distinct users in the window is below the cohort floor', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await Session.create({
      user: user._id, mode: 'quick', status: 'completed', symptoms: [{ name: 'headache' }],
    });

    const res = await request(app)
      .get('/api/community/trends')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.trends.insufficientData).toBe(true);
    expect(res.body.trends.totalDistinctUsers).toBeNull();
    expect(res.body.trends.topSymptoms).toEqual([]);
  });

  test('a symptom reported by >= 10 distinct users appears with the correct percentage', async () => {
    // 10 users report "headache", 5 more distinct users report unrelated
    // symptoms (below the floor individually) so totalDistinctUsers = 15.
    await seedDistinctUsersWithSymptom(10, 'headache');
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const user = await createUser();
      // eslint-disable-next-line no-await-in-loop
      await Session.create({
        user: user._id, mode: 'quick', status: 'completed', symptoms: [{ name: 'nausea' }],
      });
    }
    const requester = await createUser();
    const token = tokenFor(requester);

    const res = await request(app)
      .get('/api/community/trends')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.trends.insufficientData).toBe(false);
    // 10 (headache) + 5 (nausea) — the requester has no session of their own,
    // so they don't contribute to totalDistinctUsers.
    expect(res.body.trends.totalDistinctUsers).toBe(15);
    const headache = res.body.trends.topSymptoms.find((s) => s.symptom === 'headache');
    expect(headache).toBeDefined();
    expect(headache.userCount).toBe(10);
    expect(headache.percentage).toBe(Math.round((10 / 15) * 1000) / 10);
    // "nausea" has only 5 distinct users — below MIN_COHORT_SIZE — must be absent.
    expect(res.body.trends.topSymptoms.find((s) => s.symptom === 'nausea')).toBeUndefined();
  });

  test('a symptom reported by < 10 distinct users is completely absent, not shown with a low count', async () => {
    await seedDistinctUsersWithSymptom(9, 'sore throat');
    // Pad total distinct users above the floor with unrelated single-symptom users.
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const user = await createUser();
      // eslint-disable-next-line no-await-in-loop
      await Session.create({
        user: user._id, mode: 'quick', status: 'completed', symptoms: [{ name: 'fatigue' }],
      });
    }
    const requester = await createUser();
    const token = tokenFor(requester);

    const res = await request(app)
      .get('/api/community/trends')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.trends.topSymptoms.find((s) => s.symptom === 'sore throat')).toBeUndefined();
  });

  test('a single chatty user cannot inflate their symptom past a contribution of 1', async () => {
    // One user submits 5 sessions all mentioning "headache".
    const chattyUser = await createUser();
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Session.create({
        user: chattyUser._id, mode: 'quick', status: 'completed', symptoms: [{ name: 'Headache' }],
      });
    }
    // 8 other distinct users also report headache — combined with the one
    // chatty user, that's 9 distinct users total, still below the floor of 10.
    await seedDistinctUsersWithSymptom(8, 'headache');
    // Pad total distinct users above the floor overall so insufficientData
    // doesn't mask the assertion.
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const user = await createUser();
      // eslint-disable-next-line no-await-in-loop
      await Session.create({
        user: user._id, mode: 'quick', status: 'completed', symptoms: [{ name: 'dizziness' }],
      });
    }
    const requester = await createUser();
    const token = tokenFor(requester);

    const res = await request(app)
      .get('/api/community/trends')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.trends.insufficientData).toBe(false);
    // headache: 1 (chatty) + 8 (distinct) = 9 distinct users -> below floor -> absent.
    expect(res.body.trends.topSymptoms.find((s) => s.symptom === 'headache')).toBeUndefined();
  });

  test('?days=30 widens the window to include a session outside 7 days but inside 30', async () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    await seedDistinctUsersWithSymptom(10, 'migraine', twentyDaysAgo);
    const requester = await createUser();
    const token = tokenFor(requester);

    const res7 = await request(app)
      .get('/api/community/trends')
      .query({ days: '7' })
      .set('Authorization', `Bearer ${token}`);
    expect(res7.status).toBe(200);
    expect(res7.body.trends.topSymptoms.find((s) => s.symptom === 'migraine')).toBeUndefined();

    const res30 = await request(app)
      .get('/api/community/trends')
      .query({ days: '30' })
      .set('Authorization', `Bearer ${token}`);
    expect(res30.status).toBe(200);
    expect(res30.body.trends.windowDays).toBe(30);
    const migraine = res30.body.trends.topSymptoms.find((s) => s.symptom === 'migraine');
    expect(migraine).toBeDefined();
    expect(migraine.userCount).toBe(10);
  });

  test('severity breakdown counts a user once per severity level they experienced, and floors buckets too', async () => {
    // 10 distinct users each with one "High" severity session.
    const highUsers = [];
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const user = await createUser();
      highUsers.push(user);
      // eslint-disable-next-line no-await-in-loop
      await Session.create({
        user: user._id, mode: 'quick', status: 'completed', severityLevel: 'High', symptoms: [],
      });
    }
    // One of those same users also has a "Low" session (should count once
    // toward "High" and once toward "Low" if Low also clears the floor —
    // here it won't, since only 1 user has a Low session).
    await Session.create({
      user: highUsers[0]._id, mode: 'quick', status: 'completed', severityLevel: 'Low', symptoms: [],
    });
    const requester = await createUser();
    const token = tokenFor(requester);

    const res = await request(app)
      .get('/api/community/trends')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const high = res.body.trends.severityBreakdown.find((s) => s.severityLevel === 'High');
    expect(high).toBeDefined();
    expect(high.userCount).toBe(10);
    // "Low" only has 1 distinct user behind it — below the floor — absent.
    expect(res.body.trends.severityBreakdown.find((s) => s.severityLevel === 'Low')).toBeUndefined();
  });
});

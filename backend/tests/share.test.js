// Covers the "share with a healthcare professional" feature end to end:
// creating a link, the privacy boundary on what the public GET actually
// returns (the real risk in this feature — must never leak messages,
// ruleBasedTriage, or mlClassification), expiry, revocation, and ownership
// checks on both the create and revoke paths.
const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const ShareLink = require('../models/ShareLink');

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

async function createSessionWithDiagnosis(user, overrides = {}) {
  return Session.create({
    user: user._id,
    mode: 'quick',
    status: 'completed',
    messages: [
      { role: 'user', content: 'I have a secret private detail I would never want a stranger to see' },
      { role: 'assistant', content: 'Thanks for sharing.' },
    ],
    symptoms: [{ name: 'sore throat', duration: '2 days', onset: 'gradual' }],
    severityScore: 2,
    severityLevel: 'Low',
    diagnosis: {
      conditions: [{ name: 'Common Cold', probability: 70 }],
      recommendations: ['Rest', 'Fluids'],
      seekCareUrgency: 'self-care',
    },
    ruleBasedTriage: { level: 'Low', score: 0, matchedRules: [] },
    mlClassification: { condition: 'cold', confidence: 0.8, topPredictions: [] },
    ...overrides,
  });
}

describe('POST /share/session/:id', () => {
  test('creates a share link for a session the caller owns with a diagnosis', async () => {
    const user = await createUser();
    const session = await createSessionWithDiagnosis(user);

    const res = await request(app)
      .post(`/api/share/session/${session._id}`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('rejects a session with no diagnosis yet', async () => {
    const user = await createUser();
    const session = await Session.create({ user: user._id, mode: 'quick', status: 'active' });

    const res = await request(app)
      .post(`/api/share/session/${session._id}`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(400);
  });

  test("rejects creating a share link for another user's session", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const session = await createSessionWithDiagnosis(owner);

    const res = await request(app)
      .post(`/api/share/session/${session._id}`)
      .set('Authorization', `Bearer ${tokenFor(attacker)}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /share/:token — the privacy boundary', () => {
  test('returns only the safe subset, never messages/ruleBasedTriage/mlClassification', async () => {
    const user = await createUser();
    const session = await createSessionWithDiagnosis(user);
    const link = await ShareLink.create({
      session: session._id,
      user: user._id,
      token: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const res = await request(app).get(`/api/share/${link.token}`);

    expect(res.status).toBe(200);
    const { report } = res.body;
    expect(report.patientName).toBe('Test User');
    expect(report.severityLevel).toBe('Low');
    expect(report.symptoms).toEqual([expect.objectContaining({ name: 'sore throat' })]);
    expect(report.diagnosis.conditions[0].name).toBe('Common Cold');

    // The actual privacy boundary this whole feature exists to enforce:
    expect(report.messages).toBeUndefined();
    expect(report.ruleBasedTriage).toBeUndefined();
    expect(report.mlClassification).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/secret private detail/);
  });

  test('increments viewCount on each read', async () => {
    const user = await createUser();
    const session = await createSessionWithDiagnosis(user);
    const link = await ShareLink.create({
      session: session._id,
      user: user._id,
      token: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    await request(app).get(`/api/share/${link.token}`);
    await request(app).get(`/api/share/${link.token}`);

    const updated = await ShareLink.findById(link._id);
    expect(updated.viewCount).toBe(2);
  });

  test('rejects an expired link', async () => {
    const user = await createUser();
    const session = await createSessionWithDiagnosis(user);
    const link = await ShareLink.create({
      session: session._id,
      user: user._id,
      token: 'c'.repeat(64),
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app).get(`/api/share/${link.token}`);
    expect(res.status).toBe(404);
  });

  test('rejects a revoked link', async () => {
    const user = await createUser();
    const session = await createSessionWithDiagnosis(user);
    const link = await ShareLink.create({
      session: session._id,
      user: user._id,
      token: 'd'.repeat(64),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: new Date(),
    });

    const res = await request(app).get(`/api/share/${link.token}`);
    expect(res.status).toBe(404);
  });

  test('rejects an unknown token', async () => {
    const res = await request(app).get(`/api/share/${'e'.repeat(64)}`);
    expect(res.status).toBe(404);
  });

  test('rejects a malformed token (not 64 hex chars)', async () => {
    const res = await request(app).get('/api/share/not-a-real-token');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /share/:token', () => {
  test('owner can revoke their own share link', async () => {
    const user = await createUser();
    const session = await createSessionWithDiagnosis(user);
    const link = await ShareLink.create({
      session: session._id,
      user: user._id,
      token: 'f'.repeat(64),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const res = await request(app)
      .delete(`/api/share/${link.token}`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    const updated = await ShareLink.findById(link._id);
    expect(updated.revokedAt).not.toBeNull();
  });

  test("rejects revoking another user's share link", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const session = await createSessionWithDiagnosis(owner);
    const link = await ShareLink.create({
      session: session._id,
      user: owner._id,
      token: '1'.repeat(64),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const res = await request(app)
      .delete(`/api/share/${link.token}`)
      .set('Authorization', `Bearer ${tokenFor(attacker)}`);

    expect(res.status).toBe(404);
    const updated = await ShareLink.findById(link._id);
    expect(updated.revokedAt).toBeNull();
  });
});

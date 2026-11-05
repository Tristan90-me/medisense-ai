// Integration tests for GET /api/admin/stats (controllers/adminController.js
// getStats), focused on the new aiSafety block added alongside the existing
// dashboard counts: severityMismatchCount, flaggedForReviewCount,
// pendingReviewCount, and the ML classifier's real held-out accuracy.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const { MODEL_META } = require('../ml/symptomClassifier');

async function createAdmin(overrides = {}) {
  return User.create({
    name: 'Admin User',
    email: `admin-${Date.now()}-${Math.random()}@example.com`,
    password: 'adminpass123',
    role: 'admin',
    isEmailVerified: true,
    ...overrides,
  });
}

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

describe('GET /api/admin/stats — aiSafety block', () => {
  test('counts mismatches, flagged/pending sessions, and reports the real ML accuracy', async () => {
    const admin = await createAdmin();
    const user = await createUser();

    await Session.create({ user: user._id, status: 'completed', severityMismatch: true, flaggedForReview: true });
    await Session.create({
      user: user._id, status: 'completed', severityMismatch: true, flaggedForReview: true, reviewedAt: new Date(), reviewedBy: admin._id,
    });
    await Session.create({ user: user._id, status: 'completed', flaggedForReview: true });
    await Session.create({ user: user._id, status: 'completed' });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.aiSafety.severityMismatchCount).toBe(2);
    expect(res.body.aiSafety.flaggedForReviewCount).toBe(3);
    expect(res.body.aiSafety.pendingReviewCount).toBe(2);
    expect(res.body.aiSafety.mlAccuracy).toBe(MODEL_META.evaluation.accuracy);
  });

  test('rejects a non-admin user', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(403);
  });

  test('aiSafety.reviewedVerdictCount/confirmedRealCount reflect real verdicts and exclude legacy null-verdict reviews', async () => {
    const admin = await createAdmin();
    const user = await createUser();

    await Session.create({ user: user._id, flaggedForReview: true, reviewVerdict: 'rules_correct', reviewedAt: new Date(), reviewedBy: admin._id });
    await Session.create({ user: user._id, flaggedForReview: true, reviewVerdict: 'rules_correct', reviewedAt: new Date(), reviewedBy: admin._id });
    await Session.create({ user: user._id, flaggedForReview: true, reviewVerdict: 'ai_correct', reviewedAt: new Date(), reviewedBy: admin._id });
    await Session.create({ user: user._id, flaggedForReview: true, reviewVerdict: 'false_alarm', reviewedAt: new Date(), reviewedBy: admin._id });
    // Legacy review from before reviewVerdict existed — reviewedAt is set but reviewVerdict is null.
    await Session.create({ user: user._id, flaggedForReview: true, reviewedAt: new Date(), reviewedBy: admin._id });
    // Escalated but not yet resolved — no verdict at all.
    await Session.create({ user: user._id, flaggedForReview: true, escalated: true });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.aiSafety.reviewedVerdictCount).toBe(4);
    expect(res.body.aiSafety.confirmedRealCount).toBe(2);
  });
});

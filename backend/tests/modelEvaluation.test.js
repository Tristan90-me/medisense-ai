// Integration test for GET /api/admin/model-evaluation (adminController.js
// getModelEvaluation) — confirms it surfaces the classifier's real training
// metadata (ml/model.json via MODEL_META) rather than anything fabricated.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

describe('GET /api/admin/model-evaluation', () => {
  test("returns the classifier's real training metadata", async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .get('/api/admin/model-evaluation')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.algorithm).toBe('Bernoulli Naive Bayes');
    expect(res.body.conditionCount).toBe(MODEL_META.conditionCount);
    expect(res.body.symptomCount).toBe(MODEL_META.symptomCount);
    expect(res.body.accuracy).toBe(MODEL_META.evaluation.accuracy);
    expect(res.body.trainSize).toBe(MODEL_META.evaluation.trainSize);
    expect(res.body.testSize).toBe(MODEL_META.evaluation.testSize);
  });

  test('rejects a non-admin user', async () => {
    const user = await createUser();
    const res = await request(app)
      .get('/api/admin/model-evaluation')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(403);
  });
});

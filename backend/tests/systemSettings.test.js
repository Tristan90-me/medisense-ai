// Integration tests for the SystemSetting admin endpoints (7d):
// getSettings/updateSetting upsert semantics, previewPrompt's
// no-persistence guarantee, and adminOnly gating. utils/gemini's chat() is
// mocked so previewPrompt doesn't hit a real model.
jest.mock('../utils/gemini', () => ({
  chat: jest.fn(),
  chatStream: jest.fn(),
  generateSummary: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');
const { chat } = require('../utils/gemini');

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

async function createConsumer(overrides = {}) {
  return User.create({
    name: 'Regular User',
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

describe('PUT /api/admin/settings/:key', () => {
  test('creates a setting on first call, updates the same document (no duplicate) on second', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res1 = await request(app)
      .put('/api/admin/settings/emergencyKeywords')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: ['funny taste in mouth'] });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.setting.value).toEqual(['funny taste in mouth']);

    const res2 = await request(app)
      .put('/api/admin/settings/emergencyKeywords')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: ['funny taste in mouth', 'ringing in ears'] });

    expect(res2.status).toBe(200);
    expect(res2.body.setting.value).toEqual(['funny taste in mouth', 'ringing in ears']);

    const all = await SystemSetting.find({ key: 'emergencyKeywords' });
    expect(all).toHaveLength(1);
    expect(all[0].updatedBy.toString()).toBe(admin._id.toString());
  });

  test('non-admin gets 403', async () => {
    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .put('/api/admin/settings/emergencyKeywords')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: ['x'] });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/settings', () => {
  test('returns all setting documents', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    await SystemSetting.create([
      { key: 'systemPrompt', value: 'Custom prompt', updatedBy: admin._id },
      { key: 'emergencyKeywords', value: ['a', 'b'], updatedBy: admin._id },
    ]);

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.settings).toHaveLength(2);
    const keys = res.body.settings.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['systemPrompt', 'emergencyKeywords']));
  });
});

describe('POST /api/admin/settings/preview-prompt', () => {
  beforeEach(() => { chat.mockReset(); });

  test('calls chat() with the draft prompt and does not persist anything', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    chat.mockResolvedValue({ text: 'This is a mocked preview response.' });

    const res = await request(app)
      .post('/api/admin/settings/preview-prompt')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'You are a draft assistant prompt.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview).toBe('This is a mocked preview response.');

    expect(chat).toHaveBeenCalledTimes(1);
    const [history, healthProfile, promptOverride] = chat.mock.calls[0];
    expect(history).toEqual([{ role: 'user', content: 'I have a mild headache, what should I do?' }]);
    expect(healthProfile).toBeNull();
    expect(promptOverride).toBe('You are a draft assistant prompt.');

    const saved = await SystemSetting.findOne({ key: 'systemPrompt' });
    expect(saved).toBeNull();
  });

  test('non-admin gets 403', async () => {
    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .post('/api/admin/settings/preview-prompt')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'draft prompt text' });

    expect(res.status).toBe(403);
  });

  test('an empty prompt is rejected by validation with 400', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/admin/settings/preview-prompt')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: '' });

    expect(res.status).toBe(400);
  });
});

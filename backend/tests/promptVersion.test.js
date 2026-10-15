// Integration tests for the prompt-version audit-trail field stamped on
// Session at creation (controllers/aiController.js's getPromptVersion / the
// `promptVersion` field on Session.start). Covers the default (no admin
// override saved yet), a real saved SystemSetting, and that resuming an
// existing active session doesn't re-stamp it.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');

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

describe('Session.promptVersion', () => {
  test("defaults to 'built-in-default' when no systemPrompt setting is saved", async () => {
    await SystemSetting.deleteOne({ key: 'systemPrompt' });
    const user = await createUser();
    const res = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ mode: 'quick' });

    expect(res.status).toBe(201);
    expect(res.body.session.promptVersion).toBe('built-in-default');
  });

  test('stamps the saved systemPrompt setting\'s updatedAt when one exists', async () => {
    const setting = await SystemSetting.findOneAndUpdate(
      { key: 'systemPrompt' },
      { value: 'A custom test prompt.' },
      { upsert: true, returnDocument: 'after' }
    );
    const user = await createUser();
    const res = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ mode: 'quick' });

    expect(res.status).toBe(201);
    expect(res.body.session.promptVersion).toBe(setting.updatedAt.toISOString());
  });

  test('resuming an existing active session keeps its original promptVersion', async () => {
    await SystemSetting.findOneAndUpdate(
      { key: 'systemPrompt' },
      { value: 'Prompt A' },
      { upsert: true }
    );
    const user = await createUser();
    const token = tokenFor(user);

    const first = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick' });
    const originalVersion = first.body.session.promptVersion;

    await SystemSetting.findOneAndUpdate({ key: 'systemPrompt' }, { value: 'Prompt B' });

    const second = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick' });

    expect(second.body.resumed).toBe(true);
    expect(second.body.session.promptVersion).toBe(originalVersion);
  });
});

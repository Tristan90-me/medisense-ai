// Integration tests for PATCH /api/ai/session/:id/abandon
// (controllers/aiController.js's abandonSession) — the fix for a real bug:
// startSession's resume lookup (status: 'active') doesn't check mode, so a
// user with an unfinished session was always silently dropped back into it
// with no way to start fresh. utils/gemini is mocked exactly like
// sessionTriage.test.js, though these tests never actually exercise chat.
jest.mock('../utils/gemini', () => ({
  chat: jest.fn(),
  chatStream: jest.fn(),
  generateSummary: jest.fn(),
}));

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

async function startSession(token, mode = 'quick') {
  const res = await request(app)
    .post('/api/ai/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ mode });
  return res.body.session;
}

describe('PATCH /api/ai/session/:id/abandon', () => {
  test('marks an active session as abandoned', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const session = await startSession(token);

    const res = await request(app)
      .patch(`/api/ai/session/${session._id}/abandon`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('abandoned');

    const saved = await Session.findById(session._id);
    expect(saved.status).toBe('abandoned');
  });

  test('is a no-op (200, unchanged) for an already-completed session', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const session = await startSession(token);
    await Session.findByIdAndUpdate(session._id, { status: 'completed' });

    const res = await request(app)
      .patch(`/api/ai/session/${session._id}/abandon`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('completed');
  });

  test('is a no-op (200, unchanged) for an already-abandoned session', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const session = await startSession(token);
    await Session.findByIdAndUpdate(session._id, { status: 'abandoned' });

    const res = await request(app)
      .patch(`/api/ai/session/${session._id}/abandon`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('abandoned');
  });

  test('404 for a session belonging to a different user', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const session = await startSession(tokenFor(owner));

    const res = await request(app)
      .patch(`/api/ai/session/${session._id}/abandon`)
      .set('Authorization', `Bearer ${tokenFor(stranger)}`);

    expect(res.status).toBe(404);
  });

  test('404 for a non-existent session', async () => {
    const user = await createUser();
    const fakeId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .patch(`/api/ai/session/${fakeId}/abandon`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(404);
  });

  test('non-admin-auth required: no token gets 401', async () => {
    const res = await request(app).patch('/api/ai/session/507f1f77bcf86cd799439011/abandon');
    expect(res.status).toBe(401);
  });

  // The actual regression this feature fixes: abandoning an active session
  // means the NEXT startSession call creates a genuinely new session,
  // instead of silently resuming the one just abandoned.
  test('after abandoning, starting a new session (same mode) creates a different session, not a resume', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const first = await startSession(token, 'quick');

    await request(app)
      .patch(`/api/ai/session/${first._id}/abandon`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick' });

    expect(res.status).toBe(201);
    expect(res.body.resumed).toBe(false);
    expect(res.body.session._id).not.toBe(first._id);

    const oldSession = await Session.findById(first._id);
    expect(oldSession.status).toBe('abandoned');
  });

  test('before abandoning, starting a new session silently resumes the old one (confirms the bug this fixes)', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const first = await startSession(token, 'full');

    const res = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick' });

    expect(res.status).toBe(200);
    expect(res.body.resumed).toBe(true);
    expect(res.body.session._id).toBe(first._id.toString());
  });
});

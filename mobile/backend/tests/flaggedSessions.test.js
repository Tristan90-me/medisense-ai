// Integration tests for the flagged-sessions moderation queue: auto-flagging
// via controllers/aiController.js's sendMessage, permanence of the flag
// across later non-flagging messages, admin listing/filtering, and review.
// utils/gemini is mocked exactly like tests/sessionTriage.test.js.
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
const AuditLog = require('../models/AuditLog');
const { chat } = require('../utils/gemini');

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

function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function startSession(token) {
  const res = await request(app)
    .post('/api/ai/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ mode: 'quick' });
  return res.body.session._id;
}

describe('auto-flagging via sendMessage', () => {
  beforeEach(() => { chat.mockReset(); });

  test('a red-flag symptom the LLM under-calls gets flaggedForReview: true', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chat.mockResolvedValue({
      text: 'That sounds manageable.',
      emergency: false,
      severity: { score: 2, level: 'Low', reason: 'Seems mild' },
      symptoms: { symptoms: ['chest pain', 'shortness of breath'], duration: '1 hour', onset: 'sudden' },
      diagnosis: null,
      suggestions: [],
    });

    await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'I have chest pain and shortness of breath' });

    const saved = await Session.findById(sessionId);
    expect(saved.flaggedForReview).toBe(true);
  });

  test('an LLM-declared emergency also flags the session', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chat.mockResolvedValue({
      text: 'Seek emergency care now.',
      emergency: true,
      severity: { score: 10, level: 'Critical', reason: 'Emergency' },
      symptoms: { symptoms: ['fainted'], duration: 'now', onset: 'sudden' },
      diagnosis: null,
      suggestions: [],
    });

    await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'I fainted' });

    const saved = await Session.findById(sessionId);
    expect(saved.flaggedForReview).toBe(true);
  });

  test('flaggedForReview never gets cleared by a later calm message in the same session', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chat.mockResolvedValueOnce({
      text: 'That sounds serious.',
      emergency: false,
      severity: { score: 2, level: 'Low', reason: 'n/a' },
      symptoms: { symptoms: ['chest pain', 'shortness of breath'], duration: '1 hour', onset: 'sudden' },
      diagnosis: null,
      suggestions: [],
    });
    await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'I have chest pain and shortness of breath' });

    let saved = await Session.findById(sessionId);
    expect(saved.flaggedForReview).toBe(true);

    chat.mockResolvedValueOnce({
      text: 'Glad you feel better.',
      emergency: false,
      severity: { score: 1, level: 'Low', reason: 'n/a' },
      symptoms: { symptoms: ['runny nose'], duration: '1 day', onset: 'gradual' },
      diagnosis: null,
      suggestions: [],
    });
    await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'Actually just a runny nose now' });

    saved = await Session.findById(sessionId);
    expect(saved.flaggedForReview).toBe(true);
  });

  test('a calm session never gets flagged', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chat.mockResolvedValue({
      text: 'Sounds like a common cold.',
      emergency: false,
      severity: { score: 2, level: 'Low', reason: 'Mild' },
      symptoms: { symptoms: ['runny nose'], duration: '2 days', onset: 'gradual' },
      diagnosis: null,
      suggestions: [],
    });

    await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'Just a runny nose' });

    const saved = await Session.findById(sessionId);
    expect(saved.flaggedForReview).toBe(false);
  });
});

describe('GET /api/admin/sessions/flagged', () => {
  test('non-admin gets 403', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/admin/sessions/flagged')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('?status=pending only returns unreviewed flagged sessions', async () => {
    const admin = await createAdmin();
    const user = await createUser();
    const token = tokenFor(admin);

    const [pending, reviewed, unflagged] = await Promise.all([
      Session.create({ user: user._id, flaggedForReview: true, reviewedAt: null }),
      Session.create({
        user: user._id, flaggedForReview: true, reviewedAt: new Date(), reviewedBy: admin._id,
      }),
      Session.create({ user: user._id, flaggedForReview: false }),
    ]);

    const res = await request(app)
      .get('/api/admin/sessions/flagged')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.sessions.map((s) => s._id);
    expect(ids).toContain(pending._id.toString());
    expect(ids).not.toContain(reviewed._id.toString());
    expect(ids).not.toContain(unflagged._id.toString());
  });
});

describe('PATCH /api/admin/sessions/:id/review', () => {
  test('sets reviewedBy/reviewedAt/reviewNotes and creates an audit log entry', async () => {
    const admin = await createAdmin();
    const user = await createUser();
    const token = tokenFor(admin);

    const session = await Session.create({ user: user._id, flaggedForReview: true });

    const res = await request(app)
      .patch(`/api/admin/sessions/${session._id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewNotes: 'Looks fine, false alarm.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.session.reviewNotes).toBe('Looks fine, false alarm.');
    expect(res.body.session.reviewedBy).toBe(admin._id.toString());
    expect(res.body.session.reviewedAt).toBeTruthy();
    // Reviewing never clears the permanent flag.
    expect(res.body.session.flaggedForReview).toBe(true);

    const logs = await AuditLog.find({ action: 'session.review' });
    expect(logs).toHaveLength(1);
    expect(logs[0].targetId.toString()).toBe(session._id.toString());
    expect(logs[0].metadata.reviewNotes).toBe('Looks fine, false alarm.');
  });

  test('404 for a non-existent session', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);
    const fakeId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .patch(`/api/admin/sessions/${fakeId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });

  test('non-admin gets 403', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const session = await Session.create({ user: user._id, flaggedForReview: true });

    const res = await request(app)
      .patch(`/api/admin/sessions/${session._id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
  });
});

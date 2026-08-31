// Covers the highest-risk part of the Family/Dependents feature: the
// HealthProfile.user unique-index migration (compound { user, dependent }
// index replacing the old single-field one) and the dependent-aware
// resolution logic in aiController's session start/message flow.
//
// utils/gemini is mocked so sendMessage/sendMessageStream never make a real
// Gemini call — we only need to assert which HealthProfile object gets
// passed into chat()/chatStream(), not what Gemini says back.
jest.mock('../utils/gemini', () => ({
  chat: jest.fn().mockResolvedValue({
    text: 'ok', emergency: false, severity: null, symptoms: null, diagnosis: null, suggestions: [],
  }),
  chatStream: jest.fn().mockImplementation(async (history, healthProfile, onChunk) => {
    onChunk('ok');
    return {
      text: 'ok', emergency: false, severity: null, symptoms: null, diagnosis: null, suggestions: [],
    };
  }),
  generateSummary: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const HealthProfile = require('../models/HealthProfile');
const Session = require('../models/Session');
const { chat, chatStream } = require('../utils/gemini');

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

describe('HealthProfile compound unique index migration', () => {
  test('a pre-existing self profile with no dependent field still resolves via { user, dependent: null }', async () => {
    const user = await createUser();

    // Simulate a pre-migration document: insert directly via the driver so
    // no `dependent` field exists at all (bypassing the schema default).
    await mongoose.connection.collection('healthprofiles').insertOne({
      user: user._id,
      bloodType: 'O+',
    });

    const found = await HealthProfile.findOne({ user: user._id, dependent: null });
    expect(found).not.toBeNull();
    expect(found.bloodType).toBe('O+');
  });

  test('a second profile for the same user with a real dependent id coexists with the self profile', async () => {
    const user = await createUser();
    const dependent = await Dependent.create({ owner: user._id, name: 'Kid', relationship: 'child' });

    await HealthProfile.create({ user: user._id, dependent: null, bloodType: 'O+' });
    await HealthProfile.create({ user: user._id, dependent: dependent._id, bloodType: 'A-' });

    const count = await HealthProfile.countDocuments({ user: user._id });
    expect(count).toBe(2);
  });

  test('a second profile for the identical { user, dependent } pair is rejected by the compound unique index', async () => {
    const user = await createUser();
    const dependent = await Dependent.create({ owner: user._id, name: 'Kid', relationship: 'child' });

    await HealthProfile.create({ user: user._id, dependent: dependent._id, bloodType: 'A-' });

    await expect(
      HealthProfile.create({ user: user._id, dependent: dependent._id, bloodType: 'B+' })
    ).rejects.toThrow(/duplicate key/i);
  });
});

describe('Session start: dependent-aware resume scoping', () => {
  test('starting a session for a dependent while a self session is active creates a new session, not a resume', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kid', relationship: 'child' });

    const selfStart = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick' });
    expect(selfStart.body.resumed).toBe(false);

    const depStart = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick', dependentId: String(dependent._id) });
    expect(depStart.body.resumed).toBe(false);
    expect(depStart.body.session._id).not.toBe(selfStart.body.session._id);
    expect(depStart.body.session.dependent).toBe(String(dependent._id));
  });

  test('starting a second self session resumes the existing active self session', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const first = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick' });

    const second = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick' });

    expect(second.body.resumed).toBe(true);
    expect(second.body.session._id).toBe(first.body.session._id);
  });

  test('starting a session with a dependentId not owned by the caller is rejected with 404', async () => {
    const user = await createUser();
    const otherUser = await createUser();
    const token = tokenFor(user);
    const notMyDependent = await Dependent.create({ owner: otherUser._id, name: 'Not mine', relationship: 'child' });

    const res = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick', dependentId: String(notMyDependent._id) });

    expect(res.status).toBe(404);
  });
});

describe('sendMessage / sendMessageStream: correct HealthProfile resolution', () => {
  beforeEach(() => {
    chat.mockClear();
    chatStream.mockClear();
  });

  test('sendMessage passes the dependent-scoped profile into chat() for a dependent session', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kid', relationship: 'child' });

    await HealthProfile.create({ user: user._id, dependent: null, bloodType: 'O+' });
    await HealthProfile.create({ user: user._id, dependent: dependent._id, bloodType: 'A-' });

    const start = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick', dependentId: String(dependent._id) });

    await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: start.body.session._id, message: 'hello' });

    expect(chat).toHaveBeenCalledTimes(1);
    const [, healthProfileArg] = chat.mock.calls[0];
    expect(healthProfileArg.bloodType).toBe('A-');
  });

  test('sendMessage passes the self profile into chat() for a self session, even when a dependent profile also exists', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kid', relationship: 'child' });

    await HealthProfile.create({ user: user._id, dependent: null, bloodType: 'O+' });
    await HealthProfile.create({ user: user._id, dependent: dependent._id, bloodType: 'A-' });

    const start = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick' });

    await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: start.body.session._id, message: 'hello' });

    const [, healthProfileArg] = chat.mock.calls[0];
    expect(healthProfileArg.bloodType).toBe('O+');
  });

  test('sendMessageStream passes the dependent-scoped profile into chatStream()', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kid', relationship: 'child' });
    await HealthProfile.create({ user: user._id, dependent: dependent._id, bloodType: 'A-' });

    const start = await request(app)
      .post('/api/ai/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'quick', dependentId: String(dependent._id) });

    await request(app)
      .post('/api/ai/session/message/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: start.body.session._id, message: 'hello' });

    expect(chatStream).toHaveBeenCalledTimes(1);
    const [, healthProfileArg] = chatStream.mock.calls[0];
    expect(healthProfileArg.bloodType).toBe('A-');
  });
});

describe('assistantChat stays self-only', () => {
  test('assistantChat resolves the self profile even when a dependent profile also exists', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kid', relationship: 'child' });

    await HealthProfile.create({ user: user._id, dependent: null, bloodType: 'O+' });
    await HealthProfile.create({ user: user._id, dependent: dependent._id, bloodType: 'A-' });

    chat.mockClear();
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'hello' });

    const [, healthProfileArg] = chat.mock.calls[0];
    expect(healthProfileArg.bloodType).toBe('O+');
  });
});

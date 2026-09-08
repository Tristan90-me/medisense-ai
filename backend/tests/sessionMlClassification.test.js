// Integration tests for the ML classification wiring in
// controllers/aiController.js's sendMessage/sendMessageStream — confirms
// mlClassification lands correctly on both the API response and the
// persisted Session doc. utils/gemini is mocked (same pattern as
// tests/sessionTriage.test.js) so the LLM's own output never influences
// what the classifier — a fully independent third signal — predicts.
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

async function startSession(token) {
  const res = await request(app)
    .post('/api/ai/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ mode: 'quick' });
  return res.body.session._id;
}

describe('sendMessage: ML classification wiring', () => {
  beforeEach(() => { chat.mockReset(); chatStream.mockReset(); });

  test('recognizable symptoms produce a non-null mlClassification on both the response and the saved session', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chat.mockResolvedValue({
      text: 'Sounds like a cold.',
      emergency: false,
      severity: { score: 2, level: 'Low', reason: 'Mild' },
      symptoms: { symptoms: ['runny nose', 'sneezing', 'sore throat'], duration: '2 days', onset: 'gradual' },
      diagnosis: null,
      suggestions: [],
    });

    const res = await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'I have a runny nose, sneezing, and sore throat' });

    expect(res.status).toBe(200);
    expect(res.body.mlClassification.condition).toBe('Common Cold');
    expect(res.body.mlClassification.confidence).toBeGreaterThan(0);
    expect(res.body.mlClassification.topPredictions.length).toBeGreaterThan(0);

    const saved = await Session.findById(sessionId);
    expect(saved.mlClassification.condition).toBe('Common Cold');
  });

  test('no extracted symptoms yet produces a null mlClassification, not an error', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chat.mockResolvedValue({
      text: 'Can you tell me more about your symptoms?',
      emergency: false,
      severity: null,
      symptoms: null,
      diagnosis: null,
      suggestions: [],
    });

    const res = await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'I feel unwell' });

    expect(res.status).toBe(200);
    expect(res.body.mlClassification).toEqual({ condition: null, confidence: 0, topPredictions: [] });
  });

  test('the classifier result is independent of the LLM severity/diagnosis output', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    // LLM says something completely different from what the classifier
    // would independently conclude from the same extracted symptoms — the
    // classifier must still report its own honest prediction, not defer to
    // or get overridden by the LLM's framing.
    chat.mockResolvedValue({
      text: 'This seems unrelated to any common condition.',
      emergency: false,
      severity: { score: 1, level: 'Low', reason: 'n/a' },
      symptoms: { symptoms: ['burning urination', 'frequent urination'], duration: '1 day', onset: 'sudden' },
      diagnosis: null,
      suggestions: [],
    });

    const res = await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'burning and frequent urination' });

    expect(res.body.mlClassification.condition).toBe('Urinary Tract Infection');
  });

  test('sendMessageStream (SSE) includes mlClassification in its final done event', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chatStream.mockImplementation(async (history, healthProfile, onChunk) => {
      onChunk('That ');
      onChunk('sounds like a migraine.');
      return {
        text: 'That sounds like a migraine.',
        emergency: false,
        severity: { score: 4, level: 'Moderate', reason: 'n/a' },
        symptoms: { symptoms: ['headache', 'sensitivity to light', 'nausea'], duration: '1 day', onset: 'gradual' },
        diagnosis: null,
        suggestions: [],
      };
    });

    const res = await request(app)
      .post('/api/ai/session/message/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'headache with light sensitivity and nausea' });

    expect(res.status).toBe(200);
    const events = res.text
      .split('\n\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line.replace(/^data: /, '')));
    const done = events.find((e) => e.type === 'done');

    expect(done.mlClassification.condition).toBe('Migraine');
  });
});

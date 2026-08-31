// Integration tests for the rule-based triage wiring in
// controllers/aiController.js's sendMessage/sendMessageStream — confirms
// ruleBasedTriage/severityMismatch land correctly on both the API response
// and the persisted Session doc. utils/gemini is mocked so the LLM's
// severity/emergency output can be controlled per test, independent of
// whatever the rule engine independently derives from the symptom list.
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

describe('sendMessage: rule-based triage wiring', () => {
  beforeEach(() => {
    chat.mockReset();
    chatStream.mockReset();
  });

  test('a red-flag symptom the LLM does not flag produces severityMismatch: true', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    // LLM under-calls it: extracts the red-flag symptoms but scores Low and
    // never sets [EMERGENCY] — exactly the case this safety net exists for.
    chat.mockResolvedValue({
      text: 'That sounds manageable, keep an eye on it.',
      emergency: false,
      severity: { score: 2, level: 'Low', reason: 'Seems mild' },
      symptoms: { symptoms: ['chest pain', 'shortness of breath'], duration: '1 hour', onset: 'sudden' },
      diagnosis: null,
      suggestions: [],
    });

    const res = await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'I have chest pain and shortness of breath' });

    expect(res.status).toBe(200);
    expect(res.body.ruleBasedTriage.level).toBe('Critical');
    expect(res.body.ruleBasedTriage.matchedRules).toContain('chest_pain_cardiac');
    expect(res.body.severityMismatch).toBe(true);

    const saved = await Session.findById(sessionId);
    expect(saved.ruleBasedTriage.level).toBe('Critical');
    expect(saved.severityMismatch).toBe(true);
  });

  test('no red flags and a Low LLM severity produces no mismatch', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chat.mockResolvedValue({
      text: 'Sounds like a common cold.',
      emergency: false,
      severity: { score: 2, level: 'Low', reason: 'Mild symptoms' },
      symptoms: { symptoms: ['runny nose', 'sneezing'], duration: '2 days', onset: 'gradual' },
      diagnosis: null,
      suggestions: [],
    });

    const res = await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'I have a runny nose and sneezing' });

    expect(res.body.ruleBasedTriage.level).toBe('Low');
    expect(res.body.severityMismatch).toBe(false);

    const saved = await Session.findById(sessionId);
    expect(saved.severityMismatch).toBe(false);
  });

  test('a red flag the LLM ALSO flags as Critical does not count as a mismatch', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    // Both systems agree it's critical — no disagreement to flag.
    chat.mockResolvedValue({
      text: 'This requires immediate emergency care.',
      emergency: true,
      severity: { score: 10, level: 'Critical', reason: 'Possible heart attack' },
      symptoms: { symptoms: ['chest pain', 'arm pain'], duration: '20 minutes', onset: 'sudden' },
      diagnosis: null,
      suggestions: [],
    });

    const res = await request(app)
      .post('/api/ai/session/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'Chest pain radiating to my arm' });

    expect(res.body.ruleBasedTriage.level).toBe('Critical');
    expect(res.body.severityMismatch).toBe(false);
  });

  test('sendMessageStream (SSE) includes ruleBasedTriage/severityMismatch in its final done event', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const sessionId = await startSession(token);

    chatStream.mockImplementation(async (history, healthProfile, onChunk) => {
      onChunk('That ');
      onChunk('sounds serious.');
      return {
        text: 'That sounds serious.',
        emergency: false,
        severity: { score: 3, level: 'Low', reason: 'n/a' },
        symptoms: { symptoms: ['fainted'], duration: 'just now', onset: 'sudden' },
        diagnosis: null,
        suggestions: [],
      };
    });

    const res = await request(app)
      .post('/api/ai/session/message/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, message: 'I fainted' });

    expect(res.status).toBe(200);
    const events = res.text
      .split('\n\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line.replace(/^data: /, '')));
    const done = events.find((e) => e.type === 'done');

    expect(done.ruleBasedTriage.level).toBe('Critical');
    expect(done.ruleBasedTriage.matchedRules).toContain('loss_of_consciousness');
    expect(done.severityMismatch).toBe(true);
  });
});

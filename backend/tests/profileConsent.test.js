// Covers the privacy-consent stamping added to PUT /profile (onboarding's
// "I understand how my data is used" checkbox) — consent belongs to the
// account (User.privacyConsentAt), not any one HealthProfile, and is only
// ever stamped once.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

describe('PUT /profile — privacyConsent', () => {
  test('stamps privacyConsentAt on the account when privacyConsent: true is sent', async () => {
    const user = await createUser();
    expect(user.privacyConsentAt).toBeNull();

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ bloodType: 'O+', privacyConsent: true });

    expect(res.status).toBe(200);
    const updated = await User.findById(user._id);
    expect(updated.privacyConsentAt).not.toBeNull();
  });

  test('does not overwrite an existing privacyConsentAt on a later update', async () => {
    const user = await createUser({ privacyConsentAt: new Date('2020-01-01T00:00:00.000Z') });

    await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ bloodType: 'A+', privacyConsent: true });

    const updated = await User.findById(user._id);
    expect(updated.privacyConsentAt.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  });

  test('leaves privacyConsentAt null when privacyConsent is omitted', async () => {
    const user = await createUser();

    await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ bloodType: 'B+' });

    const updated = await User.findById(user._id);
    expect(updated.privacyConsentAt).toBeNull();
  });
});

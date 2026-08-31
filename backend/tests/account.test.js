// Integration tests for the Account Settings API (routes/account.js ->
// controllers/accountController.js). Nothing here calls email or Gemini,
// so nothing needs mocking.
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const Session = require('../models/Session');
const Dependent = require('../models/Dependent');
const jwt = require('jsonwebtoken');

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

describe('Account Settings', () => {
  describe('get and update account', () => {
    test('get account returns the current user without a password field', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .get('/api/account')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.password).toBeUndefined();
    });

    test('update account changes name and email', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .put('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name', email: 'new-email@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('New Name');
      expect(res.body.user.email).toBe('new-email@example.com');
    });

    test('updating to an email already in use is rejected with 400', async () => {
      const existing = await createUser({ email: 'taken@example.com' });
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .put('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: existing.email });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Email already in use');
    });

    test('invalid email is rejected with 400', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .put('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('changePassword', () => {
    test('wrong current password is rejected with 401', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .post('/api/account/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrongpass', newPassword: 'newpass123' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Current password is incorrect');
    });

    test('correct current password changes it, invalidates the old one, and clears trusted devices', async () => {
      const user = await createUser();
      user.generateDeviceToken(30);
      await user.save();
      expect(user.trustedDevices).toHaveLength(1);

      const token = tokenFor(user);

      const res = await request(app)
        .post('/api/account/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'userpass123', newPassword: 'newpass123' });

      expect(res.status).toBe(200);

      const updated = await User.findById(user._id);
      expect(await updated.matchPassword('userpass123')).toBe(false);
      expect(await updated.matchPassword('newpass123')).toBe(true);
      expect(updated.trustedDevices).toHaveLength(0);
    });

    test('new password shorter than 6 characters is rejected with 400', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .post('/api/account/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'userpass123', newPassword: 'ab' });

      expect(res.status).toBe(400);
    });
  });

  describe('trusted devices', () => {
    test('list omits the raw token and includes id/expiresAt/createdAt', async () => {
      const user = await createUser();
      user.generateDeviceToken(30);
      await user.save();
      const token = tokenFor(user);

      const res = await request(app)
        .get('/api/account/trusted-devices')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.devices).toHaveLength(1);
      expect(res.body.devices[0].token).toBeUndefined();
      expect(res.body.devices[0]).toHaveProperty('id');
      expect(res.body.devices[0]).toHaveProperty('expiresAt');
      expect(res.body.devices[0]).toHaveProperty('createdAt');
    });

    test('revoking a device removes it', async () => {
      const user = await createUser();
      user.generateDeviceToken(30);
      await user.save();
      const deviceId = user.trustedDevices[0]._id;
      const token = tokenFor(user);

      const res = await request(app)
        .delete(`/api/account/trusted-devices/${deviceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const updated = await User.findById(user._id);
      expect(updated.trustedDevices).toHaveLength(0);
    });

    // Security property: user B must never be able to revoke user A's
    // device by id, even by guessing/reusing it — 404, not 403.
    test('user B cannot revoke user A\'s device by id', async () => {
      const userA = await createUser({ email: 'a@example.com' });
      userA.generateDeviceToken(30);
      await userA.save();
      const deviceId = userA.trustedDevices[0]._id;

      const userB = await createUser({ email: 'b@example.com' });
      const tokenB = tokenFor(userB);

      const res = await request(app)
        .delete(`/api/account/trusted-devices/${deviceId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);

      const stillThere = await User.findById(userA._id);
      expect(stillThere.trustedDevices).toHaveLength(1);
    });

    test('revoking a nonexistent device id returns 404', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .delete(`/api/account/trusted-devices/${new (require('mongoose').Types.ObjectId)()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('deleteAccount', () => {
    test('wrong password is rejected with 401 and nothing is deleted', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(await User.findById(user._id)).not.toBeNull();
    });

    test('correct password deletes the account and cascades HealthProfile/Session/Dependent rows', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const dependent = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });
      await HealthProfile.create({ user: user._id, dependent: null, bloodType: 'O+' });
      await HealthProfile.create({ user: user._id, dependent: dependent._id, bloodType: 'A+' });
      await Session.create({ user: user._id, mode: 'quick' });
      await Session.create({ user: user._id, dependent: dependent._id, mode: 'quick' });

      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'userpass123' });

      expect(res.status).toBe(200);

      expect(await User.findById(user._id)).toBeNull();
      expect(await HealthProfile.countDocuments({ user: user._id })).toBe(0);
      expect(await HealthProfile.countDocuments({ dependent: dependent._id })).toBe(0);
      expect(await Session.countDocuments({ user: user._id })).toBe(0);
      expect(await Dependent.countDocuments({ owner: user._id })).toBe(0);
    });

    test('deleting one user\'s account never touches another user\'s data', async () => {
      const userA = await createUser({ email: 'a2@example.com' });
      const userB = await createUser({ email: 'b2@example.com' });
      const tokenA = tokenFor(userA);

      await HealthProfile.create({ user: userB._id, dependent: null, bloodType: 'B+' });
      await Session.create({ user: userB._id, mode: 'quick' });

      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ password: 'userpass123' });

      expect(res.status).toBe(200);
      expect(await User.findById(userB._id)).not.toBeNull();
      expect(await HealthProfile.countDocuments({ user: userB._id })).toBe(1);
      expect(await Session.countDocuments({ user: userB._id })).toBe(1);
    });

    test('missing password is rejected with 400', async () => {
      const user = await createUser();
      const token = tokenFor(user);

      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});

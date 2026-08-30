// Integration tests for the admin auth flow (routes/adminAuth.js ->
// controllers/authAdminController.js) — deliberately mirrors auth.test.js's
// shape but exercises the admin-specific security properties: identical
// generic rejection for wrong-password/unknown-email/non-admin-account,
// mandatory OTP with no trusted-device bypass, and adminOnly route gating.
jest.mock('../utils/email');

const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');

async function createAdmin(overrides = {}) {
  return User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'adminpass123',
    role: 'admin',
    isEmailVerified: true,
    ...overrides,
  });
}

async function createConsumer(overrides = {}) {
  return User.create({
    name: 'Regular User',
    email: 'user@example.com',
    password: 'userpass123',
    role: 'user',
    isEmailVerified: true,
    ...overrides,
  });
}

describe('POST /api/admin/auth/login', () => {
  test('wrong password for an admin account is rejected with the generic message', async () => {
    await createAdmin();

    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  test('unknown email is rejected with the identical generic message', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  // Real security property, asserted explicitly per design: a non-admin
  // account's CORRECT password must be rejected with the exact same
  // message a wrong password gets — never revealing that the account
  // exists but simply isn't an admin.
  test('a non-admin user\'s correct password is rejected with the identical generic message', async () => {
    await createConsumer();

    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'user@example.com', password: 'userpass123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('correct admin credentials send an OTP (step: "otp") and there is no deviceToken bypass field accepted', async () => {
    await createAdmin();

    // Even if a client sends a deviceToken (as consumer /auth/login
    // supports), admin login has no trusted-device concept — it should be
    // silently ignored and OTP still required.
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'adminpass123', deviceToken: 'fake-device-token' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, step: 'otp' });
    expect(res.body).not.toHaveProperty('token');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('an inactive admin account is rejected with the generic message', async () => {
    await createAdmin({ isActive: false });

    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'adminpass123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  test('an invalid email format is rejected by validation with 400', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'not-an-email', password: 'adminpass123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/admin/auth/verify-otp', () => {
  async function createAdminWithOtp() {
    const admin = await createAdmin();
    const rawOtp = admin.generateOtp();
    await admin.save({ validateBeforeSave: false });
    return { admin, rawOtp };
  }

  test('wrong code decrements attempts and reports remaining attempts', async () => {
    await createAdminWithOtp();

    const res = await request(app)
      .post('/api/admin/auth/verify-otp')
      .send({ email: 'admin@example.com', otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Incorrect code. 4 attempts remaining.');
  });

  test('missing/expired OTP is rejected with a clear message', async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .post('/api/admin/auth/verify-otp')
      .send({ email: admin.email, otp: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  test('correct code returns a JWT and the response has no deviceToken/rememberDays concept', async () => {
    const { rawOtp } = await createAdminWithOtp();

    const res = await request(app)
      .post('/api/admin/auth/verify-otp')
      .send({ email: 'admin@example.com', otp: rawOtp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ email: 'admin@example.com', role: 'admin' });
    // Admin verify-otp response shape has no device-trust fields at all,
    // unlike the consumer flow's deviceToken/deviceExpires.
    expect(res.body).not.toHaveProperty('deviceToken');
    expect(res.body).not.toHaveProperty('deviceExpires');
  });

  test('a non-admin account cannot verify-otp on the admin endpoint even with a valid OTP for that email', async () => {
    const user = await createConsumer();
    const rawOtp = user.generateOtp();
    await user.save({ validateBeforeSave: false });

    // adminVerifyOtp scopes its lookup to role: 'admin', so this consumer
    // account should not be found at all on this endpoint.
    const res = await request(app)
      .post('/api/admin/auth/verify-otp')
      .send({ email: user.email, otp: rawOtp });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/auth/me — adminOnly gating', () => {
  async function tokenFor(user) {
    const rawOtp = user.generateOtp();
    await user.save({ validateBeforeSave: false });
    // Admin token must come through the admin verify-otp endpoint (it's the
    // only place authAdminController's generateToken is invoked); for a
    // non-admin user we instead go through the consumer verify-otp endpoint
    // to get a structurally valid JWT for a non-admin account.
    const path = user.role === 'admin' ? '/api/admin/auth/verify-otp' : '/api/auth/verify-otp';
    const res = await request(app).post(path).send({ email: user.email, otp: rawOtp });
    return res.body.token;
  }

  test('requires a Bearer token at all (401)', async () => {
    const res = await request(app).get('/api/admin/auth/me');
    expect(res.status).toBe(401);
  });

  test('a valid token for a non-admin user is rejected with 403', async () => {
    const user = await createConsumer();
    const token = await tokenFor(user);
    expect(token).toBeTruthy();

    const res = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Admin access only' });
  });

  test('a valid token for an admin user succeeds with 200', async () => {
    const admin = await createAdmin();
    const token = await tokenFor(admin);
    expect(token).toBeTruthy();

    const res = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe('admin');
  });
});

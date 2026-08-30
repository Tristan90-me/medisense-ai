// Integration tests for the consumer auth flow (routes/auth.js ->
// controllers/authController.js), exercised through supertest against the
// real configured app (app.js) and a real Mongoose User model backed by an
// in-memory MongoDB (see tests/setup.js). Only email sending is mocked.
jest.mock('../utils/email');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');

const validUser = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: 'password123',
};

// Helper: create a verified user directly via the model (bypassing the
// register endpoint/email flow) so login-flow tests don't depend on
// register() also working.
async function createVerifiedUser(overrides = {}) {
  const user = await User.create({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'password123',
    isEmailVerified: true,
    ...overrides,
  });
  return user;
}

describe('POST /api/auth/register', () => {
  test('registers a new user successfully and sends a verification email', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
    });

    const stored = await User.findOne({ email: validUser.email });
    expect(stored).not.toBeNull();
    expect(stored.isEmailVerified).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: validUser.email });
  });

  test('rejects a duplicate email with 400', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('rejects an invalid email with a 400 from the validation layer', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors.some((e) => e.field === 'email')).toBe(true);
    // Validation should reject before the controller ever runs a query.
    const stored = await User.findOne({ name: validUser.name });
    expect(stored).toBeNull();
  });

  test('rejects a too-short password with a 400 from the validation layer', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.some((e) => e.field === 'password')).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  test('rejects a wrong password with a generic "Invalid credentials" message', async () => {
    await createVerifiedUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  test('rejects an unknown email with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  test('rejects login for an unverified email with 403', async () => {
    await createVerifiedUser({ isEmailVerified: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('correct credentials for a verified user send an OTP (step: "otp")', async () => {
    await createVerifiedUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, step: 'otp' });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const stored = await User.findOne({ email: 'jane@example.com' });
    expect(stored.loginOtp).toBeTruthy();
  });

  test('an invalid email format is rejected by validation before hitting the controller', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/verify-otp', () => {
  // OTP generation is only reachable through the model's own method (the
  // raw code is hashed before storage), so we call it directly here rather
  // than re-deriving the hashing in the test.
  async function createUserWithOtp() {
    const user = await createVerifiedUser();
    const rawOtp = user.generateOtp();
    await user.save({ validateBeforeSave: false });
    return { user, rawOtp };
  }

  test('rejects a malformed (non-6-digit) OTP at the validation layer with 400', async () => {
    await createUserWithOtp();

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'jane@example.com', otp: '12' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'otp')).toBe(true);
  });

  test('wrong code decrements attempts and reports remaining attempts', async () => {
    await createUserWithOtp();

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'jane@example.com', otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Incorrect code. 4 attempts remaining.');

    const stored = await User.findOne({ email: 'jane@example.com' });
    expect(stored.loginOtpAttempts).toBe(1);
  });

  test('missing/expired OTP is rejected with a clear message', async () => {
    const user = await createVerifiedUser();
    // No OTP was ever generated for this user.
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: user.email, otp: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  test('an actually expired OTP is rejected with the expired message', async () => {
    const user = await createVerifiedUser();
    const rawOtp = user.generateOtp();
    user.loginOtpExpires = Date.now() - 1000; // force expiry
    await user.save({ validateBeforeSave: false });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: user.email, otp: rawOtp });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  test('correct code returns a JWT and clears the OTP', async () => {
    const { rawOtp } = await createUserWithOtp();

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'jane@example.com', otp: rawOtp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(10);
    expect(res.body.user).toMatchObject({ email: 'jane@example.com' });

    const stored = await User.findOne({ email: 'jane@example.com' });
    expect(stored.loginOtp).toBeFalsy();
    expect(stored.loginOtpAttempts).toBe(0);
  });

  test('5 wrong attempts locks out further attempts with 429', async () => {
    await createUserWithOtp();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'jane@example.com', otp: '000000' });
    }

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'jane@example.com', otp: '000000' });

    expect(res.status).toBe(429);
  });
});

describe('GET /api/auth/me', () => {
  test('requires a valid Bearer token (401 with none provided)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('rejects a garbage/invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns the current user for a valid token obtained via the real login flow', async () => {
    const user = await createVerifiedUser();
    const rawOtp = user.generateOtp();
    await user.save({ validateBeforeSave: false });

    const otpRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: user.email, otp: rawOtp });
    const { token } = otpRes.body;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.password).toBeUndefined();
  });
});

describe('OTP hashing is verified against a real crypto-derived value (sanity check on our test helper)', () => {
  test('generateOtp stores a sha256 hash, not the plaintext code', async () => {
    const user = await createVerifiedUser();
    const rawOtp = user.generateOtp();
    const expectedHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    expect(user.loginOtp).toBe(expectedHash);
  });
});

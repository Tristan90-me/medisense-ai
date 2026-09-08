// Integration tests for the CSV export endpoints (7c). Verifies content
// type/headers, that streamed rows match filtered data, an audit log entry
// is created, and non-admin access is rejected.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');

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

async function createConsumer(overrides = {}) {
  return User.create({
    name: 'Regular User',
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

describe('GET /api/admin/export/users.csv', () => {
  test('streams a CSV with the expected header row and a matching row per user', async () => {
    const admin = await createAdmin();
    const consumer = await createConsumer({ name: 'Csv Person', email: 'csv-person@example.com' });
    const token = tokenFor(admin);

    const res = await request(app)
      .get('/api/admin/export/users.csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/users\.csv/);
    expect(res.text).toContain('name,email,role,isActive,createdAt,sessionCount');
    expect(res.text).toContain('Csv Person');
    expect(res.text).toContain(consumer.email);

    const logs = await AuditLog.find({ action: 'export.users' });
    expect(logs).toHaveLength(1);
    expect(logs[0].actor.toString()).toBe(admin._id.toString());
  });

  test('non-admin gets 403', async () => {
    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .get('/api/admin/export/users.csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/export/sessions.csv', () => {
  test('respects the emergency filter and creates an export.sessions audit entry', async () => {
    const admin = await createAdmin();
    const consumer = await createConsumer();
    const token = tokenFor(admin);

    await Session.create([
      { user: consumer._id, emergencyDetected: true, mode: 'quick', status: 'completed' },
      { user: consumer._id, emergencyDetected: false, mode: 'quick', status: 'completed' },
    ]);

    const res = await request(app)
      .get('/api/admin/export/sessions.csv')
      .query({ emergency: 'true' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const rows = res.text.trim().split('\n');
    // header + exactly one matching data row
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('true');

    const logs = await AuditLog.find({ action: 'export.sessions' });
    expect(logs).toHaveLength(1);
  });

  test('non-admin gets 403', async () => {
    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .get('/api/admin/export/sessions.csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

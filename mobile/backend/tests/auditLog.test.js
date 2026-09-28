// Integration tests for the audit log: that sensitive admin actions
// (inviteAdmin, revokeInvite, toggleUserStatus) actually write an AuditLog
// entry as a side effect, and that GET /admin/audit-log paginates/filters
// correctly. utils/email is mocked so inviteAdmin's send doesn't hit a real
// provider.
jest.mock('../utils/email');

const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

describe('audit logging side effects', () => {
  test('POST /admin/invites creates an admin.invite audit log entry', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/admin/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Admin', email: 'new-admin@example.com' });

    expect(res.status).toBe(201);

    const logs = await AuditLog.find({ action: 'admin.invite' });
    expect(logs).toHaveLength(1);
    expect(logs[0].actor.toString()).toBe(admin._id.toString());
    expect(logs[0].targetType).toBe('User');
    expect(logs[0].metadata.email).toBe('new-admin@example.com');
  });

  test('inviting an already-existing active user does NOT create an audit log entry', async () => {
    const admin = await createAdmin();
    const existing = await createConsumer({ email: 'existing@example.com' });
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/admin/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Whoever', email: existing.email });

    expect(res.status).toBe(400);
    const logs = await AuditLog.find({ action: 'admin.invite' });
    expect(logs).toHaveLength(0);
  });

  test('DELETE /admin/invites/:id creates an admin.invite.revoke audit log entry', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const inviteRes = await request(app)
      .post('/api/admin/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Revoke Me', email: 'revoke-me@example.com' });
    expect(inviteRes.status).toBe(201);

    const invite = await User.findOne({ email: 'revoke-me@example.com' });

    const res = await request(app)
      .delete(`/api/admin/invites/${invite._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const logs = await AuditLog.find({ action: 'admin.invite.revoke' });
    expect(logs).toHaveLength(1);
    expect(logs[0].targetId.toString()).toBe(invite._id.toString());
    expect(logs[0].metadata.email).toBe('revoke-me@example.com');
  });

  test('PATCH /admin/users/:id/toggle creates a user.toggle_status audit log entry', async () => {
    const admin = await createAdmin();
    const consumer = await createConsumer();
    const token = tokenFor(admin);

    const res = await request(app)
      .patch(`/api/admin/users/${consumer._id}/toggle`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const logs = await AuditLog.find({ action: 'user.toggle_status' });
    expect(logs).toHaveLength(1);
    expect(logs[0].targetId.toString()).toBe(consumer._id.toString());
    expect(logs[0].metadata.isActive).toBe(false);
  });
});

describe('GET /api/admin/audit-log', () => {
  test('non-admin token gets 403', async () => {
    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('paginates and filters by action', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    await AuditLog.create([
      { actor: admin._id, action: 'admin.invite', targetType: 'User', targetId: admin._id, ip: '1.1.1.1' },
      { actor: admin._id, action: 'user.toggle_status', targetType: 'User', targetId: admin._id, ip: '1.1.1.1' },
      { actor: admin._id, action: 'admin.invite', targetType: 'User', targetId: admin._id, ip: '1.1.1.1' },
    ]);

    const res = await request(app)
      .get('/api/admin/audit-log')
      .query({ action: 'admin.invite' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.logs).toHaveLength(2);
    res.body.logs.forEach((l) => expect(l.action).toBe('admin.invite'));
    expect(res.body.logs[0].actor).toMatchObject({ email: admin.email });
  });

  test('pagination limit is respected', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const entries = Array.from({ length: 5 }).map(() => ({
      actor: admin._id, action: 'settings.update', targetType: 'SystemSetting', ip: '1.1.1.1',
    }));
    await AuditLog.create(entries);

    const res = await request(app)
      .get('/api/admin/audit-log')
      .query({ limit: 2, page: 1 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.pages).toBe(3);
  });
});

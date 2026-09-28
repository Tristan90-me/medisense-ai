// Integration tests for the broadcast announcements feature: admin-only
// create/delete, plain-protect list, validation, and the audit log side
// effects — same AuditLog.findOne(...) pattern as tests/auditLog.test.js.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Announcement = require('../models/Announcement');
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

describe('POST /api/announcements', () => {
  test('admin can create an announcement and it writes an audit log entry', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Scheduled maintenance', body: 'MediSense AI will be briefly unavailable tonight.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.announcement.title).toBe('Scheduled maintenance');
    expect(res.body.announcement.createdBy.toString()).toBe(admin._id.toString());

    const log = await AuditLog.findOne({ action: 'announcement.create' });
    expect(log).not.toBeNull();
    expect(log.actor.toString()).toBe(admin._id.toString());
    expect(log.targetType).toBe('Announcement');
    expect(log.targetId.toString()).toBe(res.body.announcement._id);
  });

  test('non-admin gets 403', async () => {
    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hi', body: 'Should not be allowed' });

    expect(res.status).toBe(403);
  });

  test('rejects an empty title', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '   ', body: 'Valid body' });

    expect(res.status).toBe(400);
  });

  test('rejects an empty body', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Valid title', body: '' });

    expect(res.status).toBe(400);
  });

  test('rejects an over-length title', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x'.repeat(201), body: 'Valid body' });

    expect(res.status).toBe(400);
  });

  test('rejects an over-length body', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Valid title', body: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/announcements', () => {
  test('any authenticated user (including non-admin) can list announcements', async () => {
    const admin = await createAdmin();
    await Announcement.create({ title: 'First', body: 'Body one', createdBy: admin._id });

    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.announcements.length).toBe(1);
  });

  test('returns most-recent-first', async () => {
    const admin = await createAdmin();
    const older = await Announcement.create({
      title: 'Older', body: 'Body', createdBy: admin._id, sentAt: new Date(Date.now() - 60000),
    });
    const newer = await Announcement.create({
      title: 'Newer', body: 'Body', createdBy: admin._id, sentAt: new Date(),
    });

    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.announcements[0]._id).toBe(newer._id.toString());
    expect(res.body.announcements[1]._id).toBe(older._id.toString());
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/announcements');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/announcements/:id', () => {
  test('admin can delete and it writes an audit log entry', async () => {
    const admin = await createAdmin();
    const announcement = await Announcement.create({ title: 'Delete me', body: 'Body', createdBy: admin._id });
    const token = tokenFor(admin);

    const res = await request(app)
      .delete(`/api/announcements/${announcement._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stillExists = await Announcement.findById(announcement._id);
    expect(stillExists).toBeNull();

    const log = await AuditLog.findOne({ action: 'announcement.delete' });
    expect(log).not.toBeNull();
    expect(log.targetId.toString()).toBe(announcement._id.toString());
  });

  test('non-admin gets 403', async () => {
    const admin = await createAdmin();
    const announcement = await Announcement.create({ title: 'Keep me', body: 'Body', createdBy: admin._id });
    const consumer = await createConsumer();
    const token = tokenFor(consumer);

    const res = await request(app)
      .delete(`/api/announcements/${announcement._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);

    const stillExists = await Announcement.findById(announcement._id);
    expect(stillExists).not.toBeNull();
  });

  test('deleting a nonexistent id returns 404', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);
    const fakeId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .delete(`/api/announcements/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

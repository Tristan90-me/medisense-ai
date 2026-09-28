// Integration tests for the broadcast announcements feature: admin-only
// create/delete, plain-protect list, validation, and the audit log side
// effects — same AuditLog.findOne(...) pattern as tests/auditLog.test.js.
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
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

  test('audience "user" targets exactly one recipient, snapshots their name/email, and only they see it', async () => {
    const admin = await createAdmin();
    const target = await createConsumer({ name: 'Target User' });
    const other = await createConsumer({ name: 'Other User' });
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Just for you', body: 'A personal note.', audience: 'user', targetUserId: target._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.announcement.recipientCount).toBe(1);
    expect(res.body.announcement.recipientIds).toEqual([target._id.toString()]);
    expect(res.body.announcement.targetUserSnapshot.name).toBe('Target User');

    const targetRes = await request(app).get('/api/announcements').set('Authorization', `Bearer ${tokenFor(target)}`);
    expect(targetRes.body.announcements.some((a) => a.title === 'Just for you')).toBe(true);

    const otherRes = await request(app).get('/api/announcements').set('Authorization', `Bearer ${tokenFor(other)}`);
    expect(otherRes.body.announcements.some((a) => a.title === 'Just for you')).toBe(false);
  });

  test('audience "user" with a nonexistent targetUserId returns 404', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);
    const fakeId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Hi', body: 'Body', audience: 'user', targetUserId: fakeId,
      });

    expect(res.status).toBe(404);
  });

  test('audience "user" without targetUserId is rejected', async () => {
    const admin = await createAdmin();
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hi', body: 'Body', audience: 'user' });

    expect(res.status).toBe(400);
  });

  test('audience "critical" reaches only users with a recent emergency/Critical session, excluding admins and deactivated users', async () => {
    const admin = await createAdmin();
    const criticalUser = await createConsumer({ name: 'Critical User' });
    const normalUser = await createConsumer({ name: 'Normal User' });
    const deactivatedCriticalUser = await createConsumer({ name: 'Deactivated Critical User', isActive: false });
    const criticalAdmin = await createAdmin({ email: `critical-admin-${Date.now()}@example.com` });

    await Session.create({ user: criticalUser._id, severityLevel: 'Critical' });
    await Session.create({ user: normalUser._id, severityLevel: 'Low' });
    await Session.create({ user: deactivatedCriticalUser._id, emergencyDetected: true });
    await Session.create({ user: criticalAdmin._id, emergencyDetected: true });

    const token = tokenFor(admin);
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Please check in', body: 'We noticed a recent critical symptom check.', audience: 'critical', criticalWindowDays: 30,
      });

    expect(res.status).toBe(201);
    expect(res.body.announcement.recipientCount).toBe(1);
    expect(res.body.announcement.recipientIds).toEqual([criticalUser._id.toString()]);
    expect(res.body.announcement.criticalWindowDays).toBe(30);

    const criticalRes = await request(app).get('/api/announcements').set('Authorization', `Bearer ${tokenFor(criticalUser)}`);
    expect(criticalRes.body.announcements.some((a) => a.title === 'Please check in')).toBe(true);

    const normalRes = await request(app).get('/api/announcements').set('Authorization', `Bearer ${tokenFor(normalUser)}`);
    expect(normalRes.body.announcements.some((a) => a.title === 'Please check in')).toBe(false);
  });
});

describe('GET /api/announcements/critical-preview', () => {
  test('returns a count and sample of users with a recent emergency/Critical session', async () => {
    const admin = await createAdmin();
    const criticalUser = await createConsumer({ name: 'Preview Critical User' });
    const normalUser = await createConsumer();
    await Session.create({ user: criticalUser._id, emergencyDetected: true });
    await Session.create({ user: normalUser._id, severityLevel: 'Low' });

    const res = await request(app)
      .get('/api/announcements/critical-preview')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.sample[0].name).toBe('Preview Critical User');
  });

  test('non-admin gets 403', async () => {
    const consumer = await createConsumer();

    const res = await request(app)
      .get('/api/announcements/critical-preview')
      .set('Authorization', `Bearer ${tokenFor(consumer)}`);

    expect(res.status).toBe(403);
  });

  test('rejects an out-of-range days value', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/announcements/critical-preview?days=999')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

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

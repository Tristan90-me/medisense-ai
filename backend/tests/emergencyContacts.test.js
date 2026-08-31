// Integration tests for the Emergency Contacts CRUD API
// (routes/emergencyContacts.js -> controllers/emergencyContactController.js).
// Nothing here calls email or Gemini, so nothing needs mocking.
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const EmergencyContact = require('../models/EmergencyContact');
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

describe('Emergency Contacts CRUD', () => {
  test('create, list, update, and delete an emergency contact', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const create = await request(app)
      .post('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Jane Doe', relationship: 'spouse', phone: '+1 555-123-4567', email: 'jane@example.com',
      });
    expect(create.status).toBe(201);
    expect(create.body.contact.name).toBe('Jane Doe');
    expect(create.body.contact.isPrimary).toBe(false);
    const id = create.body.contact._id;

    const list = await request(app)
      .get('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.contacts).toHaveLength(1);

    const update = await request(app)
      .put(`/api/emergency-contacts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Updated', isPrimary: true });
    expect(update.status).toBe(200);
    expect(update.body.contact.name).toBe('Jane Updated');
    expect(update.body.contact.isPrimary).toBe(true);

    const del = await request(app)
      .delete(`/api/emergency-contacts/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.contacts).toHaveLength(0);
  });

  test('missing required fields are rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .post('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Phone' });

    expect(res.status).toBe(400);
  });

  test('invalid email is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .post('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Email', phone: '5551234567', email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  test('phone shorter than the permissive minimum is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .post('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Too Short', phone: '123' });

    expect(res.status).toBe(400);
  });

  // Deliberate behavior, documented so it never gets "fixed" as a bug:
  // the roadmap does not require exactly one primary contact, so multiple
  // contacts may simultaneously have isPrimary: true.
  test('multiple contacts may have isPrimary: true simultaneously', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const first = await request(app)
      .post('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'First Primary', phone: '5551110000', isPrimary: true,
      });
    expect(first.status).toBe(201);
    expect(first.body.contact.isPrimary).toBe(true);

    const second = await request(app)
      .post('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Second Primary', phone: '5552220000', isPrimary: true,
      });
    expect(second.status).toBe(201);
    expect(second.body.contact.isPrimary).toBe(true);

    const list = await request(app)
      .get('/api/emergency-contacts')
      .set('Authorization', `Bearer ${token}`);
    const primaries = list.body.contacts.filter((c) => c.isPrimary);
    expect(primaries).toHaveLength(2);
  });

  // Security property, asserted explicitly: user B must never be able to
  // read/update/delete user A's emergency contact by id, even by
  // guessing/reusing it — 404, not 403, so existence is never confirmed either.
  describe('ownership scoping', () => {
    let contactId;
    let userA;
    let tokenB;

    beforeEach(async () => {
      userA = await createUser({ email: 'a@example.com' });
      const userB = await createUser({ email: 'b@example.com' });
      tokenB = tokenFor(userB);

      const contact = await EmergencyContact.create({ user: userA._id, name: "A's Contact", phone: '5559998888' });
      contactId = contact._id;
    });

    test('user B cannot update user A\'s emergency contact', async () => {
      const res = await request(app)
        .put(`/api/emergency-contacts/${contactId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    test('user B cannot delete user A\'s emergency contact', async () => {
      const res = await request(app)
        .delete(`/api/emergency-contacts/${contactId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);

      const stillExists = await EmergencyContact.findById(contactId);
      expect(stillExists).not.toBeNull();
    });

    test('user B\'s contact list never includes user A\'s contact', async () => {
      const res = await request(app)
        .get('/api/emergency-contacts')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.body.contacts).toHaveLength(0);
    });
  });
});

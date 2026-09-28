// Integration tests for the Dependents CRUD API (routes/dependents.js ->
// controllers/dependentController.js). Nothing here calls email or Gemini,
// so nothing needs mocking.
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const HealthProfile = require('../models/HealthProfile');
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

describe('Dependents CRUD', () => {
  test('create, list, update, and delete a dependent', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const create = await request(app)
      .post('/api/dependents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Kiddo', relationship: 'child', dateOfBirth: '2015-01-01', sex: 'female' });
    expect(create.status).toBe(201);
    expect(create.body.dependent.name).toBe('Kiddo');
    const id = create.body.dependent._id;

    const list = await request(app)
      .get('/api/dependents')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.dependents).toHaveLength(1);

    const update = await request(app)
      .put(`/api/dependents/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Kiddo Updated' });
    expect(update.status).toBe(200);
    expect(update.body.dependent.name).toBe('Kiddo Updated');

    const del = await request(app)
      .delete(`/api/dependents/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get('/api/dependents')
      .set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.dependents).toHaveLength(0);
  });

  test('invalid relationship is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .post('/api/dependents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Kiddo', relationship: 'robot' });

    expect(res.status).toBe(400);
  });

  // Security property, asserted explicitly: user B must never be able to
  // read/update/delete user A's dependent by id, even by guessing/reusing
  // it — 404, not 403, so existence is never confirmed either.
  describe('ownership scoping', () => {
    let dependentId;
    let userA;
    let tokenB;

    beforeEach(async () => {
      userA = await createUser({ email: 'a@example.com' });
      const userB = await createUser({ email: 'b@example.com' });
      tokenB = tokenFor(userB);

      const dependent = await Dependent.create({ owner: userA._id, name: 'A\'s Kid', relationship: 'child' });
      dependentId = dependent._id;
    });

    test('user B cannot update user A\'s dependent', async () => {
      const res = await request(app)
        .put(`/api/dependents/${dependentId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    test('user B cannot delete user A\'s dependent', async () => {
      const res = await request(app)
        .delete(`/api/dependents/${dependentId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);

      const stillExists = await Dependent.findById(dependentId);
      expect(stillExists).not.toBeNull();
    });

    test('user B\'s dependent list never includes user A\'s dependent', async () => {
      const res = await request(app)
        .get('/api/dependents')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.body.dependents).toHaveLength(0);
    });
  });

  test('deleting a dependent also removes their HealthProfile row', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const create = await request(app)
      .post('/api/dependents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Kiddo', relationship: 'child' });
    const id = create.body.dependent._id;

    await HealthProfile.create({ user: user._id, dependent: id, bloodType: 'O+' });
    expect(await HealthProfile.findOne({ dependent: id })).not.toBeNull();

    await request(app)
      .delete(`/api/dependents/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(await HealthProfile.findOne({ dependent: id })).toBeNull();
  });
});

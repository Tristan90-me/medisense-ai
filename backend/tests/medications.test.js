// Integration tests for the Medications CRUD API (routes/medications.js ->
// controllers/medicationController.js). Nothing here calls email or Gemini,
// so nothing needs mocking.
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const Medication = require('../models/Medication');
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

describe('Medications CRUD', () => {
  test('create, list, update, and delete a self medication', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const create = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Ibuprofen', dosage: '200mg', frequency: 'Twice daily', reminderTimes: ['08:00', '20:00'],
      });
    expect(create.status).toBe(201);
    expect(create.body.medication.name).toBe('Ibuprofen');
    expect(create.body.medication.dependent).toBeNull();
    const id = create.body.medication._id;

    const list = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.medications).toHaveLength(1);

    const update = await request(app)
      .put(`/api/medications/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dosage: '400mg' });
    expect(update.status).toBe(200);
    expect(update.body.medication.dosage).toBe('400mg');

    const del = await request(app)
      .delete(`/api/medications/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.medications).toHaveLength(0);
  });

  test('create, list, update, and delete a dependent medication', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });

    const create = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Amoxicillin', dependent: dependent._id.toString() });
    expect(create.status).toBe(201);
    expect(create.body.medication.dependent).toBe(dependent._id.toString());
    const id = create.body.medication._id;

    const list = await request(app)
      .get(`/api/medications?dependent=${dependent._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.medications).toHaveLength(1);

    const update = await request(app)
      .put(`/api/medications/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Amoxicillin 500mg' });
    expect(update.status).toBe(200);
    expect(update.body.medication.name).toBe('Amoxicillin 500mg');

    const del = await request(app)
      .delete(`/api/medications/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get(`/api/medications?dependent=${dependent._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.medications).toHaveLength(0);
  });

  test('invalid reminderTimes entry is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ibuprofen', reminderTimes: ['25:99'] });

    expect(res.status).toBe(400);
  });

  test('?dependent=<id> filters to only that person, omitting it unions self + all dependents', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });

    await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Self Med' });
    await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dependent Med', dependent: dependent._id.toString() });

    const filteredToDependent = await request(app)
      .get(`/api/medications?dependent=${dependent._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(filteredToDependent.body.medications).toHaveLength(1);
    expect(filteredToDependent.body.medications[0].name).toBe('Dependent Med');

    const unfiltered = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${token}`);
    expect(unfiltered.body.medications).toHaveLength(2);
    const names = unfiltered.body.medications.map((m) => m.name).sort();
    expect(names).toEqual(['Dependent Med', 'Self Med']);
  });

  test('active: false records still appear in the unfiltered list', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Discontinued Med', active: false });

    const list = await request(app)
      .get('/api/medications')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.medications).toHaveLength(1);
    expect(list.body.medications[0].active).toBe(false);
  });

  // Security property, asserted explicitly: user B must never be able to
  // read/update/delete user A's medication by id, even by guessing/reusing
  // it — 404, not 403, so existence is never confirmed either.
  describe('ownership scoping', () => {
    let medicationId;
    let userA;
    let dependentA;
    let tokenB;

    beforeEach(async () => {
      userA = await createUser({ email: 'a@example.com' });
      const userB = await createUser({ email: 'b@example.com' });
      tokenB = tokenFor(userB);

      dependentA = await Dependent.create({ owner: userA._id, name: "A's Kid", relationship: 'child' });
      const medication = await Medication.create({ user: userA._id, name: "A's Med" });
      medicationId = medication._id;
    });

    test("user B cannot update user A's medication", async () => {
      const res = await request(app)
        .put(`/api/medications/${medicationId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    test("user B cannot delete user A's medication", async () => {
      const res = await request(app)
        .delete(`/api/medications/${medicationId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);

      const stillExists = await Medication.findById(medicationId);
      expect(stillExists).not.toBeNull();
    });

    test("user B's medication list never includes user A's medication", async () => {
      const res = await request(app)
        .get('/api/medications')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.body.medications).toHaveLength(0);
    });

    test("user B cannot read user A's medications via ?dependent=<A's dependent id>", async () => {
      const res = await request(app)
        .get(`/api/medications?dependent=${dependentA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    test("cannot create a medication with a dependent id belonging to a different user", async () => {
      const res = await request(app)
        .post('/api/medications')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Sneaky Med', dependent: dependentA._id.toString() });
      expect(res.status).toBe(404);
    });

    test("cannot update a medication to reference a dependent id belonging to a different user", async () => {
      const ownMedication = await Medication.create({ user: (await User.findOne({ email: 'b@example.com' }))._id, name: 'Own Med' });
      const res = await request(app)
        .put(`/api/medications/${ownMedication._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ dependent: dependentA._id.toString() });
      expect(res.status).toBe(404);
    });
  });
});

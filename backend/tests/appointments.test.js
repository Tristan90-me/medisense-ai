// Integration tests for the Appointments CRUD API (routes/appointments.js ->
// controllers/appointmentController.js). Nothing here calls email or
// Gemini, so nothing needs mocking. Mirrors tests/medications.test.js's
// structure since the two controllers share the same shape.
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const Appointment = require('../models/Appointment');
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

describe('Appointments CRUD', () => {
  test('create, list, update, and delete a self appointment', async () => {
    const user = await createUser();
    const token = tokenFor(user);

    const create = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctorName: 'Dr. Mensah', specialty: 'General Physician', dateTime: '2026-12-01T10:30:00.000Z', location: 'University Hospital',
      });
    expect(create.status).toBe(201);
    expect(create.body.appointment.doctorName).toBe('Dr. Mensah');
    expect(create.body.appointment.status).toBe('scheduled');
    expect(create.body.appointment.dependent).toBeNull();
    const id = create.body.appointment._id;

    const list = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.appointments).toHaveLength(1);

    const update = await request(app)
      .put(`/api/appointments/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ location: 'Korle Bu Hospital' });
    expect(update.status).toBe(200);
    expect(update.body.appointment.location).toBe('Korle Bu Hospital');

    const del = await request(app)
      .delete(`/api/appointments/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.appointments).toHaveLength(0);
  });

  test('create, list, update, and delete a dependent appointment', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });

    const create = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorName: 'Dr. Owusu', dateTime: '2026-12-05T09:00:00.000Z', dependent: dependent._id.toString() });
    expect(create.status).toBe(201);
    expect(create.body.appointment.dependent).toBe(dependent._id.toString());
    const id = create.body.appointment._id;

    const list = await request(app)
      .get(`/api/appointments?dependent=${dependent._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.appointments).toHaveLength(1);

    const del = await request(app)
      .delete(`/api/appointments/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });

  test('missing doctorName is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ dateTime: '2026-12-01T10:30:00.000Z' });
    expect(res.status).toBe(400);
  });

  test('missing dateTime is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorName: 'Dr. Mensah' });
    expect(res.status).toBe(400);
  });

  test('invalid dateTime is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorName: 'Dr. Mensah', dateTime: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  test('setting status: cancelled cancels rather than deletes', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const appointment = await Appointment.create({ user: user._id, doctorName: 'Dr. Mensah', dateTime: new Date('2026-12-01') });

    const res = await request(app)
      .put(`/api/appointments/${appointment._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('cancelled');
    const stillExists = await Appointment.findById(appointment._id);
    expect(stillExists).not.toBeNull();
  });

  test('invalid status value is rejected with 400', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const appointment = await Appointment.create({ user: user._id, doctorName: 'Dr. Mensah', dateTime: new Date('2026-12-01') });
    const res = await request(app)
      .put(`/api/appointments/${appointment._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'bogus' });
    expect(res.status).toBe(400);
  });

  test('list is sorted soonest-first', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await Appointment.create({ user: user._id, doctorName: 'Later', dateTime: new Date('2026-12-20') });
    await Appointment.create({ user: user._id, doctorName: 'Sooner', dateTime: new Date('2026-12-01') });

    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.appointments.map((a) => a.doctorName)).toEqual(['Sooner', 'Later']);
  });

  test('?dependent=<id> filters to only that person, omitting it unions self + all dependents', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const dependent = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });

    await request(app).post('/api/appointments').set('Authorization', `Bearer ${token}`).send({ doctorName: 'Self Doc', dateTime: '2026-12-01T10:00:00.000Z' });
    await request(app).post('/api/appointments').set('Authorization', `Bearer ${token}`).send({ doctorName: 'Dependent Doc', dateTime: '2026-12-02T10:00:00.000Z', dependent: dependent._id.toString() });

    const filtered = await request(app).get(`/api/appointments?dependent=${dependent._id}`).set('Authorization', `Bearer ${token}`);
    expect(filtered.body.appointments).toHaveLength(1);
    expect(filtered.body.appointments[0].doctorName).toBe('Dependent Doc');

    const unfiltered = await request(app).get('/api/appointments').set('Authorization', `Bearer ${token}`);
    expect(unfiltered.body.appointments).toHaveLength(2);
  });

  // Security property, asserted explicitly: user B must never be able to
  // read/update/delete user A's appointment by id, even by guessing/reusing
  // it — 404, not 403, so existence is never confirmed either.
  describe('ownership scoping', () => {
    let appointmentId;
    let userA;
    let dependentA;
    let tokenB;

    beforeEach(async () => {
      userA = await createUser({ email: 'a@example.com' });
      const userB = await createUser({ email: 'b@example.com' });
      tokenB = tokenFor(userB);

      dependentA = await Dependent.create({ owner: userA._id, name: "A's Kid", relationship: 'child' });
      const appointment = await Appointment.create({ user: userA._id, doctorName: "A's Doctor", dateTime: new Date('2026-12-01') });
      appointmentId = appointment._id;
    });

    test("user B cannot update user A's appointment", async () => {
      const res = await request(app)
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ doctorName: 'Hacked' });
      expect(res.status).toBe(404);

      const unchanged = await Appointment.findById(appointmentId);
      expect(unchanged.doctorName).toBe("A's Doctor");
    });

    test("user B cannot delete user A's appointment", async () => {
      const res = await request(app)
        .delete(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);

      const stillExists = await Appointment.findById(appointmentId);
      expect(stillExists).not.toBeNull();
    });

    test("user B's appointment list never includes user A's appointment", async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.body.appointments).toHaveLength(0);
    });

    test("user B cannot read user A's appointments via ?dependent=<A's dependent id>", async () => {
      const res = await request(app)
        .get(`/api/appointments?dependent=${dependentA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    test('cannot create an appointment with a dependent id belonging to a different user', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ doctorName: 'Sneaky Doc', dateTime: '2026-12-01T10:00:00.000Z', dependent: dependentA._id.toString() });
      expect(res.status).toBe(404);
    });
  });
});

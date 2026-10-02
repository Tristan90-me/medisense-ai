// Integration tests for /api/workouts (routes/workouts.js -> controllers/workoutController.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const HealthProfile = require('../models/HealthProfile');
const Exercise = require('../models/Exercise');
const WorkoutLog = require('../models/WorkoutLog');
const { MET_BY_TYPE } = require('../utils/workoutMath');

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

const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });
const makeExercise = (name = 'Bench Press') => Exercise.create({ name, category: 'chest', source: 'custom' });

describe('POST /api/workouts — strength', () => {
  test('logs a strength workout, estimates calories from the profile weight, and sets a PR', async () => {
    const user = await createUser();
    await HealthProfile.create({ user: user._id, weight: 80, weightUnit: 'kg' });
    const bench = await makeExercise();

    const res = await request(app).post('/api/workouts').set(auth(user)).send({
      type: 'strength',
      name: 'Push Day',
      durationMin: 60,
      exercises: [{ exercise: bench._id, sets: [{ reps: 8, weightKg: 60 }, { reps: 5, weightKg: 70 }] }],
    });

    expect(res.status).toBe(201);
    expect(res.body.workoutLog.name).toBe('Push Day');
    expect(res.body.workoutLog.exercises[0].name).toBe('Bench Press');
    expect(res.body.workoutLog.caloriesBurned).toBe(Math.round(MET_BY_TYPE.strength * 80));
    expect(res.body.newRecords).toHaveLength(1);
    expect(res.body.newRecords[0]).toMatchObject({ kind: 'strength_weight', value: 70 });
  });

  test('caloriesBurned is 0 when the profile has no weight yet', async () => {
    const user = await createUser();
    const bench = await makeExercise();
    const res = await request(app).post('/api/workouts').set(auth(user)).send({
      type: 'strength', name: 'Push Day', durationMin: 60, exercises: [{ exercise: bench._id, sets: [{ reps: 8, weightKg: 60 }] }],
    });
    expect(res.body.workoutLog.caloriesBurned).toBe(0);
  });

  test('rejects an exercise id that does not exist', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/workouts').set(auth(user)).send({
      type: 'strength', name: 'Push Day', durationMin: 60, exercises: [{ exercise: '507f1f77bcf86cd799439011', sets: [] }],
    });
    expect(res.status).toBe(400);
    expect(await WorkoutLog.countDocuments()).toBe(0);
  });
});

describe('POST /api/workouts — cardio', () => {
  test('logs a run and computes pace', async () => {
    const user = await createUser();
    await HealthProfile.create({ user: user._id, weight: 70, weightUnit: 'kg' });

    const res = await request(app).post('/api/workouts').set(auth(user)).send({
      type: 'cardio', name: 'Morning Run', durationMin: 30, cardio: { distanceKm: 5 },
    });

    expect(res.status).toBe(201);
    expect(res.body.workoutLog.cardio).toMatchObject({ distanceKm: 5, avgPaceMinPerKm: 6 });
    expect(res.body.newRecords.map((r) => r.kind).sort()).toEqual(['cardio_distance', 'cardio_pace']);
  });

  test('requires distanceKm for a cardio workout', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/workouts').set(auth(user)).send({
      type: 'cardio', name: 'Run', durationMin: 30,
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/workouts', () => {
  test('a specific date returns only that day\'s workouts', async () => {
    const user = await createUser();
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'A', durationMin: 30, loggedAt: new Date('2026-01-01T12:00:00.000Z'),
    });
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'B', durationMin: 30, loggedAt: new Date('2026-01-02T12:00:00.000Z'),
    });

    const res = await request(app).get('/api/workouts').query({ date: '2026-01-01' }).set(auth(user));
    expect(res.body.workoutLogs).toHaveLength(1);
    expect(res.body.workoutLogs[0].name).toBe('A');
  });

  test('without a date, returns recent history most-recent-first', async () => {
    const user = await createUser();
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'Older', durationMin: 30, loggedAt: new Date('2026-01-01T12:00:00.000Z'),
    });
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'Newer', durationMin: 30, loggedAt: new Date('2026-01-05T12:00:00.000Z'),
    });

    const res = await request(app).get('/api/workouts').set(auth(user));
    expect(res.body.workoutLogs[0].name).toBe('Newer');
    expect(res.body.workoutLogs[1].name).toBe('Older');
  });
});

describe('dependent scoping', () => {
  test("404s logging against someone else's dependent", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const kid = await Dependent.create({ owner: owner._id, name: 'Kiddo', relationship: 'child' });

    const res = await request(app).post('/api/workouts').set(auth(intruder)).send({
      dependent: String(kid._id), type: 'other', name: 'Kids soccer', durationMin: 30,
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/workouts/records', () => {
  test('returns current PRs with the exercise populated', async () => {
    const user = await createUser();
    const bench = await makeExercise();
    await request(app).post('/api/workouts').set(auth(user)).send({
      type: 'strength', name: 'Push Day', durationMin: 45, exercises: [{ exercise: bench._id, sets: [{ reps: 5, weightKg: 90 }] }],
    });

    const res = await request(app).get('/api/workouts/records').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0].exercise.name).toBe('Bench Press');
    expect(res.body.records[0].value).toBe(90);
  });
});

describe('GET /api/workouts/:id and DELETE', () => {
  test("404s reading someone else's workout log", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const log = await WorkoutLog.create({
      user: owner._id, type: 'other', name: 'Private', durationMin: 20,
    });
    const res = await request(app).get(`/api/workouts/${log._id}`).set(auth(intruder));
    expect(res.status).toBe(404);
  });

  test('deletes a workout log the requester owns', async () => {
    const user = await createUser();
    const log = await WorkoutLog.create({
      user: user._id, type: 'other', name: 'Delete me', durationMin: 20,
    });
    const res = await request(app).delete(`/api/workouts/${log._id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(await WorkoutLog.findById(log._id)).toBeNull();
  });
});

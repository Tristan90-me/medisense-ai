const mongoose = require('mongoose');
const User = require('../models/User');
const Exercise = require('../models/Exercise');
const PersonalRecord = require('../models/PersonalRecord');
const {
  isBetter, maybeSetRecord, evaluateWorkoutForRecords,
} = require('../utils/personalRecords');

describe('isBetter', () => {
  test('higher is better for strength_weight and cardio_distance', () => {
    expect(isBetter('strength_weight', 100, 80)).toBe(true);
    expect(isBetter('strength_weight', 70, 80)).toBe(false);
    expect(isBetter('cardio_distance', 10, 5)).toBe(true);
  });

  test('lower is better for cardio_pace', () => {
    expect(isBetter('cardio_pace', 4.5, 5)).toBe(true); // faster
    expect(isBetter('cardio_pace', 5.5, 5)).toBe(false); // slower
  });

  test('any value beats a missing current value', () => {
    expect(isBetter('strength_weight', 1, null)).toBe(true);
    expect(isBetter('cardio_pace', 999, null)).toBe(true);
  });
});

describe('maybeSetRecord', () => {
  test('sets the first record for a new exercise', async () => {
    const user = await User.create({
      name: 'U', email: `u-${Date.now()}@x.com`, password: 'password123', isEmailVerified: true,
    });
    const exercise = await Exercise.create({ name: 'Bench Press', source: 'custom' });

    const pr = await maybeSetRecord({
      user: user._id, dependent: null, kind: 'strength_weight', exercise: exercise._id, value: 60, achievedAt: new Date(), workoutLog: new mongoose.Types.ObjectId(),
    });
    expect(pr).not.toBeNull();
    expect(pr.value).toBe(60);
  });

  test('does not overwrite a better existing record', async () => {
    const user = await User.create({
      name: 'U', email: `u-${Date.now()}@x.com`, password: 'password123', isEmailVerified: true,
    });
    const exercise = await Exercise.create({ name: 'Squat', source: 'custom' });
    await maybeSetRecord({
      user: user._id, dependent: null, kind: 'strength_weight', exercise: exercise._id, value: 100, achievedAt: new Date(), workoutLog: new mongoose.Types.ObjectId(),
    });

    const result = await maybeSetRecord({
      user: user._id, dependent: null, kind: 'strength_weight', exercise: exercise._id, value: 80, achievedAt: new Date(), workoutLog: new mongoose.Types.ObjectId(),
    });
    expect(result).toBeNull();
    const stored = await PersonalRecord.findOne({ user: user._id, kind: 'strength_weight', exercise: exercise._id });
    expect(stored.value).toBe(100);
  });

  test('a faster cardio_pace replaces a slower one, but a slower one does not', async () => {
    const user = await User.create({
      name: 'U', email: `u-${Date.now()}@x.com`, password: 'password123', isEmailVerified: true,
    });
    await maybeSetRecord({
      user: user._id, dependent: null, kind: 'cardio_pace', value: 6, achievedAt: new Date(), workoutLog: new mongoose.Types.ObjectId(),
    });
    const faster = await maybeSetRecord({
      user: user._id, dependent: null, kind: 'cardio_pace', value: 5, achievedAt: new Date(), workoutLog: new mongoose.Types.ObjectId(),
    });
    const slower = await maybeSetRecord({
      user: user._id, dependent: null, kind: 'cardio_pace', value: 5.5, achievedAt: new Date(), workoutLog: new mongoose.Types.ObjectId(),
    });
    expect(faster.value).toBe(5);
    expect(slower).toBeNull();
  });
});

describe('evaluateWorkoutForRecords', () => {
  test('sets a strength PR from the heaviest set across all logged exercises', async () => {
    const user = await User.create({
      name: 'U', email: `u-${Date.now()}@x.com`, password: 'password123', isEmailVerified: true,
    });
    const exercise = await Exercise.create({ name: 'Deadlift', source: 'custom' });

    const workoutLog = {
      user: user._id,
      dependent: null,
      _id: new mongoose.Types.ObjectId(),
      loggedAt: new Date(),
      type: 'strength',
      exercises: [{
        exercise: exercise._id,
        sets: [{ reps: 5, weightKg: 100 }, { reps: 3, weightKg: 120 }, { reps: 1, weightKg: 110 }],
      }],
    };

    const newRecords = await evaluateWorkoutForRecords(workoutLog);
    expect(newRecords).toHaveLength(1);
    expect(newRecords[0]).toMatchObject({ kind: 'strength_weight', value: 120 });
  });

  test('sets both cardio_distance and cardio_pace from one cardio session', async () => {
    const user = await User.create({
      name: 'U', email: `u-${Date.now()}@x.com`, password: 'password123', isEmailVerified: true,
    });

    const workoutLog = {
      user: user._id,
      dependent: null,
      _id: new mongoose.Types.ObjectId(),
      loggedAt: new Date(),
      type: 'cardio',
      exercises: [],
      cardio: { distanceKm: 5, avgPaceMinPerKm: 5.2 },
    };

    const newRecords = await evaluateWorkoutForRecords(workoutLog);
    const kinds = newRecords.map((r) => r.kind).sort();
    expect(kinds).toEqual(['cardio_distance', 'cardio_pace']);
  });

  test('a flexibility session sets no records', async () => {
    const user = await User.create({
      name: 'U', email: `u-${Date.now()}@x.com`, password: 'password123', isEmailVerified: true,
    });
    const workoutLog = {
      user: user._id, dependent: null, _id: new mongoose.Types.ObjectId(), loggedAt: new Date(), type: 'flexibility', exercises: [],
    };
    expect(await evaluateWorkoutForRecords(workoutLog)).toEqual([]);
  });
});

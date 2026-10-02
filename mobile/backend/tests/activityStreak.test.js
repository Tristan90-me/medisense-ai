const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const { activityStreak } = require('../utils/activityStreak');

const NOW = new Date('2026-01-10T15:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

async function createUser() {
  return User.create({
    name: 'U', email: `u-${Date.now()}-${Math.random()}@x.com`, password: 'password123', isEmailVerified: true,
  });
}

describe('activityStreak', () => {
  test('counts consecutive active days for the given model/field/scope', async () => {
    const user = await createUser();
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'A', durationMin: 20, loggedAt: NOW,
    });
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'B', durationMin: 20, loggedAt: daysAgo(1),
    });
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'C', durationMin: 20, loggedAt: daysAgo(2),
    });

    const streak = await activityStreak(WorkoutLog, { user: user._id, dependent: null }, 'loggedAt', 60, NOW);
    expect(streak).toBe(3);
  });

  test('multiple logs on the same day only count once', async () => {
    const user = await createUser();
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'AM', durationMin: 20, loggedAt: NOW,
    });
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'PM', durationMin: 20, loggedAt: new Date(NOW.getTime() + 3 * 60 * 60 * 1000),
    });

    const streak = await activityStreak(WorkoutLog, { user: user._id, dependent: null }, 'loggedAt', 60, NOW);
    expect(streak).toBe(1);
  });

  test('is scoped per user — another user\'s logs never count', async () => {
    const user = await createUser();
    const other = await createUser();
    await WorkoutLog.create({
      user: other._id, type: 'other', name: 'Not mine', durationMin: 20, loggedAt: NOW,
    });

    const streak = await activityStreak(WorkoutLog, { user: user._id, dependent: null }, 'loggedAt', 60, NOW);
    expect(streak).toBe(0);
  });

  test('ignores activity older than the window', async () => {
    const user = await createUser();
    await WorkoutLog.create({
      user: user._id, type: 'other', name: 'Ancient', durationMin: 20, loggedAt: daysAgo(90),
    });

    const streak = await activityStreak(WorkoutLog, { user: user._id, dependent: null }, 'loggedAt', 60, NOW);
    expect(streak).toBe(0);
  });
});

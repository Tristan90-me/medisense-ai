const { computeStreak, todayUTCString, toDayStr } = require('../utils/streak');

const NOW = new Date('2026-01-10T15:00:00.000Z'); // Saturday

describe('toDayStr / todayUTCString', () => {
  test('formats a Date as YYYY-MM-DD in UTC', () => {
    expect(toDayStr(NOW)).toBe('2026-01-10');
    expect(todayUTCString(NOW)).toBe('2026-01-10');
  });
});

describe('computeStreak', () => {
  test('counts consecutive active days including today', () => {
    const active = new Set(['2026-01-10', '2026-01-09', '2026-01-08']);
    expect(computeStreak(active, NOW)).toBe(3);
  });

  test('today inactive but yesterday active still counts (streak not yet broken)', () => {
    const active = new Set(['2026-01-09', '2026-01-08']);
    expect(computeStreak(active, NOW)).toBe(2);
  });

  test('stops at the first gap', () => {
    const active = new Set(['2026-01-10', '2026-01-08']); // missing 01-09
    expect(computeStreak(active, NOW)).toBe(1);
  });

  test('an empty set is a streak of 0', () => {
    expect(computeStreak(new Set(), NOW)).toBe(0);
  });

  test('neither today nor yesterday active is a streak of 0, even with older activity', () => {
    const active = new Set(['2026-01-07']);
    expect(computeStreak(active, NOW)).toBe(0);
  });

  test('accepts a plain array, not just a Set', () => {
    expect(computeStreak(['2026-01-10'], NOW)).toBe(1);
  });
});

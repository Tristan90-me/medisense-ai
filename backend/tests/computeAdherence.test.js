// Pure unit tests for utils/computeAdherence.js — no DB, no HTTP. A fixed
// `now` is injected throughout so the 7-day window is deterministic rather
// than depending on when the test suite happens to run.
const { computeAdherence, ADHERENCE_WINDOW_DAYS } = require('../utils/computeAdherence');

const NOW = new Date('2026-10-14T12:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe('computeAdherence', () => {
  test('is not trackable when no reminder times are set', () => {
    const result = computeAdherence({ reminderTimes: [], doseLog: [], createdAt: daysAgo(30) }, NOW);
    expect(result).toEqual({ trackable: false, takenCount: 0, expectedCount: 0, percentage: null });
  });

  test('a medication active the full window with every dose logged scores 100%', () => {
    const medication = {
      reminderTimes: ['08:00', '20:00'],
      createdAt: daysAgo(30),
      doseLog: Array.from({ length: ADHERENCE_WINDOW_DAYS * 2 }, (_, i) => ({ takenAt: daysAgo(Math.floor(i / 2)) })),
    };
    const result = computeAdherence(medication, NOW);
    expect(result.trackable).toBe(true);
    expect(result.expectedCount).toBe(ADHERENCE_WINDOW_DAYS * 2);
    expect(result.takenCount).toBe(ADHERENCE_WINDOW_DAYS * 2);
    expect(result.percentage).toBe(100);
  });

  test('half the doses logged scores 50%', () => {
    const medication = {
      reminderTimes: ['08:00', '20:00'],
      createdAt: daysAgo(30),
      doseLog: Array.from({ length: ADHERENCE_WINDOW_DAYS }, (_, i) => ({ takenAt: daysAgo(i) })),
    };
    const result = computeAdherence(medication, NOW);
    expect(result.expectedCount).toBe(ADHERENCE_WINDOW_DAYS * 2);
    expect(result.takenCount).toBe(ADHERENCE_WINDOW_DAYS);
    expect(result.percentage).toBe(50);
  });

  test('a medication created 2 days ago only expects 2 days of doses, not the full window', () => {
    const medication = {
      reminderTimes: ['08:00'],
      createdAt: daysAgo(2),
      doseLog: [{ takenAt: daysAgo(1) }, { takenAt: daysAgo(0) }],
    };
    const result = computeAdherence(medication, NOW);
    expect(result.expectedCount).toBe(2);
    expect(result.takenCount).toBe(2);
    expect(result.percentage).toBe(100);
  });

  test('a medication created today (0 active days) is trackable but has nothing expected yet', () => {
    const medication = { reminderTimes: ['08:00'], createdAt: NOW, doseLog: [] };
    const result = computeAdherence(medication, NOW);
    expect(result.trackable).toBe(true);
    expect(result.expectedCount).toBe(0);
    expect(result.percentage).toBeNull();
  });

  test('doses logged before the 7-day window do not count', () => {
    const medication = {
      reminderTimes: ['08:00'],
      createdAt: daysAgo(30),
      doseLog: [{ takenAt: daysAgo(10) }, { takenAt: daysAgo(ADHERENCE_WINDOW_DAYS - 1) }],
    };
    const result = computeAdherence(medication, NOW);
    expect(result.takenCount).toBe(1);
  });

  test('percentage is capped at 100 even if doses were logged more often than scheduled', () => {
    const medication = {
      reminderTimes: ['08:00'],
      createdAt: daysAgo(30),
      doseLog: Array.from({ length: 20 }, (_, i) => ({ takenAt: daysAgo(i % ADHERENCE_WINDOW_DAYS) })),
    };
    const result = computeAdherence(medication, NOW);
    expect(result.percentage).toBe(100);
  });

  test('startDate later than createdAt (backdated prescription edit) is respected as the effective start', () => {
    const medication = {
      reminderTimes: ['08:00'],
      createdAt: daysAgo(30),
      startDate: daysAgo(3),
      doseLog: [{ takenAt: daysAgo(1) }],
    };
    const result = computeAdherence(medication, NOW);
    expect(result.expectedCount).toBe(3);
  });
});

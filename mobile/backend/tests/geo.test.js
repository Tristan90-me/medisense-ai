// Pure unit tests for utils/geo.js's haversineKm — no DB/HTTP involved.
const { haversineKm } = require('../utils/geo');

describe('haversineKm', () => {
  test('distance between identical points is 0', () => {
    expect(haversineKm(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0);
  });

  test('two points ~1 degree of latitude apart are ~111km', () => {
    // 1 degree of latitude is ~111.19km everywhere on Earth (longitude held constant).
    const distance = haversineKm(0, 0, 1, 0);
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  test('is symmetric', () => {
    const a = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    const b = haversineKm(48.8566, 2.3522, 51.5074, -0.1278);
    expect(a).toBeCloseTo(b, 10);
  });

  test('a known real-world pair (London to Paris) is roughly ~344km', () => {
    const distance = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance).toBeGreaterThan(300);
    expect(distance).toBeLessThan(400);
  });
});

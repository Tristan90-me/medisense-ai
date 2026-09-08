// Integration tests for the Care Finder API (routes/careFinder.js ->
// controllers/careFinderController.js). global.fetch is mocked in every test
// so no real network call ever reaches the live Overpass API — see the
// separate live-verification notes in the task report for the one real call
// made outside of Jest.
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
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

// Origin near NYC. Elements below are a realistic mix: a node with direct
// lat/lon and a full address/phone/hours, a way needing .center with no
// name (OSM data is frequently incomplete), a way with .center and a full
// address using contact:phone, and one malformed element with neither
// coordinate source (should be silently skipped, not crash the response).
const ORIGIN = { lat: 40.7128, lng: -74.0060 };

const MOCK_ELEMENTS = [
  {
    type: 'node',
    id: 1,
    lat: 40.7130,
    lon: -74.0060,
    tags: {
      amenity: 'hospital',
      name: 'City Hospital',
      phone: '+1-212-555-0100',
      opening_hours: '24/7',
      'addr:housenumber': '100',
      'addr:street': 'Broadway',
      'addr:city': 'New York',
    },
  },
  {
    type: 'way',
    id: 2,
    center: { lat: 40.7300, lon: -74.0200 },
    tags: { amenity: 'clinic' },
  },
  {
    type: 'way',
    id: 3,
    center: { lat: 40.7580, lon: -73.9855 },
    tags: {
      amenity: 'pharmacy',
      name: 'Corner Pharmacy',
      'contact:phone': '+1-212-555-0200',
      'addr:street': 'Fifth Avenue',
      'addr:city': 'New York',
    },
  },
  {
    type: 'node',
    id: 4,
    tags: { amenity: 'dentist', name: 'Smile Dental' },
    // no lat/lon and no center — malformed, must be skipped
  },
];

function mockOverpassOk(elements = MOCK_ELEMENTS) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ elements }),
  });
}

describe('Care Finder API', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  test('returns normalized facilities sorted by distance, skipping malformed elements', async () => {
    mockOverpassOk();
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/care-finder/nearby')
      .query({ lat: ORIGIN.lat, lng: ORIGIN.lng })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // The malformed dentist node (no lat/lon, no center) must be dropped.
    expect(res.body.facilities).toHaveLength(3);

    // Sorted by distance ascending: node 1 is closest, then way 2, then way 3.
    const ids = res.body.facilities.map((f) => f.id);
    expect(ids).toEqual(['node/1', 'way/2', 'way/3']);

    const hospital = res.body.facilities.find((f) => f.id === 'node/1');
    expect(hospital).toMatchObject({
      name: 'City Hospital',
      type: 'hospital',
      lat: 40.7130,
      lng: -74.0060,
      address: '100 Broadway, New York',
      phone: '+1-212-555-0100',
      openingHours: '24/7',
    });
    expect(typeof hospital.distanceKm).toBe('number');

    // Unnamed clinic falls back to a human label derived from amenity, and
    // uses .center for its coordinates since it's a way.
    const clinic = res.body.facilities.find((f) => f.id === 'way/2');
    expect(clinic.name).toBe('Unnamed Clinic');
    expect(clinic.lat).toBe(40.7300);
    expect(clinic.lng).toBe(-74.0200);
    expect(clinic.address).toBeNull();

    // Pharmacy resolves phone via contact:phone fallback and composes an
    // address from street + city alone (no house number).
    const pharmacy = res.body.facilities.find((f) => f.id === 'way/3');
    expect(pharmacy.phone).toBe('+1-212-555-0200');
    expect(pharmacy.address).toBe('Fifth Avenue, New York');

    // Results are ascending by distance.
    for (let i = 1; i < res.body.facilities.length; i += 1) {
      expect(res.body.facilities[i].distanceKm).toBeGreaterThanOrEqual(res.body.facilities[i - 1].distanceKm);
    }
  });

  test('type filter narrows the Overpass query to just that amenity', async () => {
    mockOverpassOk([MOCK_ELEMENTS[2]]); // pretend Overpass only returned the pharmacy
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/care-finder/nearby')
      .query({ lat: ORIGIN.lat, lng: ORIGIN.lng, type: 'pharmacy' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.facilities.every((f) => f.type === 'pharmacy')).toBe(true);

    const [, options] = global.fetch.mock.calls[0];
    const sentQuery = decodeURIComponent(options.body.replace(/^data=/, ''));
    expect(sentQuery).toContain('"amenity"="pharmacy"');
    expect(sentQuery).not.toContain('"amenity"="hospital"');
    expect(sentQuery).not.toContain('"amenity"="clinic"');
    expect(sentQuery).not.toContain('"amenity"="doctors"');
    expect(sentQuery).not.toContain('"amenity"="dentist"');
  });

  test('missing lat/lng is rejected with 400 before any Overpass call is made', async () => {
    mockOverpassOk();
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/care-finder/nearby')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('invalid lat/lng is rejected with 400', async () => {
    mockOverpassOk();
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/care-finder/nearby')
      .query({ lat: 999, lng: -74.006 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('invalid type is rejected with 400', async () => {
    mockOverpassOk();
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/care-finder/nearby')
      .query({ lat: ORIGIN.lat, lng: ORIGIN.lng, type: 'veterinarian' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('an Overpass fetch failure returns a graceful error, not a 500 crash', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/care-finder/nearby')
      .query({ lat: ORIGIN.lat, lng: ORIGIN.lng })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/unable to reach/i);
  });

  test('a non-ok Overpass response also returns a graceful error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 504, json: async () => ({}) });
    const user = await createUser();
    const token = tokenFor(user);

    const res = await request(app)
      .get('/api/care-finder/nearby')
      .query({ lat: ORIGIN.lat, lng: ORIGIN.lng })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });

  test('requires authentication', async () => {
    mockOverpassOk();
    const res = await request(app)
      .get('/api/care-finder/nearby')
      .query({ lat: ORIGIN.lat, lng: ORIGIN.lng });

    expect(res.status).toBe(401);
  });
});

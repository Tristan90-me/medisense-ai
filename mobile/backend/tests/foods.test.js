// Integration tests for /api/foods (routes/foods.js -> controllers/foodController.js).
// global.fetch is mocked for every test that reaches utils/foodApi.js.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const FoodItem = require('../models/FoodItem');
const CustomFood = require('../models/CustomFood');

beforeAll(async () => {
  await FoodItem.init();
  await CustomFood.init();
});

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

const OFF_PRODUCT = {
  code: '1234567890123',
  product_name: 'Test Cereal',
  brands: 'TestBrand',
  nutriments: { 'energy-kcal_100g': 380, proteins_100g: 8, carbohydrates_100g: 70, fat_100g: 5 },
};

describe('GET /api/foods/search', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/foods/search').query({ q: 'cereal' });
    expect(res.status).toBe(401);
  });

  test('rejects a missing query', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/foods/search').set(auth(user));
    expect(res.status).toBe(400);
  });

  test('returns external results plus this user\'s own custom foods', async () => {
    const user = await createUser();
    await CustomFood.create({
      user: user._id, name: 'Grandma\'s Cereal Mix', per100g: { calories: 300 },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [OFF_PRODUCT], foods: [] }) });

    const res = await request(app).get('/api/foods/search').query({ q: 'cereal' }).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.foods.some((f) => f.name === 'Test Cereal')).toBe(true);
    expect(res.body.customFoods.some((f) => f.name === "Grandma's Cereal Mix")).toBe(true);
  });

  test('never returns another user\'s custom foods', async () => {
    const user = await createUser();
    const other = await createUser();
    await CustomFood.create({ user: other._id, name: 'Secret Cereal Recipe', per100g: { calories: 300 } });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [], foods: [] }) });

    const res = await request(app).get('/api/foods/search').query({ q: 'cereal' }).set(auth(user));
    expect(res.body.customFoods).toEqual([]);
  });
});

describe('GET /api/foods/barcode/:code', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('rejects a malformed barcode', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/foods/barcode/not-a-barcode').set(auth(user));
    expect(res.status).toBe(400);
  });

  test('returns the normalized product on a match', async () => {
    const user = await createUser();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 1, product: OFF_PRODUCT }) });

    const res = await request(app).get('/api/foods/barcode/1234567890123').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.food.name).toBe('Test Cereal');
  });

  test('404s when the barcode has no match', async () => {
    const user = await createUser();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 0 }) });

    const res = await request(app).get('/api/foods/barcode/9999999999999').set(auth(user));
    expect(res.status).toBe(404);
  });
});

describe('custom foods CRUD', () => {
  test('creates a custom food owned by the requester', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/foods/custom').set(auth(user)).send({
      name: 'Homemade Granola',
      per100g: { calories: 450, carbsG: 60, proteinG: 10, fatG: 15 },
      servingOptions: [{ label: '1 cup', grams: 100 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.customFood).toMatchObject({ name: 'Homemade Granola' });
    expect(res.body.customFood.per100g.calories).toBe(450);
  });

  test('rejects a negative nutrition value', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/foods/custom').set(auth(user)).send({
      name: 'Bad Food', per100g: { calories: -100 },
    });
    expect(res.status).toBe(400);
  });

  test('lists only the requester\'s own custom foods', async () => {
    const user = await createUser();
    const other = await createUser();
    await CustomFood.create({ user: user._id, name: 'Mine', per100g: { calories: 100 } });
    await CustomFood.create({ user: other._id, name: 'Theirs', per100g: { calories: 100 } });

    const res = await request(app).get('/api/foods/custom').set(auth(user));
    expect(res.body.customFoods).toHaveLength(1);
    expect(res.body.customFoods[0].name).toBe('Mine');
  });

  test('updates a custom food the requester owns', async () => {
    const user = await createUser();
    const food = await CustomFood.create({ user: user._id, name: 'Original', per100g: { calories: 100 } });
    const res = await request(app).put(`/api/foods/custom/${food._id}`).set(auth(user)).send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.customFood.name).toBe('Renamed');
  });

  test("404s updating someone else's custom food", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const food = await CustomFood.create({ user: owner._id, name: 'Original', per100g: { calories: 100 } });
    const res = await request(app).put(`/api/foods/custom/${food._id}`).set(auth(intruder)).send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
    expect((await CustomFood.findById(food._id)).name).toBe('Original');
  });

  test('deletes a custom food the requester owns', async () => {
    const user = await createUser();
    const food = await CustomFood.create({ user: user._id, name: 'Delete me', per100g: { calories: 100 } });
    const res = await request(app).delete(`/api/foods/custom/${food._id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(await CustomFood.findById(food._id)).toBeNull();
  });

  test("404s deleting someone else's custom food", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const food = await CustomFood.create({ user: owner._id, name: 'Keep me', per100g: { calories: 100 } });
    const res = await request(app).delete(`/api/foods/custom/${food._id}`).set(auth(intruder));
    expect(res.status).toBe(404);
    expect(await CustomFood.findById(food._id)).not.toBeNull();
  });
});

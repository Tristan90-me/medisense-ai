// Integration tests for /api/meals (routes/meals.js -> controllers/mealController.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Dependent = require('../models/Dependent');
const FoodItem = require('../models/FoodItem');
const CustomFood = require('../models/CustomFood');
const Recipe = require('../models/Recipe');
const MealLog = require('../models/MealLog');

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

// 200 calories, 20g carbs, 10g protein, 5g fat per 100g
const makeFoodItem = () => FoodItem.create({
  source: 'usda',
  externalId: `fdc-${Date.now()}-${Math.random()}`,
  name: 'Rice',
  per100g: { calories: 200, carbsG: 20, proteinG: 10, fatG: 5 },
});

describe('POST /api/meals — kind: food', () => {
  test('logs a food entry with the correct nutrition snapshot', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();

    const res = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 150, servingLabel: '150g',
    });

    expect(res.status).toBe(201);
    expect(res.body.meal).toMatchObject({ name: 'Rice', mealType: 'lunch', grams: 150 });
    expect(res.body.meal.nutrition).toMatchObject({ calories: 300, carbsG: 30, proteinG: 15, fatG: 7.5 });
  });

  test("404s logging someone else's custom food", async () => {
    const user = await createUser();
    const other = await createUser();
    const theirFood = await CustomFood.create({ user: other._id, name: 'Private', per100g: { calories: 100 } });

    const res = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'snack', kind: 'food', foodKind: 'CustomFood', food: theirFood._id, grams: 100,
    });
    expect(res.status).toBe(404);
  });

  test('rejects a non-positive grams value', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    const res = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 0,
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/meals — kind: recipe', () => {
  test('logs N servings of a recipe with nutrition scaled accordingly', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    const recipe = await Recipe.create({
      user: user._id, name: 'Rice Bowl', servings: 2, ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 200 }],
    });
    // Recipe total: calories 400 over 2 servings -> 200/serving. Logging 1.5 servings -> 300.

    const res = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'dinner', kind: 'recipe', recipe: recipe._id, servingsOfRecipe: 1.5,
    });

    expect(res.status).toBe(201);
    expect(res.body.meal.name).toBe('Rice Bowl');
    expect(res.body.meal.nutrition.calories).toBe(300);
    expect(res.body.meal.servingLabel).toBe('1.5 servings');
  });

  test("404s logging someone else's recipe", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const rice = await makeFoodItem();
    const recipe = await Recipe.create({ user: owner._id, name: 'Private', ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 100 }] });

    const res = await request(app).post('/api/meals').set(auth(intruder)).send({
      mealType: 'dinner', kind: 'recipe', recipe: recipe._id, servingsOfRecipe: 1,
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/meals — kind: quick_add', () => {
  test('logs a quick-add with just the given macros', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'snack',
      kind: 'quick_add',
      name: 'Coffee',
      quickAdd: {
        calories: 5, carbsG: 1, proteinG: 0, fatG: 0,
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.meal.name).toBe('Coffee');
    expect(res.body.meal.nutrition.calories).toBe(5);
  });

  test('rejects a quick-add missing required macro fields', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'snack', kind: 'quick_add', name: 'Mystery Snack', quickAdd: { calories: 100 },
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/meals — day view', () => {
  test('defaults to today and totals the day\'s nutrition', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'breakfast', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });
    await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 200,
    });

    const res = await request(app).get('/api/meals').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.meals).toHaveLength(2);
    expect(res.body.totals.calories).toBe(600); // 200 + 400
  });

  test('a specific date only returns that day\'s entries', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    await MealLog.create({
      user: user._id, mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
      name: 'Rice', nutrition: { calories: 200 }, loggedAt: new Date('2026-01-01T12:00:00.000Z'),
    });
    await MealLog.create({
      user: user._id, mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
      name: 'Rice', nutrition: { calories: 200 }, loggedAt: new Date('2026-01-02T12:00:00.000Z'),
    });

    const res = await request(app).get('/api/meals').query({ date: '2026-01-01' }).set(auth(user));
    expect(res.body.meals).toHaveLength(1);
    expect(res.body.date).toBe('2026-01-01');
  });

  test('rejects a malformed date', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/meals').query({ date: '01/01/2026' }).set(auth(user));
    expect(res.status).toBe(400);
  });
});

describe('dependent scoping', () => {
  test("a dependent's meal log is separate from the account owner's", async () => {
    const user = await createUser();
    const kid = await Dependent.create({ owner: user._id, name: 'Kiddo', relationship: 'child' });
    const rice = await makeFoodItem();

    await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });
    await request(app).post('/api/meals').set(auth(user)).send({
      dependent: String(kid._id), mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });

    const self = await request(app).get('/api/meals').set(auth(user));
    const dep = await request(app).get('/api/meals').query({ dependent: String(kid._id) }).set(auth(user));
    expect(self.body.meals).toHaveLength(1);
    expect(dep.body.meals).toHaveLength(1);
  });

  test("404s logging against someone else's dependent", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const kid = await Dependent.create({ owner: owner._id, name: 'Kiddo', relationship: 'child' });
    const rice = await makeFoodItem();

    const res = await request(app).post('/api/meals').set(auth(intruder)).send({
      dependent: String(kid._id), mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });
    expect(res.status).toBe(404);
  });
});

describe('favourites and most-eaten', () => {
  test('getFavourites returns only entries flagged isFavourite', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    const a = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });
    await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'dinner', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });
    await request(app).put(`/api/meals/${a.body.meal._id}`).set(auth(user)).send({ isFavourite: true });

    const res = await request(app).get('/api/meals/favourites').set(auth(user));
    expect(res.body.meals).toHaveLength(1);
    expect(res.body.meals[0]._id).toBe(a.body.meal._id);
  });

  test('getMostEaten ranks by frequency, most logged first', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).post('/api/meals').set(auth(user)).send({
        mealType: 'snack', kind: 'quick_add', name: 'Coffee', quickAdd: {
          calories: 5, carbsG: 0, proteinG: 0, fatG: 0,
        },
      });
    }
    await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });

    const res = await request(app).get('/api/meals/most-eaten').set(auth(user));
    expect(res.body.mostEaten[0]).toMatchObject({ name: 'Coffee', count: 3 });
  });
});

describe('PUT /api/meals/:id', () => {
  test('changing grams on a food entry recomputes its nutrition', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    const logged = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });

    const res = await request(app).put(`/api/meals/${logged.body.meal._id}`).set(auth(user)).send({ grams: 300 });
    expect(res.status).toBe(200);
    expect(res.body.meal.nutrition.calories).toBe(600);
  });

  test('rejects changing grams on a non-food entry', async () => {
    const user = await createUser();
    const logged = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'snack', kind: 'quick_add', name: 'Coffee', quickAdd: {
        calories: 5, carbsG: 0, proteinG: 0, fatG: 0,
      },
    });

    const res = await request(app).put(`/api/meals/${logged.body.meal._id}`).set(auth(user)).send({ grams: 100 });
    expect(res.status).toBe(400);
  });

  test("404s updating someone else's meal log entry", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const rice = await makeFoodItem();
    const logged = await request(app).post('/api/meals').set(auth(owner)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });

    const res = await request(app).put(`/api/meals/${logged.body.meal._id}`).set(auth(intruder)).send({ isFavourite: true });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/meals/:id', () => {
  test('deletes a meal log entry the requester owns', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    const logged = await request(app).post('/api/meals').set(auth(user)).send({
      mealType: 'lunch', kind: 'food', foodKind: 'FoodItem', food: rice._id, grams: 100,
    });

    const res = await request(app).delete(`/api/meals/${logged.body.meal._id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(await MealLog.findById(logged.body.meal._id)).toBeNull();
  });
});

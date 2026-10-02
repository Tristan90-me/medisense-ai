// Integration tests for /api/recipes (routes/recipes.js -> controllers/recipeController.js).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const FoodItem = require('../models/FoodItem');
const CustomFood = require('../models/CustomFood');
const Recipe = require('../models/Recipe');

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

// calories 200/carbs 20/protein 10/fat 5 per 100g
const makeFoodItem = () => FoodItem.create({
  source: 'usda',
  externalId: `fdc-${Date.now()}-${Math.random()}`,
  name: 'Rice',
  per100g: {
    calories: 200, carbsG: 20, proteinG: 10, fatG: 5, fiberG: 0, sugarG: 0, sodiumMg: 0, potassiumMg: 0, calciumMg: 0, ironMg: 0, vitaminCMg: 0, vitaminAMcg: 0,
  },
});

describe('POST /api/recipes', () => {
  test('creates a recipe and computes total + per-serving nutrition', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    const sauce = await CustomFood.create({
      user: user._id, name: 'Homemade Sauce', per100g: { calories: 100, carbsG: 10, proteinG: 5, fatG: 2 },
    });

    const res = await request(app).post('/api/recipes').set(auth(user)).send({
      name: 'Rice Bowl',
      servings: 2,
      ingredients: [
        { foodKind: 'FoodItem', food: rice._id, grams: 200, label: 'Rice' },
        { foodKind: 'CustomFood', food: sauce._id, grams: 100, label: 'Sauce' },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.recipe.nutrition.total).toMatchObject({
      calories: 500, carbsG: 50, proteinG: 25, fatG: 12,
    });
    expect(res.body.recipe.nutrition.perServing).toMatchObject({
      calories: 250, carbsG: 25, proteinG: 12.5, fatG: 6,
    });
  });

  test('rejects a recipe with no ingredients', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/recipes').set(auth(user)).send({ name: 'Empty', ingredients: [] });
    expect(res.status).toBe(400);
  });

  test("rejects an ingredient pointing at another user's custom food", async () => {
    const user = await createUser();
    const other = await createUser();
    const theirFood = await CustomFood.create({ user: other._id, name: 'Private', per100g: { calories: 100 } });

    const res = await request(app).post('/api/recipes').set(auth(user)).send({
      name: 'Borrowed',
      ingredients: [{ foodKind: 'CustomFood', food: theirFood._id, grams: 100 }],
    });
    expect(res.status).toBe(400);
    expect(await Recipe.countDocuments()).toBe(0);
  });

  test('rejects an ingredient referencing a nonexistent food', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/recipes').set(auth(user)).send({
      name: 'Ghost',
      ingredients: [{ foodKind: 'FoodItem', food: '507f1f77bcf86cd799439011', grams: 100 }],
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/recipes and /api/recipes/:id', () => {
  test('lists only the requester\'s own recipes, each with computed nutrition', async () => {
    const user = await createUser();
    const other = await createUser();
    const rice = await makeFoodItem();
    await Recipe.create({ user: user._id, name: 'Mine', ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 100 }] });
    await Recipe.create({ user: other._id, name: 'Theirs', ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 100 }] });

    const res = await request(app).get('/api/recipes').set(auth(user));
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].name).toBe('Mine');
    expect(res.body.recipes[0].nutrition.total.calories).toBe(200);
  });

  test("404s reading someone else's recipe by id", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const rice = await makeFoodItem();
    const recipe = await Recipe.create({ user: owner._id, name: 'Private', ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 100 }] });

    const res = await request(app).get(`/api/recipes/${recipe._id}`).set(auth(intruder));
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/recipes/:id', () => {
  test('changing ingredients recomputes nutrition', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    const recipe = await Recipe.create({
      user: user._id, name: 'Adjustable', servings: 1, ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 100 }],
    });

    const res = await request(app).put(`/api/recipes/${recipe._id}`).set(auth(user)).send({
      ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 400 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.recipe.nutrition.total.calories).toBe(800);
  });

  test("404s updating someone else's recipe", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const rice = await makeFoodItem();
    const recipe = await Recipe.create({ user: owner._id, name: 'Private', ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 100 }] });

    const res = await request(app).put(`/api/recipes/${recipe._id}`).set(auth(intruder)).send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/recipes/:id', () => {
  test('deletes a recipe the requester owns', async () => {
    const user = await createUser();
    const rice = await makeFoodItem();
    const recipe = await Recipe.create({ user: user._id, name: 'Delete me', ingredients: [{ foodKind: 'FoodItem', food: rice._id, grams: 100 }] });

    const res = await request(app).delete(`/api/recipes/${recipe._id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(await Recipe.findById(recipe._id)).toBeNull();
  });
});

// Tests for utils/foodApi.js. global.fetch is mocked in every test that
// hits the network — same convention as tests/careFinder.test.js.
const FoodItem = require('../models/FoodItem');
const {
  searchFoods, lookupFoodByBarcode, normalizeOpenFoodFacts, normalizeUsda,
} = require('../utils/foodApi');

const OFF_PRODUCT = {
  code: '1234567890123',
  product_name: 'Test Cereal',
  brands: 'TestBrand, OtherBrand',
  nutriments: {
    'energy-kcal_100g': 380,
    carbohydrates_100g: 70,
    proteins_100g: 8,
    fat_100g: 5,
    fiber_100g: 6,
    sugars_100g: 20,
    sodium_100g: 0.5,
    potassium_100g: 0.3,
    calcium_100g: 0.1,
    iron_100g: 0.008,
    'vitamin-c_100g': 0.01,
    'vitamin-a_100g': 0.0000008,
  },
  serving_size: '30g',
  serving_quantity: 30,
};

// Mongoose builds declared indexes (including the text index searchFoods
// relies on) asynchronously after connecting — Model.init() resolves once
// they're actually ready, which a query issued immediately after connecting
// can otherwise race.
beforeAll(async () => {
  await FoodItem.init();
});

const USDA_FOOD = {
  fdcId: 654321,
  description: 'Chicken breast, raw',
  foodNutrients: [
    { nutrientId: 1008, value: 165 },
    { nutrientId: 1003, value: 31 },
    { nutrientId: 1004, value: 3.6 },
    { nutrientId: 1005, value: 0 },
    { nutrientId: 1093, value: 74 },
    { nutrientId: 1092, value: 256 },
    { nutrientId: 1087, value: 15 },
    { nutrientId: 1089, value: 1 },
    { nutrientId: 1106, value: 6 },
  ],
  servingSize: 100,
  servingSizeUnit: 'g',
};

describe('normalizeOpenFoodFacts', () => {
  test('converts OFF gram-based nutrients to the schema mg/mcg shape', () => {
    const normalized = normalizeOpenFoodFacts(OFF_PRODUCT);
    expect(normalized).toEqual({
      source: 'openfoodfacts',
      barcode: '1234567890123',
      name: 'Test Cereal',
      brand: 'TestBrand',
      per100g: {
        calories: 380, carbsG: 70, proteinG: 8, fatG: 5, fiberG: 6, sugarG: 20,
        sodiumMg: 500, potassiumMg: 300, calciumMg: 100, ironMg: 8, vitaminCMg: 10, vitaminAMcg: 0.8,
      },
      servingOptions: [{ label: '30g', grams: 30 }],
    });
  });

  test('missing nutriments/name/brand degrade to defaults instead of throwing', () => {
    const normalized = normalizeOpenFoodFacts({ code: '000', product_name: null, generic_name: 'Fallback' });
    expect(normalized.name).toBe('Fallback');
    expect(normalized.brand).toBeUndefined();
    expect(normalized.per100g.calories).toBe(0);
    expect(normalized.servingOptions).toEqual([]);
  });
});

describe('normalizeUsda', () => {
  test('maps USDA nutrient ids to the schema fields, defaulting missing ones to 0', () => {
    const normalized = normalizeUsda(USDA_FOOD);
    expect(normalized).toEqual({
      source: 'usda',
      externalId: '654321',
      name: 'Chicken breast, raw',
      brand: undefined,
      per100g: {
        calories: 165, proteinG: 31, fatG: 3.6, carbsG: 0, fiberG: 0, sugarG: 0,
        sodiumMg: 74, potassiumMg: 256, calciumMg: 15, ironMg: 1, vitaminCMg: 0, vitaminAMcg: 6,
      },
      servingOptions: [{ label: '1 serving (100g)', grams: 100 }],
    });
  });
});

describe('searchFoods', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('caches results from both sources and returns them', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('world.openfoodfacts.org')) {
        return Promise.resolve({ ok: true, json: async () => ({ products: [OFF_PRODUCT] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ foods: [USDA_FOOD] }) });
    });

    const results = await searchFoods('chicken');
    expect(results).toHaveLength(2);
    expect(await FoodItem.countDocuments()).toBe(2);
    const off = await FoodItem.findOne({ source: 'openfoodfacts', barcode: '1234567890123' });
    const usda = await FoodItem.findOne({ source: 'usda', externalId: '654321' });
    expect(off).not.toBeNull();
    expect(usda).not.toBeNull();
  });

  test('a second identical search does not create duplicate FoodItems', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('world.openfoodfacts.org')) {
        return Promise.resolve({ ok: true, json: async () => ({ products: [OFF_PRODUCT] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ foods: [USDA_FOOD] }) });
    });

    await searchFoods('chicken');
    await searchFoods('chicken');
    expect(await FoodItem.countDocuments()).toBe(2);
  });

  test('skips USDA entirely when USDA_API_KEY is not configured', async () => {
    const original = process.env.USDA_API_KEY;
    delete process.env.USDA_API_KEY;
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ products: [OFF_PRODUCT] }) }));

    const results = await searchFoods('cereal');
    expect(results).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    process.env.USDA_API_KEY = original;
  });

  test('a persistent network failure on one source still returns the other', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('world.openfoodfacts.org')) return Promise.reject(new Error('network down'));
      return Promise.resolve({ ok: true, json: async () => ({ foods: [USDA_FOOD] }) });
    });

    const results = await searchFoods('chicken');
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('usda');
  });
});

describe('lookupFoodByBarcode', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('fetches, normalizes, and caches on first lookup', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 1, product: OFF_PRODUCT }) });

    const food = await lookupFoodByBarcode('1234567890123');
    expect(food.name).toBe('Test Cereal');
    expect(food.per100g.calories).toBe(380);
    expect(await FoodItem.countDocuments()).toBe(1);
  });

  test('a repeat lookup serves from the cache without calling fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 1, product: OFF_PRODUCT }) });
    await lookupFoodByBarcode('1234567890123');

    global.fetch = jest.fn();
    const food = await lookupFoodByBarcode('1234567890123');
    expect(food.name).toBe('Test Cereal');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns null when the product is not found (status 0)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 0 }) });
    expect(await lookupFoodByBarcode('0000000000000')).toBeNull();
  });

  test('returns null (not a throw) when the network is persistently unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    expect(await lookupFoodByBarcode('1234567890123')).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2); // one retry, per fetchJson
  });
});

// Open Food Facts (barcode + branded-food search) and USDA FoodData Central
// (generic/whole-food search, more reliable micronutrients) integration.
// Every result is normalized to FoodItem's shape and cached on first fetch
// (findOrCacheFoodItem) so repeat searches/scans hit our own DB, not the
// external API. Both are free — OFF needs no key, USDA needs a free
// USDA_API_KEY (https://fdc.nal.usda.gov/api-key-signup); USDA search is
// skipped (not an error) when that key isn't configured.
const FoodItem = require('../models/FoodItem');

const OFF_BASE = 'https://world.openfoodfacts.org';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const USER_AGENT = 'MediSenseAI/1.0 (health app; nutrition tracker food lookup)';
const FETCH_TIMEOUT_MS = 10000;
// Jest sets NODE_ENV=test by default — keep the real backoff outside tests,
// same reasoning as careFinderController's RETRY_DELAY_MS.
const RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 10 : 1200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJsonOnce = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'User-Agent': USER_AGENT, ...options.headers },
      signal: controller.signal,
    });
    if (!response.ok) {
      const err = new Error(`${url} responded ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

// One retry after a short delay — both APIs are free/rate-limited with no
// SLA, so a single transient blip is common and usually clears quickly.
// Every failure is logged so a real outage isn't silently indistinguishable
// from "no results."
const fetchJson = async (url, options = {}) => {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await fetchJsonOnce(url, options);
    } catch (err) {
      console.error(`[foodApi] request failed (attempt ${attempt}/2): ${err.message}`);
      if (attempt < 2) await sleep(RETRY_DELAY_MS);
    }
  }
  return null;
};

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// Open Food Facts stores nutrients as grams per 100g by default, including
// minerals/vitamins — converted here to the mg/µg our schema expects.
// Fields are frequently missing/partial in OFF's community-sourced data, so
// every lookup defaults to 0 rather than failing the whole normalization.
function normalizeOpenFoodFacts(product) {
  const n = product.nutriments || {};
  const per100g = {
    calories: round1(n['energy-kcal_100g']),
    carbsG: round1(n.carbohydrates_100g),
    proteinG: round1(n.proteins_100g),
    fatG: round1(n.fat_100g),
    fiberG: round1(n.fiber_100g),
    sugarG: round1(n.sugars_100g),
    sodiumMg: round1((n.sodium_100g || 0) * 1000),
    potassiumMg: round1((n.potassium_100g || 0) * 1000),
    calciumMg: round1((n.calcium_100g || 0) * 1000),
    ironMg: round1((n.iron_100g || 0) * 1000),
    vitaminCMg: round1((n['vitamin-c_100g'] || 0) * 1000),
    vitaminAMcg: round1((n['vitamin-a_100g'] || 0) * 1000000),
  };
  const servingOptions = [];
  if (product.serving_size && product.serving_quantity) {
    servingOptions.push({ label: product.serving_size, grams: Number(product.serving_quantity) });
  }
  return {
    source: 'openfoodfacts',
    barcode: product.code,
    name: product.product_name || product.generic_name || 'Unknown product',
    brand: product.brands ? product.brands.split(',')[0].trim() : undefined,
    per100g,
    servingOptions,
  };
}

// USDA FoodData Central nutrient IDs (fixed by USDA, not configurable) —
// values are already per-100g in the units our schema expects, so this is a
// lookup, not a unit conversion.
const USDA_NUTRIENT_IDS = {
  calories: 1008, proteinG: 1003, fatG: 1004, carbsG: 1005, fiberG: 1079, sugarG: 2000,
  sodiumMg: 1093, potassiumMg: 1092, calciumMg: 1087, ironMg: 1089, vitaminCMg: 1162, vitaminAMcg: 1106,
};

function normalizeUsda(food) {
  const byId = new Map((food.foodNutrients || []).map((fn) => [fn.nutrientId, fn.value]));
  const per100g = Object.fromEntries(
    Object.entries(USDA_NUTRIENT_IDS).map(([field, id]) => [field, round1(byId.get(id))]),
  );
  return {
    source: 'usda',
    externalId: String(food.fdcId),
    name: food.description || 'Unknown food',
    brand: food.brandOwner || undefined,
    per100g,
    servingOptions: (food.servingSize && food.servingSizeUnit === 'g')
      ? [{ label: `1 serving (${food.servingSize}g)`, grams: Number(food.servingSize) }]
      : [],
  };
}

// Upserts a normalized candidate into the shared FoodItem cache, keyed by
// whichever identifier its source uses (barcode for OFF, externalId for
// USDA) — so the same product looked up twice never creates a duplicate row.
async function findOrCacheFoodItem(normalized) {
  const filter = normalized.barcode
    ? { source: normalized.source, barcode: normalized.barcode }
    : { source: normalized.source, externalId: normalized.externalId };
  return FoodItem.findOneAndUpdate(
    filter,
    { ...normalized, lastFetchedAt: new Date() },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function searchOpenFoodFacts(query) {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`;
  const data = await fetchJson(url);
  if (!data || !Array.isArray(data.products)) return [];
  return data.products.filter((p) => p.product_name).map(normalizeOpenFoodFacts);
}

async function searchUsda(query) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return [];
  const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJson(url);
  if (!data || !Array.isArray(data.foods)) return [];
  return data.foods.map(normalizeUsda);
}

// Searches our own cache first (fast, no external call), then augments with
// live results from both sources, caching anything new it finds.
async function searchFoods(query) {
  const [cached, off, usda] = await Promise.all([
    FoodItem.find({ $text: { $search: query } }).limit(10),
    searchOpenFoodFacts(query),
    searchUsda(query),
  ]);
  const fresh = await Promise.all([...off, ...usda].map(findOrCacheFoodItem));
  const seen = new Set(cached.map((f) => String(f._id)));
  return [...cached, ...fresh.filter((f) => f && !seen.has(String(f._id)))];
}

async function lookupFoodByBarcode(barcode) {
  const cached = await FoodItem.findOne({ source: 'openfoodfacts', barcode });
  if (cached) return cached;

  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const data = await fetchJson(url);
  if (!data || data.status !== 1 || !data.product) return null;
  return findOrCacheFoodItem(normalizeOpenFoodFacts({ ...data.product, code: data.product.code || barcode }));
}

module.exports = {
  searchFoods, lookupFoodByBarcode, findOrCacheFoodItem, normalizeOpenFoodFacts, normalizeUsda,
};
